'use strict';

/**
 * 0005 —— 资料切片与 FTS5 检索（README 8.1/8.2）。
 * document_chunks 存原文切片；chunks_fts 存预处理后的可检索内容（可重建索引）。
 */
module.exports = {
  version: 5,
  name: 'knowledge_chunks',
  up(adapter) {
    adapter.exec(`
      CREATE TABLE document_chunks (
        id          TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        seq         INTEGER NOT NULL,
        text        TEXT NOT NULL,
        locator     TEXT,
        created_at  TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id)
      );

      CREATE VIRTUAL TABLE chunks_fts USING fts5(
        content,
        chunk_id UNINDEXED,
        tokenize = 'unicode61 remove_diacritics 2'
      );

      CREATE INDEX idx_chunks_doc ON document_chunks(document_id, seq);
    `);
  },
};
