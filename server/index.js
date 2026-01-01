/**
 * BACKEND SERVER IMPLEMENTATION
 * This file is intended to run in a Node.js environment.
 * Dependencies: express, pg, cors, bcrypt, jsonwebtoken, @google/genai, dotenv
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jwt');
const { GoogleGenAI, Type } = require('@google/genai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.sendStatus(403);
  next();
};

// --- ROUTES ---

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, role',
      [email, hashedPassword]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).send('Cannot find user');

    const user = result.rows[0];
    if (await bcrypt.compare(password, user.password)) {
      const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET);
      res.json({ accessToken, user: { id: user.id, email: user.email, role: user.role } });
    } else {
      res.send('Not Allowed');
    }
  } catch (error) {
    res.status(500).send();
  }
});

// Admin Dashboard Stats
app.get('/admin/stats', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    const pagesCount = await pool.query('SELECT COUNT(*) FROM landing_pages');
    const usersList = await pool.query('SELECT id, email, role, created_at FROM users ORDER BY created_at DESC');
    
    res.json({
      totalUsers: usersCount.rows[0].count,
      totalPages: pagesCount.rows[0].count,
      users: usersList.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User Landing Pages
app.get('/pages', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM landing_pages WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Landing Page (AI)
app.post('/pages/generate', authenticateToken, async (req, res) => {
  try {
    const { companyName, niche, targetAudience, goal } = req.body;
    const prompt = `
      Crie uma estrutura de conteúdo para uma Landing Page de alta conversão para uma empresa chamada "${companyName}".
      Nicho: ${niche}.
      Público Alvo: ${targetAudience}.
      Objetivo: ${goal}.
      
      RETORNE APENAS JSON VÁLIDO (sem blocos de código markdown) seguindo estritamente este esquema em PORTUGUÊS DO BRASIL:
      {
        "headline": "H1 Convincente",
        "subheadline": "H2 Persuasivo",
        "ctaText": "Texto do botão de chamada para ação",
        "benefits": [{"title": "Benefício 1", "description": "Detalhes"}],
        "testimonials": [{"name": "Nome", "role": "Cargo", "quote": "Depoimento curto e positivo"}],
        "colors": {"primary": "CódigoHex", "secondary": "CódigoHex", "background": "CódigoHex", "text": "CódigoHex"}
      }
    `;

    const model = 'gemini-2.5-flash-latest'; 
    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });

    const content = JSON.parse(response.text);
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
    
    const result = await pool.query(
      'INSERT INTO landing_pages (user_id, title, slug, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, companyName, slug, content]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate page" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});