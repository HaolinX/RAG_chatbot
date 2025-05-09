// app.js - Main server file
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
require('dotenv').config();

// --- LangChain Imports ---
const { FaissStore } = require("@langchain/community/vectorstores/faiss");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { PromptTemplate } = require("@langchain/core/prompts");
const { ChatOpenAI } = require("@langchain/openai");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { RunnableSequence } = require("@langchain/core/runnables");

// Initialize ChatOpenAI
const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0.7,
    openAIApiKey: process.env.OPENAI_API_KEY,
});

// Create a custom prompt template for better answers
const PROMPT_TEMPLATE = `
You are a highly knowledgeable assistant. Based on the following context, provide a grammatically correct, well-mannered, and comprehensive answer to the question. If the context doesn't contain enough information to answer the question fully, say so politely.

Context: {context}

Question: {question}

Please provide a clear and helpful response:`;

// --- App Setup ---
const app = express();
const PORT = process.env.PORT || 3001;

const cors = require('cors');
app.use(cors());

// --- Middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- File Upload Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// --- Ensure Directories Exist ---
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('vectorstore')) fs.mkdirSync('vectorstore');

// --- Pipeline Instance for all transformer models ---
let pipelineInstance = null;

// --- Custom Transformer Embeddings ---
class TransformerEmbeddings extends Embeddings {
  constructor(modelName = 'Xenova/all-MiniLM-L6-v2') {
    super({});
    this.modelName = modelName;
    this.embeddingPipeline = null;
  }

  async init() {
    if (!this.embeddingPipeline) {
      console.log(`Loading embedding model: ${this.modelName}...`);

      if (!pipelineInstance) {
        const transformers = await import('@xenova/transformers');
        pipelineInstance = transformers.pipeline;
        console.log('Transformer pipeline function loaded.');
      }

      this.embeddingPipeline = await pipelineInstance('feature-extraction', this.modelName);
      console.log('Embedding model loaded successfully!');
    }
    return this;
  }

  async embed(texts) {
    await this.init();
    const embeddings = [];
    for (const text of texts) {
      const result = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });
      embeddings.push(Array.from(result.data));
    }
    return embeddings;
  }

  embedDocuments(texts) {
    return this.embed(texts);
  }

  async embedQuery(text) {
    await this.init();
    const result = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }
}
const embeddings = new TransformerEmbeddings();

// --- Hugging Face QA Model Class ---
class HuggingFaceQA {
  constructor(modelName = 'Xenova/distilbert-base-cased-distilled-squad') {
    this.modelName = modelName;
    this.qaModel = null;
  }

  async init() {
    if (!this.qaModel) {
      console.log(`Loading QA model: ${this.modelName}...`);

      if (!pipelineInstance) {
        const transformers = await import('@xenova/transformers');
        pipelineInstance = transformers.pipeline;
        console.log('Transformer pipeline function loaded.');
      }

      this.qaModel = await pipelineInstance('question-answering', this.modelName);
      console.log('QA model loaded successfully!');
    }
    return this;
  }

  async getAnswer(question, context) {
    await this.init();
    try {
      // Ensure both question and context are strings
      if (typeof question !== 'string' || typeof context !== 'string') {
        console.error('Invalid input types:', { 
          questionType: typeof question, 
          contextType: typeof context 
        });
        throw new Error('Question and context must be strings');
      }
      const truncatedContext = context.substring(0, 1500);
      
      console.log('Submitting question to QA model:', question.substring(0, 100));
      console.log('Context length:', truncatedContext.length);

      const result = await this.qaModel(String(question), String(truncatedContext))
      
      return {
        answer: result.answer || "Unable to extract an answer from the context.",
        score: result.score,
        start: result.start,
        end: result.end
      };
    } catch (error) {
      console.error('Error in QA model:', error);
      throw new Error('Failed to get answer from QA model');
    }
  }
}

// Initialize QA model
const qaModel = new HuggingFaceQA();

// --- Routes ---

app.post('/upload', upload.single('pdf'), processPDF);

app.post('/upload-base64', async (req, res) => {
  try {
    const { base64PDF, filename } = req.body;
    if (!base64PDF || !filename) return res.status(400).json({ error: 'PDF data and filename are required' });

    const base64Data = base64PDF.replace(/^data:application\/pdf;base64,/, '');
    const pdfBuffer = Buffer.from(base64Data, 'base64');
    const savedFilename = Date.now() + '.pdf';
    const filePath = path.join('uploads', savedFilename);
    fs.writeFileSync(filePath, pdfBuffer);

    req.file = { path: filePath, filename: savedFilename };
    return await processPDF(req, res);
  } catch (error) {
    console.error('Error processing base64 PDF:', error);
    res.status(500).json({ error: 'Error processing PDF: ' + error.message });
  }
});

// --- PDF Processing Function ---
async function processPDF(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;
    const dataBuffer = fs.readFileSync(filePath);

    console.log('Extracting text...');
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    console.log('Splitting text...');
    const textSplitter = new RecursiveCharacterTextSplitter(
      { chunkSize: 1000, chunkOverlap: 200 , separator: [".", "\n"] }
    );
    const docs = await textSplitter.createDocuments([text], [{ source: req.file.filename }]);

    console.log('Creating embeddings and vector store...');
    await embeddings.init();
    const vectorStore = await FaissStore.fromDocuments(docs, embeddings);

    const vectorStorePath = `vectorstore/${path.basename(req.file.filename, '.pdf')}`;
    await vectorStore.save(vectorStorePath);
    console.log(`Vector store saved to: ${vectorStorePath}`);

    console.log('Generating summary...');
    const summary = await generateBARTSummary(text);

    return res.json({
      message: 'PDF uploaded and processed successfully',
      filename: req.file.filename,
      summary: summary
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ error: 'Error processing PDF: ' + error.message });
  }
}

// --- Q&A Endpoint with ChatGPT-4 ---
app.post('/ask', async (req, res) => {
    try {
        const { question, filename } = req.body;
        if (!question || !filename) return res.status(400).json({ error: 'Question and filename are required' });

        const vectorStorePath = `vectorstore/${path.basename(filename, '.pdf')}`;
        if (!fs.existsSync(vectorStorePath)) {
            return res.status(404).json({ error: `Vector store for ${filename} not found. Please process the PDF first.` });
        }

        console.log(`Loading vector store from: ${vectorStorePath}`);
        await embeddings.init();
        const vectorStore = await FaissStore.load(vectorStorePath, embeddings);

        console.log('Searching for relevant context...');
        const relevantDocs = await vectorStore.similaritySearch(question, 3);
        console.log(`Found ${relevantDocs.length} relevant documents`);

        if (relevantDocs.length === 0) {
            return res.json({ answer: "I apologize, but I couldn't find relevant information in the document to answer your question." });
        }

        // Combine relevant docs into one context string
        const context = relevantDocs
            .map(doc => doc.pageContent ? String(doc.pageContent).trim() : "")
            .filter(text => text.length > 0)
            .join("\n\n");

        if (!context || context.length === 0) {
            return res.json({ answer: "I apologize, but the relevant sections of the document appear to be empty or invalid." });
        }

        // Create prompt with template
        const prompt = PromptTemplate.fromTemplate(PROMPT_TEMPLATE);
        
        // Create a chain with ChatOpenAI
        const chain = RunnableSequence.from([
            {
                context: (input) => input.context,
                question: (input) => input.question
            },
            prompt,
            model,
            new StringOutputParser()
        ]);

        // Generate answer
        console.log('Generating answer with GPT-4...');
        const answer = await chain.invoke({
            question: question,
            context: context
        });

        console.log('Answer generated');
        res.json({
            answer: answer,
            confidence: 0.95  // GPT-4 doesn't provide confidence scores, so we use a default high value
        });
    } catch (error) {
        console.error('Error answering question:', error);
        res.status(500).json({ error: 'Error answering question: ' + error.message });
    }
});

// --- Summarization Function ---
async function generateBARTSummary(text) {
  try {
    console.log('Initializing BART summarization model...');

    if (!pipelineInstance) {
      const transformers = await import('@xenova/transformers');
      pipelineInstance = transformers.pipeline;
      console.log('Transformer pipeline function loaded.');
    }
    // Use the loaded pipeline function
    const summarizer = await pipelineInstance('summarization', 'Xenova/bart-large-cnn');
    console.log('BART model initialized');

    const truncatedText = text.slice(0, 5000);

    console.log('Generating summary with BART...');
    const result = await summarizer(truncatedText, { max_length: 300, min_length: 50, do_sample: false });
    return result[0].summary_text;
  } catch (error) {
    throw new Error('Error generating summary: ' + error.message);
  }
}

// --- Health Check & Frontend Serve ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// app.get('/', (req, res) => {
//   res.sendFile(path.join('/public', 'index.html'));
// });

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});