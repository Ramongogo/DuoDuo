const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { DatabaseSync } = require('node:sqlite'); // built-in in Node 22+

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors());
app.use(express.json());

// ---------- DB SETUP (node:sqlite) ----------
const db = new DatabaseSync('database.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT
  );
`);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---------- ROUTES ----------

// Health check
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Backend working with node:sqlite!' });
});

// Seed demo user
app.get('/api/seed', async (req, res) => {
  try {
    const userId = generateId();
    const hash = await bcrypt.hash('password123', 10);

    db.prepare(
      'INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)'
    ).run(userId, 'jay@test.com', hash);

    db.prepare(
      'INSERT OR IGNORE INTO user_profiles (id, user_id, name) VALUES (?, ?, ?)'
    ).run(generateId(), userId, '阿傑');

    res.json({ success: true, message: 'Seed done!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Seed failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email); // no finalize()

    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ success: true, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'DB error' });
  }
});

// Signup
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  const userId = generateId();

  try {
    const hash = await bcrypt.hash(password, 10);

    db.prepare(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)'
    ).run(userId, email, hash);

    db.prepare(
      'INSERT INTO user_profiles (id, user_id, name) VALUES (?, ?, ?)'
    ).run(generateId(), userId, name);

    const token = jwt.sign({ userId }, JWT_SECRET);
    res.json({ success: true, token });
  } catch (err) {
    console.error('Signup error:', err);
    const msg = String(err);
    if (msg.includes('UNIQUE constraint failed: users.email')) {
      return res
        .status(400)
        .json({ success: false, error: 'Email already exists' });
    }
    res.status(500).json({ success: false, error: 'DB error' });
  }
});

// Profile
app.get('/api/profile', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const stmt = db.prepare(
      'SELECT * FROM user_profiles WHERE user_id = ?'
    );
    const profile = stmt.get(decoded.userId);

    if (!profile) {
      return res
        .status(404)
        .json({ success: false, error: 'Profile not found' });
    }

    res.json({ success: true, profile });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(403).json({ success: false, error: 'Invalid token' });
  }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log('✅ Database connected via node:sqlite');
  console.log(`🚀 Backend server running on port ${PORT}`);
});
