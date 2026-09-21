'use strict';

/**
 * test:core —— 核心业务仓储与服务（S2 T20）：CRUD、revision 乐观锁、
 * 任务一致性、完成/重开、今日/日历统一投影。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { CoreService } = require('../server/modules/core');

function withVault(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  const core = new CoreService(v.adapter);
  try {
    fn(core);
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('创建并读取目标/项目/任务（默认值正确）', () =>
  withVault((core) => {
    const goal = core.goals.create({ title: '学习西语', area: '学习' });
    assert.strictEqual(goal.revision, 1);
    assert.strictEqual(goal.status, 'active');
    assert.strictEqual(goal.progressMode, 'manual');

    const project = core.projects.create({ title: '备考', area: '学习', goalId: goal.id });
    assert.strictEqual(project.goalId, goal.id);

    const task = core.createTask({ title: '听力练习', projectId: project.id });
    assert.strictEqual(task.status, 'todo');
    assert.strictEqual(task.priority, 'normal');
    assert.strictEqual(core.tasks.get(task.id).title, '听力练习');
  }));

test('revision 乐观锁：旧 revision 更新抛 REVISION_CONFLICT', () =>
  withVault((core) => {
    const task = core.createTask({ title: 't' });
    const updated = core.tasks.update(task.id, 1, { title: 't2' });
    assert.strictEqual(updated.revision, 2);
    assert.throws(
      () => core.tasks.update(task.id, 1, { title: 't3' }),
      (e) => e.code === 'REVISION_CONFLICT'
    );
  }));

test('完成任务记录 completedAt，重开清空', () =>
  withVault((core) => {
    const task = core.createTask({ title: 't' });
    const done = core.completeTask(task.id, task.revision);
    assert.strictEqual(done.status, 'done');
    assert.ok(done.completedAt);
    const reopened = core.reopenTask(done.id, done.revision);
    assert.strictEqual(reopened.status, 'todo');
    assert.strictEqual(reopened.completedAt, null);
  }));

test('任务关联 milestone 时 projectId 必须一致', () =>
  withVault((core) => {
    const p1 = core.projects.create({ title: 'p1', area: 'a' });
    const p2 = core.projects.create({ title: 'p2', area: 'a' });
    const m = core.milestones.create({ projectId: p1.id, ord: 0, title: 'm' });
    core.createTask({ title: 'ok', projectId: p1.id, milestoneId: m.id });
    assert.throws(
      () => core.createTask({ title: 'bad', projectId: p2.id, milestoneId: m.id }),
      (e) => e.code === 'VALIDATION'
    );
  }));

test('今日与日历投影来自同一 tasks 数据源，排除取消', () =>
  withVault((core) => {
    core.createTask({ title: 'today', scheduledDate: '2027-03-10' });
    core.createTask({ title: 'later', scheduledDate: '2027-03-11' });
    core.createTask({ title: 'cancelled', scheduledDate: '2027-03-10', status: 'cancelled' });

    const today = core.today('2027-03-10');
    assert.deepStrictEqual(today.map((t) => t.title), ['today']);

    const range = core.calendarRange('2027-03-10', '2027-03-11');
    assert.deepStrictEqual(range.map((t) => t.title).sort(), ['later', 'today']);
  }));

test('完成率：忽略 cancelled 与已删除，无任务返回 null', () =>
  withVault((core) => {
    assert.strictEqual(core.completionRate(), null);
    const p = core.projects.create({ title: 'p', area: 'a' });
    core.createTask({ title: 'done', projectId: p.id, status: 'done' });
    core.createTask({ title: 'todo', projectId: p.id });
    core.createTask({ title: 'cancelled', projectId: p.id, status: 'cancelled' });
    assert.strictEqual(core.completionRate(p.id), 0.5);
  }));

test('归档后不再出现在 get/list', () =>
  withVault((core) => {
    const task = core.createTask({ title: 't' });
    core.tasks.archive(task.id);
    assert.strictEqual(core.tasks.get(task.id), null);
    assert.deepStrictEqual(core.tasks.list(), []);
  }));
