const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();

// Use PORT from environment (Railway/Render sets this)
const PORT = process.env.PORT || 3001;

// JWT secret from env, with dev fallback
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors()); // for dev; later you can restrict origin
app.use(express.json());

const db = new sqlite3.Database('./database.db');

// Create tables
db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT, email TEXT UNIQUE, password_hash TEXT)`);
db.run(`CREATE TABLE IF NOT EXISTS user_profiles (id TEXT, user_id TEXT, name TEXT)`);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Test
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Backend working!' });
});

// Seed
app.get('/api/seed', async (req, res) => {
  const userId = generateId();
  const hash = await bcrypt.hash('password123', 10);

  db.run('INSERT OR IGNORE INTO users VALUES (?, ?, ?)', [userId, 'jay@test.com', hash]);
  db.run('INSERT OR IGNORE INTO user_profiles VALUES (?, ?, ?)', [generateId(), userId, '阿傑']);

  res.json({ success: true, message: 'Seed done!' });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ success: false, error: 'DB error' });
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ success: true, token });
  });
});

// Signup
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  const userId = generateId();
  const hash = await bcrypt.hash(password, 10);

  db.run('INSERT INTO users VALUES (?, ?, ?)', [userId, email, hash], (err) => {
    if (err) {
      console.error(err);
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }

    db.run('INSERT INTO user_profiles VALUES (?, ?, ?)', [generateId(), userId, name]);

    const token = jwt.sign({ userId }, JWT_SECRET);
    res.json({ success: true, token });
  });
});

// Profile
app.get('/api/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    db.get('SELECT * FROM user_profiles WHERE user_id = ?', [decoded.userId], (err, profile) => {
      if (err || !profile) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }
      res.json({ success: true, profile });
    });
  } catch (error) {
    res.status(403).json({ success: false, error: 'Invalid token' });
  }
});

app.listen(PORT, () => {
  console.log('✅ Database connected');
  console.log(`🚀 Backend server running on port ${PORT}`);
});
