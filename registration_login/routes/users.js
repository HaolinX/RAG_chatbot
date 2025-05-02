const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Register endpoint
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  const pool = req.app.get('pool');
  
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).send({ message: 'Encryption error' });
    
    pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], (error, results) => {
      if (error) {
        console.error('Registration error:', error);
        return res.status(500).send({ message: 'Database error' });
      }
      res.send({ message: 'User registered', userId: results.insertId });
    });
  });
});

// Login endpoint
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const pool = req.app.get('pool');
  
  pool.query('SELECT * FROM users WHERE username = ?', [username], (error, results) => {
    if (error) {
      console.error('Login query error:', error);
      return res.status(500).send({ message: 'Database error' });
    }
    
    if (results.length === 0) {
      return res.status(401).send({ message: 'Authentication failed' });
    }
    
    const user = results[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Password comparison error:', err);
        return res.status(500).send({ message: 'Authentication error' });
      }
      
      if (isMatch) {
        res.send({ message: 'Login successful' });
      } else {
        res.status(401).send({ message: 'Authentication failed' });
      }
    });
  });
});

module.exports = router;