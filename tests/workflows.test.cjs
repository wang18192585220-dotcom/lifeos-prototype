'use strict';

/**
 * test:workflows —— 调度运行/幂等/错过检测（S4 T43）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { WorkflowService } = require('../server/modules/workflows');

function withWorkflows(fn, clock) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  const w = new WorkflowService(v.adapter, clock);
  try {
    fn(w);
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('创建与幂等调度：同 workflowId+scheduledFor 只产生一次', () =>
  withWorkflows((w) => {
    const wf = w.createWorkflow({ trigger: { daily: '09:00' }, action: { kind: 'review_draft' } });
    const r1 = w.scheduleRun(wf.id, '2027-03-10T09:00:00+08:00');
    const r2 = w.scheduleRun(wf.id, '2027-03-10T09:00:00+08:00');
    assert.strictEqual(r1.id, r2.id);
    assert.strictEqual(w.listRuns(wf.id).length, 1);
  }));

test('错过检测：过去未发生的计划标为 missed', () =>
  withWorkflows((w) => {
    const wf = w.createWorkflow({});
    w.scheduleRun(wf.id, '2027-03-10T09:00:00+08:00');
    w.scheduleRun(wf.id, '2027-03-11T09:00:00+08:00');
    // 当前时间在两次计划之间
    w.markMissed('2027-03-10T12:00:00+08:00');
    const runs = w.listRuns(wf.id).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    assert.strictEqual(runs[0].status, 'missed');
    assert.strictEqual(runs[1].status, 'scheduled');
  }));

test('手动执行幂等：连点不重复产生结果', () =>
  withWorkflows((w) => {
    const wf = w.createWorkflow({});
    const r1 = w.runNow(wf.id, '2027-03-10T09:00:00+08:00');
    const r2 = w.runNow(wf.id, '2027-03-10T09:00:00+08:00');
    assert.strictEqual(r1.id, r2.id);
    assert.strictEqual(r2.status, 'succeeded');
    assert.strictEqual(w.listRuns(wf.id).length, 1);
  }));

test('状态流转：running → succeeded', () =>
  withWorkflows((w) => {
    const wf = w.createWorkflow({});
    const r = w.scheduleRun(wf.id, '2027-03-10T09:00:00+08:00');
    w.setStatus(r.id, 'running');
    w.setStatus(r.id, 'succeeded');
    assert.strictEqual(w.runs.get(r.id).status, 'succeeded');
  }));
