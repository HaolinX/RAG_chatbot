const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token.' });
    }
};

// Log all auth requests
router.use((req, res, next) => {
    console.log(`[AUTH] ${req.method} ${req.originalUrl} - Body:`, req.body);
    next();
});

// Test database connection and create table
const initDatabase = async () => {
    try {
        // Check if required environment variables exist
        const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.error(`ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
            console.error('Please check your .env file and restart the server.');
            return false;
        }
        
        // Try to connect to the database
        console.log('Connecting to database...');
        console.log(`Host: ${process.env.DB_HOST}, Database: ${process.env.DB_DATABASE}, User: ${process.env.DB_USER}`);
        
        const connection = await pool.getConnection();
        console.log('Successfully connected to database');
        
        // Create users table if not exists
        await connection.query(`
            CREATE TABLE IF NOT EXISTS ragbot (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table users is ready');
        connection.release();
        return true;
    } catch (err) {
        console.error('❌ Database initialization error:', err.message);
        
        // More detailed error reporting
        if (err.code === 'ECONNREFUSED') {
            console.error('Could not connect to MySQL server. Is it running? Check your host and port settings.');
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Access denied. Check your username and password.');
        } else if (err.code === 'ER_BAD_DB_ERROR') {
            console.error(`Database '${process.env.DB_DATABASE}' does not exist. Create it first.`);
        }
        
        console.error('Connection details:', {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_DATABASE,
            port: process.env.DB_PORT || 3306
        });
        return false;
    }
};

// Registration endpoint
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('[AUTH] Register attempt:', username);

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Check if user already exists
        const [users] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (users.length > 0) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        await pool.execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword]
        );

        res.status(201).json({ message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('[AUTH] Login attempt:', username);

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Get user
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed: ' + error.message });
    }
});

// Get current user endpoint (protected route example)
router.get('/me', verifyToken, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, username, created_at FROM users WHERE id = ?',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: users[0] });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// Catch-all error handler for auth
router.use((err, req, res, next) => {
    console.error('[AUTH] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
});

module.exports = { router, verifyToken, initDatabase };