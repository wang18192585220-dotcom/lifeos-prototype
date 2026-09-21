#!/usr/bin/env node
/**
 * LifeOS 运行时能力检查（S0 交付脚本，对应 npm run runtime-check）
 *
 * 用途：验证当前运行时（开发 Node 或 Electron 内置 Node）的
 *   node:sqlite 打开、基本 DML、事务、FTS5、backup、close 能力，
 *   以及运行时版本。
 *
 * 运行方式：
 *   node tools/runtime-check.cjs          # 验证开发机 Node
 *   npx electron tools/runtime-check.cjs  # 验证 Electron 内置 Node
 *
 * 退出码：0 = 全部通过；1 = 任一项失败。
 */
'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function runtimeIdentity() {
  section('运行时');
  console.log(`platform : ${os.platform()} ${os.arch()}`);
  console.log(`node     : ${process.versions.node}`);
  console.log(`electron : ${process.versions.electron || '(未在 Electron 中运行)'}`);
  console.log(`sqlite   : ${process.versions.sqlite || '未知(未暴露版本)'}`);
}

async function checkSqlite() {
  section('node:sqlite 能力');
  let DatabaseSync;
  let backup;
  try {
    ({ DatabaseSync, backup } = require('node:sqlite'));
  } catch (e) {
    console.log(`node:sqlite 加载失败: ${e && e.message ? e.message : e}`);
    return [{ cap: 'require(node:sqlite)', ok: false, err: String(e) }];
  }

  const results = [];
  const record = (cap, ok, err) => {
    results.push({ cap, ok, err });
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${cap}${err ? '  -> ' + err : ''}`);
  };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-runtimecheck-'));
  const dbPath = path.join(tmp, 'test.sqlite');

  let db;
  try {
    // 1. open（文件库）
    db = new DatabaseSync(dbPath);
    record('open(file)', true);
  } catch (e) {
    record('open(file)', false, String(e));
    return results;
  }

  try {
    // 2. exec / prepare / run / get（基本 DML）
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    const ins = db.prepare('INSERT INTO t (name) VALUES (?)');
    ins.run('alpha');
    ins.run('beta');
    const n = db.prepare('SELECT COUNT(*) AS n FROM t').get().n;
    record('exec/prepare/run/get', n === 2, n === 2 ? '' : `count=${n}`);

    // 3. 事务（commit 与 rollback 都验证）
    db.exec('BEGIN');
    db.prepare('INSERT INTO t (name) VALUES (?)').run('committed');
    db.exec('COMMIT');
    const afterCommit = db.prepare('SELECT COUNT(*) AS n FROM t').get().n;
    record('transaction commit', afterCommit === 3, afterCommit === 3 ? '' : `count=${afterCommit}`);

    db.exec('BEGIN');
    db.prepare('INSERT INTO t (name) VALUES (?)').run('rolled-back');
    db.exec('ROLLBACK');
    const afterRollback = db.prepare('SELECT COUNT(*) AS n FROM t').get().n;
    record('transaction rollback', afterRollback === 3, afterRollback === 3 ? '' : `count=${afterRollback}`);

    // 4. FTS5（创建虚拟表、插入、MATCH 查询）
    db.exec('CREATE VIRTUAL TABLE ft USING fts5(content)');
    db.prepare('INSERT INTO ft (content) VALUES (?)').run('hola español aprendizaje');
    db.prepare('INSERT INTO ft (content) VALUES (?)').run('estudiar para el examen DELE');
    const hits = db.prepare('SELECT COUNT(*) AS n FROM ft WHERE ft MATCH ?').get('español').n;
    record('FTS5 create/insert/match', hits === 1, hits === 1 ? '' : `hits=${hits}`);

    // 5. backup（模块级 API，异步备份到独立文件）
    const backupPath = path.join(tmp, 'backup.sqlite');
    await backup(db, backupPath);
    const backupOk = fs.existsSync(backupPath) && fs.statSync(backupPath).size > 0;
    record('backup', backupOk);
  } catch (e) {
    record('sqlite 复合操作', false, String(e));
  } finally {
    // 6. close
    try {
      db.close();
      record('close', true);
    } catch (e) {
      record('close', false, String(e));
    }
  }

  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (_) { /* 清理失败不影响结论 */ }

  return results;
}

async function main() {
  runtimeIdentity();
  const results = await checkSqlite();
  const failed = results.filter((r) => !r.ok);
  console.log('\n=== 结论 ===');
  if (failed.length === 0) {
    console.log(`全部通过（${results.length} 项）。`);
    process.exit(0);
  } else {
    console.log(`失败 ${failed.length} 项，共 ${results.length} 项。`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('runtime-check 异常:', e);
  process.exit(1);
});
