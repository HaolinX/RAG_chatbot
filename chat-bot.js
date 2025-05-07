// DOM Elements
const uploadButton = document.getElementById('uploadButton');
const uploadModal = document.getElementById('uploadModal');
const closeUploadModal = document.getElementById('closeUploadModal');
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const selectFileButton = document.getElementById('selectFileButton');
const uploadStatus = document.getElementById('uploadStatus');

const summaryModal = document.getElementById('summaryModal');
const closeSummaryModal = document.getElementById('closeSummaryModal');
const summaryStatus = document.getElementById('summaryStatus');
const summaryContent = document.getElementById('summaryContent');

const questionInputContainer = document.getElementById('questionInputContainer');
const questionInput = document.getElementById('questionInput');
const askButton = document.getElementById('askButton');
const answerContainer = document.getElementById('answerContainer');
const answerContent = document.getElementById('answerContent');
const qaStatus = document.getElementById('qaStatus');

const chatMessages = document.getElementById('chatMessages');

// Global variables
let currentFileName = null;

// Event Listeners
uploadButton.addEventListener('click', () => uploadModal.classList.remove('hidden'));
closeUploadModal.addEventListener('click', () => uploadModal.classList.add('hidden'));
closeSummaryModal.addEventListener('click', () => summaryModal.classList.add('hidden'));
selectFileButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
askButton.addEventListener('click', askQuestion);

// Drag and Drop handlers
dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.classList.add('highlight');
});

dropArea.addEventListener('dragleave', () => {
    dropArea.classList.remove('highlight');
});

dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.classList.remove('highlight');
    
    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type === 'application/pdf') {
            handleFile(file);
        } else {
            uploadStatus.textContent = 'Please upload a PDF file.';
            uploadStatus.style.color = '#ef4444';
        }
    }
});

// Handle file selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// Process the selected file
function handleFile(file) {
    uploadStatus.textContent = `Selected: ${file.name} (${formatSize(file.size)})`;
    uploadStatus.style.color = '#f8f8f8';

    // Convert to base64
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64PDF = e.target.result;
        uploadPDF(base64PDF, file.name);
    };
    reader.readAsDataURL(file);
}

// Format file size
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Upload PDF to server
async function uploadPDF(base64PDF, filename) {
    uploadStatus.textContent = 'Uploading and processing document...';
    uploadStatus.style.color = '#f8f8f8';
    
    // Show summary modal with loading state
    summaryModal.classList.remove('hidden');
    summaryStatus.classList.remove('hidden');
    summaryContent.classList.add('hidden');

    try {
        const response = await fetch('http://localhost:3001/upload-base64', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                base64PDF,
                filename
            }),
        });

        const data = await response.json();
        console.log("Response data:", data);

        if (response.ok) {
            uploadStatus.textContent = 'Processing complete!';
            uploadStatus.style.color = '#10b981';
            currentFileName = data.filename;

            // Hide upload modal after successful upload
            uploadModal.classList.add('hidden');
            uploadButton.classList.add('hidden');
            dropArea.classList.add('hidden');
            selectFileButton.classList.add('hidden');

            // Display summary
            if (data.summary) {
                summaryStatus.classList.add('hidden');
                summaryContent.textContent = data.summary;
                summaryContent.classList.remove('hidden');
                
                // Add a message to chat
                addBotMessage(`I've processed your document "${filename}". Here's the summary:`);
                
                // Enable question input
                questionInputContainer.classList.remove('hidden');
            } else {
                summaryContent.textContent = "No summary available for this document.";
                summaryContent.classList.remove('hidden');
            }
        } else {
            uploadStatus.textContent = `Error: ${data.error || 'Failed to process PDF'}`;
            uploadStatus.style.color = '#ef4444';
            summaryStatus.textContent = 'Failed to process document';
        }
    } catch (error) {
        console.error('Error:', error);
        uploadStatus.textContent = 'Error processing PDF. Please try again.';
        uploadStatus.style.color = '#ef4444';
        summaryStatus.textContent = 'Error processing document';
    }
}

// Ask a question
async function askQuestion() {
    const question = questionInput.value.trim();

    if (!question) {
        alert('Please enter a question.');
        return;
    }

    if (!currentFileName) {
        alert('Please upload a PDF first.');
        return;
    }

    // Show loading state
    answerContainer.classList.remove('hidden');
    qaStatus.innerHTML = '<div class="spinner"></div><p>Processing your question...</p>';
    answerContent.textContent = '';
    askButton.disabled = true;

    // Add user question to chat
    addUserMessage(question);

    try {
        const response = await fetch('http://localhost:3001/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question,
                filename: currentFileName
            }),
        });

        const data = await response.json();
        console.log("Question response:", data);

        if (response.ok) {
            qaStatus.classList.add('hidden');
            answerContent.textContent = data.answer || "No answer found.";
            
            // Add bot answer to chat
            addBotMessage(data.answer);
        } else {
            qaStatus.innerHTML = `<p>Error: ${data.error || 'Failed to process question'}</p>`;
        }
    } catch (error) {
        console.error('Error:', error);
        qaStatus.innerHTML = '<p>Error processing question. Please try again.</p>';
    } finally {
        askButton.disabled = false;
        questionInput.value = '';
    }
}

// Add message to chat
function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `<p>${text}</p>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `<p>${text}</p>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('RAGBot initialized');
});