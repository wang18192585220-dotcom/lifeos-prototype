'use strict';

/**
 * KnowledgeService —— 资料导入 / 授权 / 检索（S3 T31，README 8.1/8.2）。
 *
 * - 导入：正文写入不可变 content 文件 → 建 document（ready）→ 切片 → FTS5 索引。
 * - 授权：资料库授权与单篇授权；检索先算可访问集合，再检索。
 * - 检索：FTS5 + 来源过滤，默认最多 8 片段。
 */
const crypto = require('node:crypto');
const { Repository } = require('../core/repository');
const { writeContent } = require('../../storage/content');
const { chunkText, bigramCJK } = require('./chunk');

function isoNow() {
  return new Date().toISOString();
}

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

const DOC_COLS = {
  libraryId: 'library_id',
  title: 'title',
  originalRef: 'original_ref',
  contentRef: 'content_ref',
  hash: 'hash',
  status: 'status',
  source: 'source',
  parserVersion: 'parser_version',
  errorReason: 'error_reason',
};

class KnowledgeService {
  /** @param {import('../../storage/adapter.js').StorageAdapter} adapter */
  constructor(adapter, vaultRoot) {
    this.adapter = adapter;
    this.vaultRoot = vaultRoot;
    this.libraries = new Repository(adapter, 'libraries', { title: 'title' });
    this.documents = new Repository(adapter, 'documents', DOC_COLS);
  }

  createLibrary(title) {
    return this.libraries.create({ title });
  }

  /**
   * 导入一篇文本资料。
   * @returns document（status ready）
   */
  importDocument(libraryId, { title, text, source } = {}) {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) throw err('VALIDATION', '资料内容为空，不能当作处理完成');
    const { hash } = writeContent(this.vaultRoot, trimmed);
    const doc = this.documents.create({
      libraryId,
      title: title || '未命名资料',
      contentRef: hash,
      hash,
      status: 'ready',
      source: source || null,
      parserVersion: 'text-v1',
    });
    const chunks = chunkText(trimmed);
    chunks.forEach((c, i) => this._indexChunk(doc.id, i, c));
    return doc;
  }

  _indexChunk(documentId, seq, text) {
    const id = crypto.randomUUID();
    this.adapter
      .prepare('INSERT INTO document_chunks (id, document_id, seq, text, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, documentId, seq, text, isoNow());
    this.adapter
      .prepare('INSERT INTO chunks_fts (content, chunk_id) VALUES (?, ?)')
      .run(bigramCJK(text), id);
  }

  grantLibrary(agentId, libraryId) {
    this.adapter
      .prepare('INSERT OR REPLACE INTO agent_library_grants (agent_id, library_id, created_at) VALUES (?, ?, ?)')
      .run(agentId, libraryId, isoNow());
  }

  revokeLibrary(agentId, libraryId) {
    this.adapter
      .prepare('DELETE FROM agent_library_grants WHERE agent_id = ? AND library_id = ?')
      .run(agentId, libraryId);
  }

  grantDocument(agentId, documentId) {
    this.adapter
      .prepare('INSERT OR REPLACE INTO agent_document_grants (agent_id, document_id, created_at) VALUES (?, ?, ?)')
      .run(agentId, documentId, isoNow());
  }

  revokeDocument(agentId, documentId) {
    this.adapter
      .prepare('DELETE FROM agent_document_grants WHERE agent_id = ? AND document_id = ?')
      .run(agentId, documentId);
  }

  /**
   * 按授权范围检索。
   * @param {string} agentId
   * @param {string} query
   * @param {{limit?:number}} [opts]
   * @returns Array<{chunkId, documentId, documentTitle, text, seq}>
   */
  search(agentId, query, { limit = 8 } = {}) {
    const q = bigramCJK(query).trim();
    if (!q) return [];
    return this.adapter
      .prepare(
        `SELECT c.id AS chunkId, c.document_id AS documentId, c.text, c.seq, d.title AS documentTitle
         FROM document_chunks c
         JOIN documents d ON d.id = c.document_id
         WHERE c.id IN (SELECT chunk_id FROM chunks_fts WHERE chunks_fts MATCH ?)
           AND d.deleted_at IS NULL
           AND (
             d.id IN (SELECT document_id FROM agent_document_grants WHERE agent_id = ?)
             OR d.library_id IN (SELECT library_id FROM agent_library_grants WHERE agent_id = ?)
           )
         LIMIT ?`
      )
      .all(q, agentId, agentId, limit);
  }
}

module.exports = { KnowledgeService };
