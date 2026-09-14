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

async function addDocument(originalName, filePath, fileType, fileSize) {
  const text = await parseFile(filePath, fileType);
  const chunks = chunkText(text);
  const filename = path.basename(filePath);

  const doc = db.insertDocument({
    filename,
    originalName,
    fileType,
    fileSize,
    chunkCount: chunks.length,
    status: 'indexing',
  });

  const chunkRows = chunks.map((content, i) => ({
    docId: doc.id,
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

async function generateEmbeddings(docId) {
  const chunks = db.listChunks(docId);
  for (const chunk of chunks) {
    const emb = await getEmbedding(chunk.content);
    if (emb) {
      db.updateChunk(chunk.id, { embedding: JSON.stringify(emb) });
    }
  }
  db.updateDocument(docId, { status: 'ready' });
}

function addManualEntry(title, content, tags = '') {
  const tagStr = Array.isArray(tags) ? tags.join(',') : tags;
  const entry = db.insertEntry({ title, content, tags: tagStr });

  getEmbedding(`${title} ${content}`)
    .then((emb) => {
      if (emb) {
        // 手动条目没有独立 chunk 表，直接把 embedding 存到一个关联的 chunk 里（或忽略，用关键词检索兜底）
        // 这里简单：存入 chunks 表作为独立条目
        const inserted = db.insertChunks([
          {
            docId: 'entry_' + entry.id,
            chunkIndex: 0,
            content: `${title}\n${content}`,
            embedding: JSON.stringify(emb),
            source: '手动条目',
            title,
            createdAt: Date.now(),
          },
        ]);
        inserted.forEach((c) => db.updateChunk(c.id, { embedding: JSON.stringify(emb) }));
      }
    })
    .catch(() => {});

  // 无 embedding 时也可检索：写一份到 chunks 表（无 embedding 走关键词）
  db.insertChunks([
    {
      docId: 'entry_' + entry.id,
      chunkIndex: 0,
      content: `${title}\n${content}`,
      embedding: null,
      source: '手动条目',
      title,
      createdAt: Date.now(),
    },
  ]);

  return { id: entry.id };
}

function listDocuments() {
  return db.listDocuments().map((d) => ({
    id: d.id,
    name: d.originalName,
    type: d.fileType,
    size: d.fileSize,
    chunks: d.chunkCount,
    createdAt: d.createdAt,
    status: d.status,
  }));
}

function listEntries() {
  return db.listEntries().map((e) => ({
    id: e.id,
    title: e.title,
    content: e.content,
    tags: e.tags ? e.tags.split(',').filter(Boolean) : [],
    createdAt: e.createdAt,
  }));
}

function deleteDocument(docId) {
  const doc = db.getDocument(docId);
  if (!doc) return false;
  const filePath = path.join(db.UPLOADS_DIR, doc.filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
  }
  db.deleteDocument(docId);
  return true;
}

function deleteEntry(entryId) {
  db.deleteEntry(entryId);
  // 同时删除关联 chunks
  const chunks = db.listChunks().filter((c) => c.docId === 'entry_' + entryId);
  chunks.forEach((c) => {
    const all = db.listChunks();
    const remaining = all.filter((x) => x.id !== c.id);
    const fs_path = require('path');
    const fs_mod = require('fs');
    const chunksFile = fs_path.join(db.DATA_DIR, 'knowledge_chunks.json');
    fs_mod.writeFileSync(chunksFile, JSON.stringify(remaining, null, 2), 'utf8');
  });
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

async function retrieveRelevant(query, maxChunks = 5) {
  const queryEmb = await getEmbedding(query);

  const docChunks = db.listChunks();
  const docs = db.listDocuments();
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
