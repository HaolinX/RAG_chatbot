// app.js - Main server file
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
// REMOVED: const { pipeline } = require('@xenova/transformers'); // Cannot require ESM

// --- LangChain Imports ---
const { FaissStore } = require("@langchain/community/vectorstores/faiss");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { PromptTemplate } = require("@langchain/core/prompts");
const { loadQAStuffChain } = require("langchain/chains");
const { ChatOpenAI } = require("@langchain/openai");
const { Embeddings } = require("@langchain/core/embeddings");
const { OpenAI: OpenAIDirectClient } = require('openai');

// --- App Setup ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- OpenAI Clients ---
const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o-mini",
});
const openaiDirect = new OpenAIDirectClient({
  apiKey: process.env.OPENAI_API_KEY
});

// --- Middleware ---
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// --- Custom Transformer Embeddings ---
// Variable to hold the dynamically imported pipeline function
let pipelineInstance = null;

class TransformerEmbeddings extends Embeddings {
  constructor(modelName = 'Xenova/all-MiniLM-L6-v2') {
    super({});
    this.modelName = modelName;
    this.embeddingPipeline = null;
  }

  async init() {
    if (!this.embeddingPipeline) {
      console.log(`Loading embedding model: ${this.modelName}...`);
      // Dynamically import pipeline ONCE if needed
      if (!pipelineInstance) {
        const transformers = await import('@xenova/transformers');
        pipelineInstance = transformers.pipeline;
        console.log('Transformer pipeline function loaded.');
      }
      // Use the loaded pipeline function
      this.embeddingPipeline = await pipelineInstance('feature-extraction', this.modelName);
      console.log('Embedding model loaded successfully!');
    }
    return this;
  }

  async _embed(texts) {
    await this.init();
    const embeddings = [];
    for (const text of texts) {
      const result = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });
      embeddings.push(Array.from(result.data));
    }
    return embeddings;
  }

  embedDocuments(texts) {
    return this._embed(texts);
  }

  async embedQuery(text) {
    await this.init();
    const result = await this.embeddingPipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }
}
const embeddings = new TransformerEmbeddings();

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
    await processPDF(req, res);
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
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const docs = await textSplitter.createDocuments([text], [{ source: req.file.filename }]);

    console.log('Creating embeddings and vector store...');
    await embeddings.init();
    const vectorStore = await FaissStore.fromDocuments(docs, embeddings);

    const vectorStorePath = `vectorstore/${path.basename(req.file.filename, '.pdf')}`;
    await vectorStore.save(vectorStorePath);
    console.log(`Vector store saved to: ${vectorStorePath}`);

    console.log('Generating summary...');
    const summary = await generateBARTSummary(text);

    res.json({
      message: 'PDF uploaded and processed successfully',
      filename: req.file.filename,
      summary: summary
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).json({ error: 'Error processing PDF: ' + error.message });
  }
}

// --- Q&A Endpoint ---
app.post('/ask', async (req, res) => {
  try {
    const { question, filename } = req.body;
    if (!question || !filename) return res.status(400).json({ error: 'Question and filename are required' });

    const vectorStorePath = `vectorstore/${path.basename(filename, '.pdf')}`;
    if (!fs.existsSync(vectorStorePath)) {
         return res.status(404).json({ error: `Vector store for ${filename} not found. Please process the PDF first.` });
    }

    console.log(`Loading vector store from: ${vectorStorePath}`);
    await embeddings.init(); // Ensure model is ready before loading store needing it
    const vectorStore = await FaissStore.load(vectorStorePath, embeddings);

    console.log('Searching for relevant context...');
    const relevantDocs = await vectorStore.similaritySearch(question, 4);
    console.log(`Found ${relevantDocs.length} relevant documents`);

    if (relevantDocs.length === 0) {
        return res.json({ answer: "Could not find relevant information in the document to answer that question." });
    }

    const template = `Answer the question based only on the following context:
    {context}
    Question: {question}
    Answer:`;
    const prompt = PromptTemplate.fromTemplate(template);
    const chain = loadQAStuffChain(llm, { prompt: prompt });

    console.log('Generating answer...');
    const result = await chain.invoke({
      input_documents: relevantDocs,
      question: question,
    });

    console.log('Answer generated');
    res.json({
      answer: result.output_text
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
    // Dynamically import pipeline ONCE if needed
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
    const result = await summarizer(truncatedText, { max_length: 150, min_length: 30, do_sample: false });
    return result[0].summary_text;
  } catch (error) {
    console.error('Error generating BART summary:', error);
    console.log('Falling back to OpenAI for summary generation...');
    try {
      const response = await openaiDirect.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful AI that summarizes academic papers and research documents concisely." },
          { role: "user", content: `Please summarize the following text:\n\n${text.slice(0, 15000)}` }
        ],
        max_tokens: 300
      });
      return response.choices[0].message.content + " (Generated by OpenAI fallback)";
    } catch (fallbackError) {
      console.error('Fallback summarization also failed:', fallbackError);
      return 'Unable to generate summary due to processing errors.';
    }
  }
}

// --- Health Check & Frontend Serve ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // No need to init embeddings here anymore, it happens on demand.
});