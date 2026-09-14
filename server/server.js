const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const chatRoute = require('./routes/chat');
const configRoute = require('./routes/agent-config');
const knowledgeRoute = require('./routes/knowledge');
const skillsRoute = require('./routes/skills');
const workflowsRoute = require('./routes/workflows');
const { initDB } = require('./services/db');
const { startWorkflowEngine } = require('./services/workflow');

const app = express();
const PORT = process.env.LIFEOS_PORT || 4174;

// Ensure data directories exist
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
[uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Init SQLite
initDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/chat', chatRoute);
app.use('/api/agent-config', configRoute);
app.use('/api/knowledge', knowledgeRoute);
app.use('/api/skills', skillsRoute);
app.use('/api/workflows', workflowsRoute);

// Serve static frontend (index.html)
app.use(express.static(path.join(__dirname, '..')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start workflow scheduler
startWorkflowEngine();

app.listen(PORT, '127.0.0.1', () => {
  console.log(`LifeOS server running at http://127.0.0.1:${PORT}`);
  console.log(`API endpoints: /api/chat, /api/agent-config, /api/knowledge, /api/skills, /api/workflows`);
});
