'use strict';

/**
 * 0002 —— file_outbox：已提交事务的文件投影待发布队列（README 5.2 写入协议）。
 * 数据库提交成功但笔记发布失败时，记录保持 pending，供启动修复与重试。
 */
module.exports = {
  version: 2,
  name: 'file_outbox',
  up(adapter) {
    adapter.exec(`
      CREATE TABLE file_outbox (
        id          TEXT PRIMARY KEY,
        kind        TEXT NOT NULL,
        payload     TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pending',
        attempts    INTEGER NOT NULL DEFAULT 0,
        error       TEXT,
        createdAt   TEXT NOT NULL,
        publishedAt TEXT
      )
    `);
  },
};
