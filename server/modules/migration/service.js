'use strict';

/**
 * MigrationService —— 旧数据幂等迁移（S5 T50，README 13）。
 *
 * - 旧中文状态显式映射为新枚举；不认识的进入导入报告。
 * - sourceSystem + batchHash 去重，再次导入不复制一份。
 * - 记录 import_mappings 新旧 ID 映射。
 */
const crypto = require('node:crypto');

const STATUS_MAP = {
  待办: 'todo',
  未开始: 'todo',
  未完成: 'todo',
  进行中: 'in_progress',
  处理中: 'in_progress',
  已完成: 'done',
  完成: 'done',
  已取消: 'cancelled',
  取消: 'cancelled',
};

class MigrationService {
  constructor(adapter, core) {
    this.adapter = adapter;
    this.core = core;
  }

  mapStatus(zh) {
    return STATUS_MAP[zh] || null;
  }

  _hash(batch) {
    return crypto.createHash('sha256').update(JSON.stringify(batch.entities || {})).digest('hex');
  }

  /** 预览：统计实体数与未知状态/缺失字段。 */
  preview(batch) {
    const report = { goals: 0, projects: 0, tasks: 0, unknownStatuses: [], missingTitles: 0 };
    for (const g of batch.entities.goals || []) {
      report.goals++;
      if (g.status && !this.mapStatus(g.status)) report.unknownStatuses.push(g.status);
      if (!g.title) report.missingTitles++;
    }
    for (const p of batch.entities.projects || []) {
      report.projects++;
      if (!p.title) report.missingTitles++;
    }
    for (const t of batch.entities.tasks || []) {
      report.tasks++;
      if (t.status && !this.mapStatus(t.status)) report.unknownStatuses.push(t.status);
      if (!t.title) report.missingTitles++;
    }
    return report;
  }

  /** 幂等提交：同 batchHash 已导入则跳过，不复制一份。 */
  commit(batch) {
    const batchHash = this._hash(batch);
    const existing = this.adapter.prepare('SELECT id FROM import_batches WHERE batch_hash = ?').get(batchHash);
    if (existing) return { skipped: true, batchId: existing.id };

    const batchId = crypto.randomUUID();
    const report = this.preview(batch);
    this.adapter.transaction(() => {
      for (const g of batch.entities.goals || []) {
        if (!g.title) continue;
        const created = this.core.goals.create({
          title: g.title,
          area: g.area || '未分类',
          status: this.mapStatus(g.status) || 'active',
        });
        this._record(batchId, g.sourceId, 'goal', created.id);
      }
      for (const p of batch.entities.projects || []) {
        if (!p.title) continue;
        const created = this.core.projects.create({ title: p.title, area: p.area || '未分类' });
        this._record(batchId, p.sourceId, 'project', created.id);
      }
      for (const t of batch.entities.tasks || []) {
        if (!t.title) continue;
        const created = this.core.createTask({
          title: t.title,
          status: this.mapStatus(t.status) || 'todo',
          scheduledDate: t.scheduledDate || null,
        });
        this._record(batchId, t.sourceId, 'task', created.id);
      }
      this.adapter
        .prepare(
          'INSERT INTO import_batches (id, source_system, batch_hash, imported_at, report, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(batchId, batch.sourceSystem || 'unknown', batchHash, new Date().toISOString(), JSON.stringify(report), new Date().toISOString());
    });
    return { imported: true, batchId, report };
  }

  _record(batchId, sourceId, entityType, newId) {
    this.adapter
      .prepare('INSERT OR IGNORE INTO import_mappings (batch_id, source_id, entity_type, new_id) VALUES (?, ?, ?, ?)')
      .run(batchId, sourceId || crypto.randomUUID(), entityType, newId);
  }
}

module.exports = { MigrationService, STATUS_MAP };
