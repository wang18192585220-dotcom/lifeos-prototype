'use strict';

/**
 * test:storage —— Vault 存储基础验证（S1 T10）。
 * 覆盖：初始化与迁移、重启不丢数据、事务回滚、迁移幂等、进程锁。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const paths = require('../server/platform/paths');

function tmpVault() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
}

test('打开新 Vault 会建目录、初始化并执行迁移', () => {
  const dir = tmpVault();
  const v = openVault(dir);
  try {
    assert.ok(fs.existsSync(paths.dbPath(dir)), '应创建 lifeos.sqlite');
    const rows = v.adapter
      .prepare("SELECT name FROM sqlite_master WHERE type=? AND name=?")
      .all('table', 'app_meta');
    assert.strictEqual(rows.length, 1, 'app_meta 表应由 0001 迁移创建');
    const meta = v.adapter.prepare("SELECT value FROM app_meta WHERE key='schema_name'").get();
    assert.strictEqual(meta.value, 'lifeos');
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('写入后重开数据仍在（重启不丢）', () => {
  const dir = tmpVault();
  let v = openVault(dir);
  v.adapter.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run('probe', 'hello');
  v.close();

  v = openVault(dir);
  try {
    const row = v.adapter.prepare("SELECT value FROM app_meta WHERE key=?").get('probe');
    assert.strictEqual(row.value, 'hello', '重启后数据应仍在');
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('事务抛错时整体回滚', () => {
  const dir = tmpVault();
  const v = openVault(dir);
  try {
    assert.throws(() => {
      v.adapter.transaction(() => {
        v.adapter.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run('x', '1');
        throw new Error('boom');
      });
    });
    const row = v.adapter.prepare("SELECT value FROM app_meta WHERE key='x'").get();
    assert.strictEqual(row, undefined, '回滚后不应有残留行');
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('迁移幂等：重开不重复执行', () => {
  const dir = tmpVault();
  let v = openVault(dir);
  v.close();
  v = openVault(dir);
  try {
    const n = v.adapter.prepare('SELECT COUNT(*) AS n FROM _schema_migrations').get().n;
    assert.strictEqual(n, 1, '0001 只应用一次');
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('同 Vault 并发打开被进程锁拒绝', () => {
  const dir = tmpVault();
  const v1 = openVault(dir);
  try {
    assert.throws(
      () => openVault(dir),
      (e) => e.code === 'VAULT_LOCKED',
      '第二次打开应因进程锁失败'
    );
  } finally {
    v1.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('备份得到可打开的一致快照', async () => {
  const dir = tmpVault();
  const v = openVault(dir);
  const backupPath = path.join(dir, 'backup.sqlite');
  try {
    v.adapter.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run('b', 'v');
    await v.adapter.backup(backupPath);
    assert.ok(fs.existsSync(backupPath) && fs.statSync(backupPath).size > 0);
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
