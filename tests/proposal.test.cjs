'use strict';

/**
 * test:proposal —— 会话 + AI 变更提案（S3 T30）。
 * 覆盖：会话消息有序、提案确认原子应用、revision 冲突整体回滚、拒绝不落地。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { CoreService } = require('../server/modules/core');
const { SessionService, ProposalService } = require('../server/modules/agent');

function withServices(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  const core = new CoreService(v.adapter);
  const sessions = new SessionService(v.adapter);
  const proposals = new ProposalService(v.adapter, core);
  try {
    fn({ core, sessions, proposals });
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('会话消息按 seq 有序', () =>
  withServices(({ sessions }) => {
    const s = sessions.createSession('agent-1');
    sessions.addMessage(s.id, { role: 'user', content: '你好' });
    sessions.addMessage(s.id, { role: 'assistant', content: '你好！' });
    const msgs = sessions.listMessages(s.id);
    assert.strictEqual(msgs.length, 2);
    assert.deepStrictEqual(msgs.map((m) => m.seq), [1, 2]);
    assert.deepStrictEqual(msgs.map((m) => m.role), ['user', 'assistant']);
  }));

test('提案确认：原子应用多个 action', () =>
  withServices(({ core, proposals }) => {
    const p = proposals.create({
      sessionId: 's1',
      agentId: 'a1',
      summary: '创建两个任务',
      actions: [
        { operation: 'task.create', changes: { title: '任务A', scheduledDate: '2027-03-10' } },
        { operation: 'task.create', changes: { title: '任务B', scheduledDate: '2027-03-11' } },
      ],
    });
    assert.strictEqual(p.status, 'pending');
    const applied = proposals.confirm(p.id, p.payloadHash);
    assert.strictEqual(applied.status, 'applied');
    assert.strictEqual(core.tasks.list().length, 2);
  }));

test('提案确认：任一 action 失败则整体回滚', () =>
  withServices(({ core, proposals }) => {
    const task = core.createTask({ title: '已有任务' });
    const p = proposals.create({
      sessionId: 's1',
      agentId: 'a1',
      summary: '一个成功一个失败',
      actions: [
        { operation: 'task.create', changes: { title: '新任务' } },
        // 用旧 revision 更新已有任务 → 冲突
        { operation: 'task.update', entityId: task.id, expectedRevision: 999, changes: { title: '改' } },
      ],
    });
    assert.throws(
      () => proposals.confirm(p.id, p.payloadHash),
      (e) => e.code === 'REVISION_CONFLICT'
    );
    // 第一个 create 也被回滚，未留下「新任务」
    assert.deepStrictEqual(core.tasks.list().map((t) => t.title), ['已有任务']);
    // 提案仍 pending，可修正后重试
    assert.strictEqual(proposals.get(p.id).status, 'pending');
  }));

test('提案拒绝：状态 rejected，业务不变', () =>
  withServices(({ core, proposals }) => {
    const p = proposals.create({
      sessionId: 's1',
      agentId: 'a1',
      summary: '拒绝我',
      actions: [{ operation: 'task.create', changes: { title: '不应出现' } }],
    });
    const rejected = proposals.reject(p.id);
    assert.strictEqual(rejected.status, 'rejected');
    assert.deepStrictEqual(core.tasks.list(), []);
  }));

test('确认旧 payloadHash 返回 CONFLICT', () =>
  withServices(({ core, proposals }) => {
    const p = proposals.create({
      sessionId: 's1',
      agentId: 'a1',
      summary: 'x',
      actions: [{ operation: 'task.create', changes: { title: 't' } }],
    });
    assert.throws(() => proposals.confirm(p.id, 'stale-hash'), (e) => e.code === 'CONFLICT');
    assert.deepStrictEqual(core.tasks.list(), []);
  }));
