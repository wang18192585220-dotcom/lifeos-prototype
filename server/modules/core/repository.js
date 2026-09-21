'use strict';

/**
 * 通用仓储（S2 T20）：UUID + revision 乐观锁 + 软删除。
 *
 * - create/update 只落「显式提供」的字段，其余走 DB 默认值。
 * - update 在事务内校验 revision，不匹配抛 REVISION_CONFLICT（409）。
 * - archive 软删除（置 deleted_at）。
 */
const crypto = require('node:crypto');

function isoNow() {
  return new Date().toISOString();
}

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

class Repository {
  /**
   * @param {import('../../storage/adapter.js').StorageAdapter} adapter
   * @param {string} table 表名
   * @param {object} map domain 字段名 → 数据库列名（不含 base 字段）
   */
  constructor(adapter, table, map) {
    this.adapter = adapter;
    this.table = table;
    this.map = map;
  }

  /** 把数据库行映射为领域对象（camelCase）。 */
  fromRow(row) {
    if (!row) return null;
    const out = {
      id: row.id,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
    for (const [domain, db] of Object.entries(this.map)) {
      out[domain] = row[db];
    }
    return out;
  }

  create(fields) {
    const id = crypto.randomUUID();
    const now = isoNow();
    const cols = ['id', 'revision', 'created_at', 'updated_at'];
    const params = [id, 1, now, now];
    for (const [domain, db] of Object.entries(this.map)) {
      if (fields[domain] !== undefined) {
        cols.push(db);
        params.push(fields[domain]);
      }
    }
    const placeholders = cols.map(() => '?').join(', ');
    this.adapter
      .prepare(`INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders})`)
      .run(...params);
    return this.get(id);
  }

  get(id) {
    const row = this.adapter
      .prepare(`SELECT * FROM ${this.table} WHERE id = ? AND deleted_at IS NULL`)
      .get(id);
    return this.fromRow(row);
  }

  /** 等值过滤列表（仅未删除）。 */
  list(filter = {}) {
    const where = ['deleted_at IS NULL'];
    const params = [];
    for (const [domain, db] of Object.entries(this.map)) {
      if (filter[domain] !== undefined) {
        where.push(`${db} = ?`);
        params.push(filter[domain]);
      }
    }
    const rows = this.adapter
      .prepare(`SELECT * FROM ${this.table} WHERE ${where.join(' AND ')} ORDER BY created_at`)
      .all(...params);
    return rows.map((r) => this.fromRow(r));
  }

  /** 按某列区间过滤（未删除），用于日期范围投影。 */
  listRange(dbCol, from, to) {
    const rows = this.adapter
      .prepare(
        `SELECT * FROM ${this.table}
         WHERE deleted_at IS NULL AND ${dbCol} IS NOT NULL AND ${dbCol} >= ? AND ${dbCol} <= ?
         ORDER BY ${dbCol}`
      )
      .all(from, to);
    return rows.map((r) => this.fromRow(r));
  }

  /**
   * 乐观锁更新。
   * @param {string} id
   * @param {number} expectedRevision
   * @param {object} changes 领域字段增量
   */
  update(id, expectedRevision, changes) {
    return this.adapter.transaction(() => {
      const current = this.adapter.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id);
      if (!current || current.deleted_at != null) {
        throw err('NOT_FOUND', '实体不存在');
      }
      if (current.revision !== expectedRevision) {
        throw err('REVISION_CONFLICT', '版本冲突，实体已被修改');
      }
      const sets = [];
      const params = [];
      for (const [domain, db] of Object.entries(this.map)) {
        if (changes[domain] !== undefined) {
          sets.push(`${db} = ?`);
          params.push(changes[domain]);
        }
      }
      if (sets.length === 0) return this.fromRow(current);
      sets.push('revision = ?', 'updated_at = ?');
      params.push(current.revision + 1, isoNow(), id);
      this.adapter
        .prepare(`UPDATE ${this.table} SET ${sets.join(', ')} WHERE id = ?`)
        .run(...params);
      return this.get(id);
    });
  }

  archive(id) {
    this.adapter
      .prepare(`UPDATE ${this.table} SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`)
      .run(isoNow(), id);
  }
}

module.exports = { Repository };
