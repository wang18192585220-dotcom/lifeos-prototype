'use strict';

/**
 * LearningService —— 学习档案 / 学习记录 / 能力评估（S4 T42，README 6.2 / 8.3 / 10）。
 *
 * - 「已掌握某能力」「达到某等级」只存 pending 评估，用户确认后才算已确认结论。
 * - 确认能力结论不等同于官方证书。
 * - 同一能力+判断被拒绝后，不得再提出相同结论。
 */
const { Repository } = require('../core/repository');

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

const PROFILE_COLS = {
  language: 'language',
  purpose: 'purpose',
  targetLevelMin: 'target_level_min',
  targetLevelMax: 'target_level_max',
  targetMonths: 'target_months',
  currentLevel: 'current_level',
  examType: 'exam_type',
  weeklyMinutes: 'weekly_minutes',
};

const RECORD_COLS = {
  profileId: 'profile_id',
  taskId: 'task_id',
  startedAt: 'started_at',
  endedAt: 'ended_at',
  durationSource: 'duration_source',
  result: 'result',
  userFeedback: 'user_feedback',
};

const ASSESSMENT_COLS = {
  capability: 'capability',
  judgment: 'judgment',
  status: 'status',
  evidence: 'evidence',
  confirmedBy: 'confirmed_by',
  confirmedAt: 'confirmed_at',
};

class LearningService {
  constructor(adapter) {
    this.profiles = new Repository(adapter, 'learning_profiles', PROFILE_COLS);
    this.records = new Repository(adapter, 'learning_records', RECORD_COLS);
    this.assessments = new Repository(adapter, 'assessments', ASSESSMENT_COLS);
  }

  // ---- 档案 ----
  createProfile(fields) {
    if (!fields.language) throw err('VALIDATION', 'language 必填');
    return this.profiles.create(fields);
  }

  getProfile(id) {
    return this.profiles.get(id);
  }

  // ---- 学习记录 ----
  /** 保存一次实际练习；时长来源：计时 or 用户输入，不能自动把暂停时间算作学习时间。 */
  addRecord(profileId, fields) {
    if (!this.profiles.get(profileId)) throw err('NOT_FOUND', '学习档案不存在');
    const rec = this.records.create({ ...fields, profileId });
    return this._withDuration(rec);
  }

  listRecords(profileId) {
    return this.records.list({ profileId }).map((r) => this._withDuration(r));
  }

  _withDuration(rec) {
    let durationMinutes = null;
    if (rec.startedAt && rec.endedAt) {
      const ms = Date.parse(rec.endedAt) - Date.parse(rec.startedAt);
      if (!Number.isNaN(ms) && ms >= 0) durationMinutes = Math.round(ms / 60000);
    }
    return { ...rec, durationMinutes };
  }

  // ---- 能力评估 ----
  /** 提出能力评估（AI 推断 → pending，不当作事实）。 */
  proposeAssessment({ capability, judgment, evidence }) {
    if (!capability || !judgment) throw err('VALIDATION', 'capability 与 judgment 必填');
    // 同一结论被拒绝后不得再提出
    const rejected = this.assessments
      .list({ capability, status: 'rejected' })
      .find((a) => a.judgment === judgment);
    if (rejected) return rejected;
    return this.assessments.create({ capability, judgment, status: 'pending', evidence: evidence || null });
  }

  confirmAssessment(id, by) {
    const a = this.assessments.get(id);
    if (!a) throw err('NOT_FOUND', '评估不存在');
    if (a.status !== 'pending') throw err('CONFLICT', '评估已处理');
    return this.assessments.update(id, a.revision, {
      status: 'confirmed',
      confirmedBy: by || null,
      confirmedAt: new Date().toISOString(),
    });
  }

  rejectAssessment(id, by) {
    const a = this.assessments.get(id);
    if (!a) throw err('NOT_FOUND', '评估不存在');
    if (a.status !== 'pending') throw err('CONFLICT', '评估已处理');
    return this.assessments.update(id, a.revision, { status: 'rejected', confirmedBy: by || null });
  }

  listAssessments(filter = {}) {
    return this.assessments.list(filter);
  }
}

module.exports = { LearningService };
