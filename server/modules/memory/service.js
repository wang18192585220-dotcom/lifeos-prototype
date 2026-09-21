'use strict';

/**
 * MemoryService —— 长期记忆（S4 T41，README 8.3/8.4）。
 *
 * - 保存记忆带来源；同一去重键不重复创建（即使已删除也不复活）。
 * - 撤销/删除来源 → 依赖该来源的记忆标记失效（invalid_reason），不再参与回答。
 * - 用户删除记忆：软删除 + 记录失效原因，后续自动整理不得静默撤销。
 */
const { Repository } = require('../core/repository');

function isoNow() {
  return new Date().toISOString();
}

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

const MEMORY_COLS = {
  kind: 'kind',
  contentRef: 'content_ref',
  factStatus: 'fact_status',
  agentId: 'agent_id',
  sourceVersion: 'source_version',
  derivedScope: 'derived_scope',
  invalidReason: 'invalid_reason',
  dedupKey: 'dedup_key',
};

class MemoryService {
  constructor(adapter) {
    this.adapter = adapter;
    this.memories = new Repository(adapter, 'memories', MEMORY_COLS);
  }

  /**
   * 保存记忆（自动摘要/记录）。
   * @param {object} m { kind, contentRef, factStatus, agentId, sourceVersion?, derivedScope?, dedupKey?, sources? }
   */
  saveMemory(m) {
    if (m.dedupKey) {
      const existing = this.adapter.prepare('SELECT * FROM memories WHERE dedup_key = ?').get(m.dedupKey);
      if (existing) return this.memories.fromRow(existing); // 已存在（含已删除）→ 不重复创建、不复活
    }
    const mem = this.memories.create({
      kind: m.kind,
      contentRef: m.contentRef || null,
      factStatus: m.factStatus || 'inferred',
      agentId: m.agentId,
      sourceVersion: m.sourceVersion || null,
      derivedScope: m.derivedScope || null,
      dedupKey: m.dedupKey || null,
    });
    for (const s of m.sources || []) {
      this._linkSource(mem.id, s.sourceId, s.sourceType);
    }
    return mem;
  }

  _linkSource(memoryId, sourceId, sourceType) {
    this.adapter
      .prepare('INSERT OR IGNORE INTO memory_sources (memory_id, source_id, source_type, created_at) VALUES (?, ?, ?, ?)')
      .run(memoryId, sourceId, sourceType, isoNow());
  }

  /** 撤销/删除来源：依赖该来源的记忆整体失效。 */
  invalidateBySource(sourceId, reason = '来源已删除或撤销') {
    const rows = this.adapter.prepare('SELECT memory_id FROM memory_sources WHERE source_id = ?').all(sourceId);
    for (const r of rows) {
      const m = this.memories.get(r.memory_id);
      if (m && m.invalidReason == null) {
        this.memories.update(m.id, m.revision, { invalidReason: reason });
      }
    }
  }

  /** 有效记忆（未失效、未删除）。 */
  listValid(agentId) {
    return this.memories.list({ agentId }).filter((m) => m.invalidReason == null);
  }

  /** 用户删除：软删除 + 记录失效原因。 */
  deleteMemory(id, reason = '用户删除') {
    const m = this.memories.get(id);
    if (!m) throw err('NOT_FOUND', '记忆不存在');
    this.memories.update(id, m.revision, { invalidReason: reason });
    this.memories.archive(id);
  }

  listSources(memoryId) {
    return this.adapter.prepare('SELECT source_id, source_type FROM memory_sources WHERE memory_id = ?').all(memoryId);
  }
}

module.exports = { MemoryService };
