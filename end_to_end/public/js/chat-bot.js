// DOM Elements
const uploadButton = document.getElementById('uploadButton');
const uploadModal = document.getElementById('uploadModal');
const closeUploadModal = document.getElementById('closeUploadModal');
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const selectFileButton = document.getElementById('selectFileButton');
const uploadStatus = document.getElementById('uploadStatus');
const chatArea = document.getElementById('chatArea');
const questionInput = document.getElementById('questionInput');
const askButton = document.getElementById('askButton');

// API endpoint base URL
const API_URL = 'http://localhost:8277';

// Global variables
let currentFileName = null;

// Event Listeners
uploadButton.addEventListener('click', () => uploadModal.classList.remove('hidden'));
closeUploadModal.addEventListener('click', () => uploadModal.classList.add('hidden'));
selectFileButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
askButton.addEventListener('click', handleQuestion);
questionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleQuestion();
    }
});

// Drag and Drop handlers
dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.style.borderColor = '#2563eb';
});

dropArea.addEventListener('dragleave', () => {
    dropArea.style.borderColor = '';
});

dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.style.borderColor = '';
    
    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type === 'application/pdf') {
            handleFile(file);
        } else {
            showError('Please upload a PDF file.');
        }
    }
});

// Handle file selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
}

// Process the selected file
function handleFile(file) {
    if (file.type !== 'application/pdf') {
        showError('Please upload a PDF file.');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showError('File size must be less than 10MB.');
        return;
    }

    uploadPDF(file);
}

// Show error in upload status
function showError(message) {
    uploadStatus.textContent = message;
    uploadStatus.style.backgroundColor = '#ef4444';
    uploadStatus.classList.remove('hidden');
}

// Upload PDF to server
async function uploadPDF(file) {
    const formData = new FormData();
    formData.append('pdf', file);
    
    // Get auth token
    const token = getAuthToken();
    if (!token) {
        showError('Please log in to upload files.');
        return;
    }
    
    uploadStatus.textContent = 'Uploading...';
    uploadStatus.style.backgroundColor = '';
    uploadStatus.classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        
        if (response.ok) {
            currentFileName = data.filename;
            uploadStatus.textContent = 'Upload successful! You can now ask questions.';
            uploadStatus.style.backgroundColor = '#22c55e';
            setTimeout(() => {
                uploadModal.classList.add('hidden');
                addMessage('bot', `PDF uploaded successfully. ${data.summary ? 'Summary: ' + data.summary : 'What would you like to know about it?'}`);
            }, 1500);
        } else {
            showError(data.error || 'Upload failed. Please try again.');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showError('Connection error. Please try again.');
    }
}

// Handle question submission
async function handleQuestion() {
    const question = questionInput.value.trim();
    if (!question) return;
    
    // Check authentication
    const token = getAuthToken();
    if (!token) {
        addMessage('bot', 'Please log in to ask questions.');
        return;
    }
    
    if (!currentFileName) {
        addMessage('bot', 'Please upload a PDF first.');
        return;
    }
    
    addMessage('user', question);
    questionInput.value = '';
    askButton.disabled = true;
    
    try {
        const response = await fetch(`${API_URL}/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                question: question,
                filename: currentFileName 
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            addMessage('bot', data.answer);
        } else {
            addMessage('bot', data.error || 'Sorry, I encountered an error. Please try again.');
        }
    } catch (error) {
        console.error('Chat error:', error);
        addMessage('bot', 'Connection error. Please try again.');
    } finally {
        askButton.disabled = false;
    }
}

function getAuthToken() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No authentication token found');
        return null;
    }
    return token;
}

// Add message to chat
function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    chatArea.appendChild(messageDiv);
    messageDiv.scrollIntoView({ behavior: 'smooth' });
}

// Initialize the chat interface
document.addEventListener('DOMContentLoaded', () => {
    addMessage('bot', 'Welcome! Please upload a PDF to start asking questions.');
});