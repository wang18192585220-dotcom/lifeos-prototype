'use strict';

/**
 * test:learning —— 学习档案/记录/能力评估（S4 T42）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { LearningService } = require('../server/modules/learning');

function withLearning(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  const l = new LearningService(v.adapter);
  try {
    fn(l);
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('创建学习档案（语言/目的/期望等级）', () =>
  withLearning((l) => {
    const p = l.createProfile({ language: 'es', purpose: 'exam_preparation', targetLevelMin: 'B1', targetLevelMax: 'B2' });
    assert.strictEqual(p.language, 'es');
    assert.strictEqual(p.targetLevelMax, 'B2');
  }));

test('学习记录：计时计算时长', () =>
  withLearning((l) => {
    const p = l.createProfile({ language: 'es' });
    const r = l.addRecord(p.id, {
      startedAt: '2027-03-10T09:00:00Z',
      endedAt: '2027-03-10T09:30:00Z',
      result: '听写 8/10',
    });
    assert.strictEqual(r.durationMinutes, 30);
    assert.strictEqual(l.listRecords(p.id).length, 1);
  }));

test('能力评估：pending → 确认后才算已确认', () =>
  withLearning((l) => {
    const a = l.proposeAssessment({ capability: '听力', judgment: '达到 B1 听力水平', evidence: '练习 8/10' });
    assert.strictEqual(a.status, 'pending');

    const confirmed = l.confirmAssessment(a.id, 'user');
    assert.strictEqual(confirmed.status, 'confirmed');
    assert.strictEqual(confirmed.confirmedBy, 'user');
    assert.ok(confirmed.confirmedAt);
  }));

test('能力评估：拒绝后同一结论不再提出', () =>
  withLearning((l) => {
    const a = l.proposeAssessment({ capability: '口语', judgment: '流利', evidence: 'x' });
    l.rejectAssessment(a.id, 'user');
    // 再次提出同一结论 → 返回已拒绝的旧记录，不新建
    const again = l.proposeAssessment({ capability: '口语', judgment: '流利', evidence: 'x' });
    assert.strictEqual(again.status, 'rejected');
    assert.strictEqual(again.id, a.id);
    // 只有一条评估记录
    assert.strictEqual(l.listAssessments().length, 1);
  }));

test('评估只处理一次：重复确认抛 CONFLICT', () =>
  withLearning((l) => {
    const a = l.proposeAssessment({ capability: '词汇', judgment: '达标' });
    l.confirmAssessment(a.id, 'u');
    assert.throws(() => l.confirmAssessment(a.id, 'u'), (e) => e.code === 'CONFLICT');
  }));
