'use strict';

/**
 * 0007 —— memories 增 dedup_key（sourceHash+kind+agentId+processorVersion 去重键，README 8.4）。
 */
module.exports = {
  version: 7,
  name: 'memory_dedup_key',
  up(adapter) {
    adapter.exec(`
      ALTER TABLE memories ADD COLUMN dedup_key TEXT;
      CREATE UNIQUE INDEX idx_memories_dedup ON memories(dedup_key) WHERE dedup_key IS NOT NULL;
    `);
  },
};
