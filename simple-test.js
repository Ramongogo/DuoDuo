const express = require('express'); 
const cors = require('cors'); 
const app = express(); 
app.use(cors()); 
app.use(express.json()); 
app.get('/api/test', (req, res) => res.json({success: true})); 
app.listen(3001, () => console.log('Server running')); 
