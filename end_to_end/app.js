const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
require('dotenv').config();

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());

app.use('/api/auth', authRoutes);

const PORT = 8232;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));