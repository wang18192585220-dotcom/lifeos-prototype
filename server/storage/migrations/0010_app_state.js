'use strict';

/**
 * 0010 —— 应用状态键值表：用于前端 demo 的整块状态持久化（/api/state/:key）。
 * 键值 JSON 文档，独立于结构化业务表，避免频繁变更的 demo 数据形态冲击领域表。
 */
module.exports = {
  version: 10,
  name: 'app_state',
  up(adapter) {
    adapter.exec(`
      CREATE TABLE app_state (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
      );
    `);
  },
};
