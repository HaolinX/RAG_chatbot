const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Register
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  const pool = req.app.get('pool');

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ message: 'Encryption error' });

    pool.query(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      [username, hash],
      (error, results) => {
        if (error) return res.status(500).json({ message: 'DB error' });
        res.json({ message: 'User registered', userId: results.insertId });
      }
    );
  });
});

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const pool = req.app.get('pool');

  pool.query('SELECT * FROM users WHERE username = ?', [username], (error, results) => {
    if (error) return res.status(500).json({ message: 'DB error' });
    if (results.length === 0) return res.status(401).json({ message: 'Authentication failed' });

    const user = results[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) return res.status(500).json({ message: 'Encryption error' });
      if (isMatch) res.json({ message: 'Login successful' });
      else res.status(401).json({ message: 'Authentication failed' });
    });
  });
});

module.exports = router;