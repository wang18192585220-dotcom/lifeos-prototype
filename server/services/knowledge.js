const fs = require('fs');
const path = require('path');
const db = require('./db');
const { getEmbedding } = require('./llm');

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= size) return [clean];
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    chunks.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

async function parseFile(filePath, fileType) {
  const ext = (fileType || '').toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === 'pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (e) {
      console.warn('PDF parse failed, fallback:', e.message);
      return buffer.toString('utf8');
    }
  }
  if (ext === 'docx' || ext === 'doc') {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    } catch (e) {
      console.warn('DOCX parse failed:', e.message);
      return buffer.toString('utf8');
    }
  }
  return buffer.toString('utf8');
}

function normalizeKnowledgeId(knowledgeId) {
  return knowledgeId || 'global';
}

function belongsToKnowledge(item, knowledgeId) {
  if (knowledgeId === undefined) return true;
  return normalizeKnowledgeId(item.knowledgeId) === normalizeKnowledgeId(knowledgeId);
}

async function addDocument(originalName, filePath, fileType, fileSize, knowledgeId, folderId = '', relativePath = '') {
  const text = await parseFile(filePath, fileType);
  const chunks = chunkText(text);
  const filename = path.basename(filePath);
  const ownerId = normalizeKnowledgeId(knowledgeId);
  const ownerFolderId = folderId || '';
  const sourcePath = relativePath || '';

  const doc = db.insertDocument({
    filename,
    originalName,
    fileType,
    fileSize,
    knowledgeId: ownerId,
    folderId: ownerFolderId,
    relativePath: sourcePath,
    chunkCount: chunks.length,
    status: 'indexing',
  });

  const chunkRows = chunks.map((content, i) => ({
    docId: doc.id,
    knowledgeId: ownerId,
    folderId: ownerFolderId,
    chunkIndex: i,
    content,
    embedding: null,
    createdAt: Date.now(),
  }));
  db.insertChunks(chunkRows);

  // 异步生成向量
  generateEmbeddings(doc.id).catch((err) => {
    console.error('Embedding generation failed:', err.message);
    db.updateDocument(doc.id, { status: 'ready' });
  });

  return { docId: doc.id, chunkCount: chunks.length };
}

async function generateEmbeddings(docId, knowledgeId) {
  const doc = db.getDocument(docId);
  if (!doc || !belongsToKnowledge(doc, knowledgeId)) throw new Error('文档不存在');
  const ownerId = normalizeKnowledgeId(doc.knowledgeId);
  const chunks = db.listChunks(docId);
  for (const chunk of chunks) {
    const emb = await getEmbedding(chunk.content);
    const patch = { knowledgeId: ownerId };
    if (emb) patch.embedding = JSON.stringify(emb);
    db.updateChunk(chunk.id, patch);
  }
  db.updateDocument(docId, { status: 'ready', knowledgeId: ownerId });
}

function addManualEntry(title, content, tags = '', knowledgeId) {
  const tagStr = Array.isArray(tags) ? tags.join(',') : tags;
  const ownerId = normalizeKnowledgeId(knowledgeId);
  const entry = db.insertEntry({ title, content, tags: tagStr, knowledgeId: ownerId });
  const [chunk] = db.insertChunks([
    {
      docId: 'entry_' + entry.id,
      knowledgeId: ownerId,
      chunkIndex: 0,
      content: `${title}\n${content}`,
      embedding: null,
      source: '手动条目',
      title,
      createdAt: Date.now(),
    },
  ]);

  getEmbedding(`${title} ${content}`)
    .then((emb) => {
      if (emb) db.updateChunk(chunk.id, { embedding: JSON.stringify(emb) });
    })
    .catch(() => {});

  return { id: entry.id };
}

function listDocuments(knowledgeId, folderId) {
  return db.listDocuments().filter((d) => belongsToKnowledge(d, knowledgeId) && (folderId === undefined || (d.folderId || '') === folderId)).map((d) => ({
    id: d.id,
    name: d.originalName,
    type: d.fileType,
    size: d.fileSize,
    chunks: d.chunkCount,
    knowledgeId: normalizeKnowledgeId(d.knowledgeId),
    folderId: d.folderId || '',
    relativePath: d.relativePath || '',
    createdAt: d.createdAt,
    status: d.status,
  }));
}

function listEntries(knowledgeId) {
  return db.listEntries().filter((e) => belongsToKnowledge(e, knowledgeId)).map((e) => ({
    id: e.id,
    title: e.title,
    content: e.content,
    tags: e.tags ? e.tags.split(',').filter(Boolean) : [],
    knowledgeId: normalizeKnowledgeId(e.knowledgeId),
    createdAt: e.createdAt,
  }));
}

function deleteDocument(docId, knowledgeId) {
  const doc = db.getDocument(docId);
  if (!doc || !belongsToKnowledge(doc, knowledgeId)) return false;
  const filePath = path.join(db.UPLOADS_DIR, doc.filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
  }
  db.deleteDocument(docId);
  return true;
}

function deleteEntry(entryId, knowledgeId) {
  const entry = db.listEntries().find((e) => e.id === entryId);
  if (!entry || !belongsToKnowledge(entry, knowledgeId)) return false;
  db.deleteEntry(entryId);
  db.deleteChunksByDocId('entry_' + entryId);
  return true;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

function keywordSearch(query, items, limit) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  const scored = items
    .map((c) => {
      const text = ((c.title || '') + ' ' + c.content).toLowerCase();
      let score = 0;
      terms.forEach((t) => {
        const idx = text.indexOf(t);
        if (idx >= 0) score += 3 + (idx < 50 ? 2 : 0);
      });
      return { ...c, _score: score };
    })
    .filter((c) => c._score > 0);
  return scored.sort((a, b) => b._score - a._score).slice(0, limit);
}

async function retrieveRelevant(query, maxChunks = 5, knowledgeId, knowledgeDocumentIds) {
  const queryEmb = await getEmbedding(query);
  const selectedIds = Array.isArray(knowledgeDocumentIds) ? new Set(knowledgeDocumentIds) : null;

  const docChunks = db.listChunks().filter((c) => {
    if (!belongsToKnowledge(c, knowledgeId)) return false;
    if (!selectedIds) return true;
    const selectionKey = c.docId && c.docId.startsWith('entry_')
      ? `entry:${c.docId.slice(6)}`
      : `document:${c.docId}`;
    return selectedIds.has(selectionKey) || selectedIds.has(c.docId);
  });
  const docs = db.listDocuments().filter((d) => belongsToKnowledge(d, knowledgeId));
  const docMap = Object.fromEntries(docs.map((d) => [d.id, d.originalName]));

  const allItems = docChunks
    .filter((c) => !c.docId || !c.docId.startsWith('entry_'))
    .map((c) => ({
      id: c.id,
      content: c.content,
      source: docMap[c.docId] || '文档',
      title: c.title || '',
      embedding: c.embedding ? safeJSONParse(c.embedding, null) : null,
    }));

  // 手动条目（来自 chunks 表里 docId 以 entry_ 开头的）
  const entryChunks = docChunks.filter((c) => c.docId && c.docId.startsWith('entry_'));
  entryChunks.forEach((c) => {
    allItems.push({
      id: c.id,
      content: c.content,
      source: '手动条目',
      title: c.title || '',
      embedding: c.embedding ? safeJSONParse(c.embedding, null) : null,
    });
  });

  let results;
  if (queryEmb) {
    results = allItems
      .map((item) => ({
        ...item,
        _score: item.embedding ? cosineSimilarity(queryEmb, item.embedding) : 0,
      }))
      .sort((a, b) => b._score - a._score);
    if (!results[0] || results[0]._score < 0.3) {
      results = keywordSearch(query, allItems, maxChunks);
    } else {
      results = results.slice(0, maxChunks);
    }
  } else {
    results = keywordSearch(query, allItems, maxChunks);
  }

  return results.map((r) => ({
    content: r.content,
    source: r.source || '知识库',
    title: r.title || '',
  }));
}

function safeJSONParse(str, fallback) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch {
    return fallback;
  }
}

module.exports = {
  addDocument,
  addManualEntry,
  listDocuments,
  listEntries,
  deleteDocument,
  deleteEntry,
  retrieveRelevant,
  generateEmbeddings,
  parseFile,
  chunkText,
};
