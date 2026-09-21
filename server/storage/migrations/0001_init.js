'use strict';

/**
 * 0001 —— 初始化 app_meta（Vault 级元信息）。
 * 业务表（goals/projects/tasks/...）随 S2 阶段迁移新增。
 */
module.exports = {
  version: 1,
  name: 'init_app_meta',
  up(adapter) {
    adapter.exec(`
      CREATE TABLE app_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    adapter
      .prepare('INSERT INTO app_meta (key, value) VALUES (?, ?)')
      .run('schema_name', 'lifeos');
  },
};
