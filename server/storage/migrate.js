'use strict';

/**
 * 顺序迁移执行器（README 6.1：数据库按顺序执行版本迁移，迁移前备份；
 * 不能通过删库解决 schema 冲突）。
 *
 * 每个迁移形如 { version, name, up(adapter) }，version 单调递增且唯一。
 */
const migrations = require('./migrations');

function ensureMigrationsTable(adapter) {
  adapter.exec(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      version   INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      appliedAt TEXT NOT NULL
    )
  `);
}

function appliedVersions(adapter) {
  const rows = adapter.prepare('SELECT version FROM _schema_migrations ORDER BY version').all();
  return new Set(rows.map((r) => r.version));
}

/**
 * 按 version 升序应用未执行的迁移；每个迁移在独立事务中执行。
 * @param {import('./adapter.js').StorageAdapter} adapter
 * @param {Array<{version:number,name:string,up:Function}>} [list] 迁移列表，默认取 ./migrations
 */
function runMigrations(adapter, list = migrations) {
  ensureMigrationsTable(adapter);
  const applied = appliedVersions(adapter);
  const sorted = [...list].sort((a, b) => a.version - b.version);

  // 校验 version 唯一且无重复编号
  const seen = new Set();
  for (const m of sorted) {
    if (seen.has(m.version)) {
      throw new Error(`迁移 version 重复: ${m.version} (${m.name})`);
    }
    seen.add(m.version);
  }

  for (const m of sorted) {
    if (applied.has(m.version)) continue;
    adapter.transaction(() => {
      m.up(adapter);
      adapter
        .prepare('INSERT INTO _schema_migrations (version, name, appliedAt) VALUES (?, ?, ?)')
        .run(m.version, m.name, new Date().toISOString());
    });
  }

  return sorted.length ? sorted[sorted.length - 1].version : 0;
}

module.exports = { runMigrations, ensureMigrationsTable };
