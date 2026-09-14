const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const knowledge = require('../services/knowledge');

const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.txt', '.md', '.docx', '.doc', '.json', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('不支持的文件类型，支持 PDF/TXT/MD/DOCX/JSON/CSV'));
  }
});

// Upload a document
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: '未收到文件' });
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const result = await knowledge.addDocument(
      req.file.originalname,
      req.file.path,
      ext,
      req.file.size,
      req.body.knowledgeId,
      req.body.folderId,
      req.body.relativePath
    );
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Add manual knowledge entry
router.post('/entry', (req, res) => {
  try {
    const { title, content, tags, knowledgeId } = req.body;
    if (!title || !content) return res.status(400).json({ ok: false, error: '标题和内容必填' });
    const result = knowledge.addManualEntry(title, content, tags || [], knowledgeId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// List all documents
router.get('/documents', (req, res) => {
  res.json({ ok: true, documents: knowledge.listDocuments(req.query.knowledgeId, req.query.folderId) });
});

// List manual entries
router.get('/entries', (req, res) => {
  res.json({ ok: true, entries: knowledge.listEntries(req.query.knowledgeId) });
});

// Delete a document
router.delete('/documents/:id', (req, res) => {
  const ok = knowledge.deleteDocument(req.params.id, req.query.knowledgeId);
  res.json({ ok });
});

// Delete an entry
router.delete('/entries/:id', (req, res) => {
  const ok = knowledge.deleteEntry(req.params.id, req.query.knowledgeId);
  res.json({ ok });
});

// Search knowledge (for testing/debugging)
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const max = parseInt(req.query.max) || 5;
    const results = await knowledge.retrieveRelevant(q, max, req.query.knowledgeId);
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Re-index a document (re-generate embeddings)
router.post('/reindex/:id', async (req, res) => {
  try {
    await knowledge.generateEmbeddings(req.params.id, req.query.knowledgeId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
