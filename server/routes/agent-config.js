const express = require('express');
const router = express.Router();
const { getConfig, setConfig, setConfigBatch } = require('../services/db');

// Get current config (mask API key)
router.get('/', (req, res) => {
  const cfg = getConfig();
  // Don't send full API key to frontend for security, only whether it's configured
  const safe = { ...cfg };
  if (safe.apiKey) {
    safe.apiKeyConfigured = true;
    safe.apiKeyPreview = safe.apiKey.slice(0, 6) + '...' + safe.apiKey.slice(-4);
    delete safe.apiKey;
  } else {
    safe.apiKeyConfigured = false;
    safe.apiKeyPreview = '';
  }
  res.json(safe);
});

// Update config
router.post('/', (req, res) => {
  const updates = req.body;
  const allowed = ['provider', 'apiKey', 'model', 'baseUrl', 'temperature', 'systemPrompt',
    'knowledgeEnabled', 'knowledgeInternalData', 'knowledgeMaxChunks'];
  const entries = [];
  for (const [key, value] of Object.entries(updates)) {
    if (allowed.includes(key)) {
      entries.push([key, value]);
    }
  }
  if (entries.length) {
    setConfigBatch(entries);
  }
  const cfg = getConfig();
  res.json({ ok: true, provider: cfg.provider, model: cfg.model });
});

// Test connection
router.post('/test', async (req, res) => {
  try {
    const { callLLM } = require('../services/llm');
    const resp = await callLLM([
      { role: 'user', content: '回复"连接成功"两个字即可' }
    ], [], false);
    res.json({ ok: true, message: resp.message?.content || '连接成功' });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
