# RAG_chatbot

RAG_chatbot is an interactive web application that allows users to upload PDF documents and chat with an AI assistant. Using Retrieval-Augmented Generation (RAG), the chatbot answers questions based on the uploaded content, providing intelligent, document-aware assistance.

---

## ✨ Features

- 🧠 Chat with a custom AI powered by OpenAI + vector embeddings
- 📄 Upload PDF files and generate summaries automatically
- 🔍 Ask questions directly based on document content
- 🔒 Login/Register system with secure JWT authentication
- 🛠️ Built with plain HTML/CSS/JS and Node.js
- 🐬 MySQL for user management and authentication

---

## ⚙️ Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/HaolinX/RAG_chatbot.git
cd RAG_chatbot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure your `.env` file

Create a `.env` file in the root directory with the following content:

```
PORT=8232

# MySQL Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_DATABASE=RAG_chatbot
DB_PORT=3306

# JWT Secret
JWT_SECRET=your_jwt_secret

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key
```

### 4. Create MySQL Database

Log into your MySQL terminal:

```sql
CREATE DATABASE RAG_chatbot;
USE RAG_chatbot;
```

The necessary `users` table will be automatically created when the app starts.

### 5. Start the server

```bash
node backend/app.js
```

Visit `http://localhost:8232` to use the app.

---

## 🧪 Developer Notes

- The app runs **locally only**, using Node.js for the backend server.
- `.env` variables are injected using `dotenv`, including DB, JWT, and OpenAI credentials.
- The chatbot uses **Xenova/all-MiniLM-L6-v2** for embeddings (via Transformers.js) and **facebook/bart-large-cnn** for summarization.
- File uploads are stored in the `/uploads` directory. Vector stores are saved in `/vectorstore`.

---

## 👥 Team Credits

Project built by:

- **Daniel** (Frontend)
- **Kunj** (Backend)
- **Jayden(Haolin)** (Frontend)
- **Julian** (Backend)

> Note: After the semester ended, I(Haolin) took initiative to refactor and enhance both the frontend and backend code over the summer.

---

## 📌 License

This project was developed as part of a CSC Web Development course. For personal and educational use only.