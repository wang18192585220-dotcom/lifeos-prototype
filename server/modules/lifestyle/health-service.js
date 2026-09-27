'use strict';

/**
 * HealthService —— 健康域（记录，README 6.2 补充）。
 * 对应前端 demo「健康管理」的睡眠/精力/营养/健康记录/恢复/饮水等分节记录。
 * 记录体为 JSON，分节（section）组织，便于适配各节不同字段。
 */
const { Repository } = require('../core/repository');

const RECORD_COLS = {
  section: 'section',
  payload: 'payload',
  recordedAt: 'recorded_at',
};

function parseJSON(text, fallback) {
  if (text == null) return fallback;
  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

function serialize(rec) {
  if (!rec) return rec;
  return { ...rec, payload: parseJSON(rec.payload, {}) };
}

class HealthService {
  constructor(adapter) {
    this.records = new Repository(adapter, 'health_records', RECORD_COLS);
  }

  list(section) {
    const rows = section ? this.records.list({ section }) : this.records.list();
    return rows.map(serialize);
  }

  get(id) {
    return serialize(this.records.get(id));
  }

  create(fields) {
    const payload = fields.payload || {};
    return serialize(
      this.records.create({
        ...fields,
        payload: JSON.stringify(payload),
      })
    );
  }

  update(id, expectedRevision, changes) {
    const out = { ...changes };
    if (out.payload !== undefined) out.payload = JSON.stringify(out.payload || {});
    return serialize(this.records.update(id, expectedRevision, out));
  }
}

module.exports = { HealthService };
