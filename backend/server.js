require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── PostgreSQL Connection ───────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// ─── Create Table on Startup ─────────────────────────────────────────────────
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id        SERIAL PRIMARY KEY,
        name      VARCHAR(100) NOT NULL,
        email     VARCHAR(150) NOT NULL,
        phone     VARCHAR(20)  NOT NULL,
        message   TEXT         NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ Database table ready');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
  }
}

initDB();

// ─── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'WhoAmI Backend API v2',
    endpoints: { health: '/health', submit: 'POST /api/contact' }
  });
});

// Submit contact form
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body;

  // Basic validation
  if (!name || !email || !phone || !message) {
    return res.status(400).json({ success: false, error: 'All fields are required.' });
  }

  // Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO contacts (name, email, phone, message) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [name.trim(), email.trim().toLowerCase(), phone.trim(), message.trim()]
    );

    res.status(201).json({
      success: true,
      message: 'Your message has been saved successfully!',
      id: result.rows[0].id,
      submitted_at: result.rows[0].created_at
    });
  } catch (err) {
    console.error('DB insert error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to save your message. Please try again.' });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
