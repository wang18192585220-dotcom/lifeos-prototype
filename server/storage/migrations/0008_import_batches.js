'use strict';

/**
 * 0008 —— import_batches：旧数据迁移的批次去重与映射（README 6.2 / 13）。
 */
module.exports = {
  version: 8,
  name: 'import_batches',
  up(adapter) {
    adapter.exec(`
      CREATE TABLE import_batches (
        id            TEXT PRIMARY KEY,
        source_system TEXT NOT NULL,
        batch_hash    TEXT NOT NULL,
        imported_at   TEXT NOT NULL,
        report        TEXT,
        created_at    TEXT NOT NULL
      );

      CREATE TABLE import_mappings (
        batch_id    TEXT NOT NULL,
        source_id   TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        new_id      TEXT NOT NULL,
        PRIMARY KEY (batch_id, source_id, entity_type)
      );

      CREATE INDEX idx_import_batches_hash ON import_batches(batch_hash);
    `);
  },
};
