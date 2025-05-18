const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const router = express.Router();
require('dotenv').config();

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

router.post('/register', (req, res) => {
  const { username, password } = req.body;

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ success: false, message: 'Error hashing password' });

    pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], (error) => {
      if (error) return res.status(500).json({ success: false, message: 'Error registering user' });
      res.json({ success: true, message: 'User registered successfully' });
    });
  });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  pool.query('SELECT * FROM users WHERE username = ?', [username], (error, results) => {
    if (error) return res.status(500).json({ success: false, message: 'Error retrieving user' });
    if (results.length === 0) return res.status(401).json({ success: false, message: 'Authentication failed' });

    const user = results[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return res.status(500).json({ success: false, message: 'Error checking password' });
      if (!isMatch) return res.status(401).json({ success: false, message: 'Authentication failed' });

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ success: true, message: 'Logged in successfully', token });
    });
  });
});

module.exports = router;