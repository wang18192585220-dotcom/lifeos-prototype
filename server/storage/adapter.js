'use strict';

/**
 * StorageAdapter —— 隔离 SQLite 驱动的唯一入口。
 *
 * 业务模块不得直接 require('node:sqlite')，一律经此适配层访问，
 * 以便在驱动能力变化时只改这一处（README 4.1 / DECISIONS D-003）。
 *
 * 注意：backup 是 node:sqlite 的模块级 API，而非实例方法（DECISIONS D-002）。
 */
const { DatabaseSync, backup: sqliteBackup } = require('node:sqlite');

class StorageAdapter {
  /**
   * @param {string} dbPath SQLite 文件路径
   */
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this._txDepth = 0;
  }

  /**
   * 打开（不存在则创建）数据库，开启外键约束与 WAL。
   * @returns {StorageAdapter}
   */
  open() {
    if (this.db) return this;
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.prepare('PRAGMA journal_mode = WAL').get();
    return this;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /** 底层 DatabaseSync；仅 storage 层与迁移使用。 */
  get raw() {
    return this.db;
  }

  get isOpen() {
    return this.db !== null;
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  /**
   * 在单个事务中执行 fn；抛错则整体回滚。
   * 支持嵌套：内层用 SAVEPOINT，使外层事务可整体回滚（如提案原子确认）。
   * @template T
   * @param {() => T} fn
   * @returns {T}
   */
  transaction(fn) {
    if (this._txDepth > 0) {
      const sp = `sp_${this._txDepth}`;
      this._txDepth += 1;
      this.db.exec(`SAVEPOINT ${sp}`);
      try {
        const out = fn();
        this.db.exec(`RELEASE ${sp}`);
        this._txDepth -= 1;
        return out;
      } catch (e) {
        this.db.exec(`ROLLBACK TO ${sp}`);
        this.db.exec(`RELEASE ${sp}`);
        this._txDepth -= 1;
        throw e;
      }
    }
    this._txDepth = 1;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      this._txDepth = 0;
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      this._txDepth = 0;
      throw e;
    }
  }

  /**
   * 一致快照备份（SQLite backup API，含 WAL 一致性）。
   * @param {string} destPath 目标文件路径
   * @returns {Promise<void>}
   */
  async backup(destPath) {
    return sqliteBackup(this.db, destPath);
  }
}

module.exports = { StorageAdapter };
