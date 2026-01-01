import express from 'express';
import pg from 'pg';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve Static Frontend Files (Check if dist exists first to avoid crash)
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  console.warn('WARNING: ../dist folder not found. Frontend will not be served.');
}

// Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- AUTOMATIC DB MIGRATION ---
const initDb = async () => {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS landing_pages (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          title VARCHAR(255) NOT NULL,
          slug VARCHAR(255) UNIQUE NOT NULL,
          content JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('>>> Database tables checked/initialized successfully.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('>>> CRITICAL: Error initializing database tables:', err);
  }
};
// Initialize DB on startup
initDb();

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
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Usuário já existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // First user is admin automatically
    const role = (await pool.query('SELECT COUNT(*) FROM users')).rows[0].count === '0' ? 'admin' : 'user';
    
    const result = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hashedPassword, role]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).send('Usuário não encontrado');

    const user = result.rows[0];
    if (await bcrypt.compare(password, user.password)) {
      const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
      res.json({ accessToken, user: { id: user.id, email: user.email, role: user.role } });
    } else {
      res.status(403).send('Senha incorreta');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
});

// Admin Stats
app.get('/admin/stats', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    const pagesCount = await pool.query('SELECT COUNT(*) FROM landing_pages');
    const usersList = await pool.query('SELECT id, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 50');
    
    res.json({
      totalUsers: parseInt(usersCount.rows[0].count),
      totalPages: parseInt(pagesCount.rows[0].count),
      users: usersList.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// User Pages
app.get('/pages', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM landing_pages WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Generate Page
app.post('/pages/generate', authenticateToken, async (req, res) => {
  try {
    const { companyName, niche, targetAudience, goal } = req.body;
    
    if (!process.env.API_KEY) {
        console.error("API KEY missing");
        return res.status(500).json({error: "Configuração de servidor inválida (API Key)"});
    }

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

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });

    const contentText = response.text;
    let content;
    try {
       content = JSON.parse(contentText);
    } catch (e) {
       const cleanText = contentText.replace(/```json/g, '').replace(/```/g, '');
       content = JSON.parse(cleanText);
    }

    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36).substring(0, 5);
    
    const result = await pool.query(
      'INSERT INTO landing_pages (user_id, title, slug, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, companyName, slug, content]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Generation Error:", error);
    res.status(500).json({ error: "Falha ao gerar página. Tente novamente." });
  }
});

// Update Page
app.put('/pages/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        
        const check = await pool.query('SELECT * FROM landing_pages WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        if (check.rows.length === 0) return res.status(404).send('Página não encontrada');

        const result = await pool.query(
            'UPDATE landing_pages SET content = $1 WHERE id = $2 RETURNING *',
            [content, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// CATCH-ALL ROUTE (Must be last)
// Handles frontend routing
app.get('*', (req, res) => {
    // API 404
    if (req.path.startsWith('/auth') || req.path.startsWith('/pages') || req.path.startsWith('/admin')) {
        return res.status(404).json({ error: 'Endpoint not found' });
    }
    
    const indexPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(500).send(`
            <h1>Erro 500 - Frontend Build Not Found</h1>
            <p>O servidor está rodando, mas a interface (frontend) não foi encontrada.</p>
            <p>Certifique-se de que rodou <code>npm run build</code> no servidor.</p>
        `);
    }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});