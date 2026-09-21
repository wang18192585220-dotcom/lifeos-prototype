'use strict';

/**
 * test:core —— 领域 schema 与纯业务规则（S2 T20 基础）。
 */
const test = require('node:test');
const assert = require('node:assert');
const { TaskInput, GoalInput, ProjectInput } = require('../server/domain/schemas');
const rules = require('../server/domain/rules');

test('TaskInput 默认值：status=todo、priority=normal、timezone=Asia/Shanghai', () => {
  const parsed = TaskInput.parse({ title: '听写练习' });
  assert.strictEqual(parsed.status, 'todo');
  assert.strictEqual(parsed.priority, 'normal');
  assert.strictEqual(parsed.timezone, 'Asia/Shanghai');
});

test('TaskInput 拒绝非法枚举与空标题', () => {
  assert.throws(() => TaskInput.parse({ title: '' }));
  assert.throws(() => TaskInput.parse({ title: 'x', status: 'bogus' }));
});

test('GoalInput 校验 area 必填、manualProgress 范围', () => {
  assert.throws(() => GoalInput.parse({ title: 'g' }), /area/);
  assert.throws(() => GoalInput.parse({ title: 'g', area: '学习', manualProgress: 101 }));
  const ok = GoalInput.parse({ title: 'g', area: '学习' });
  assert.strictEqual(ok.progressMode, 'manual');
});

test('ProjectInput 校验 goalId 为 uuid 或 null', () => {
  const ok = ProjectInput.parse({ title: 'p', area: '学习' });
  assert.strictEqual(ok.goalId, undefined);
  assert.throws(() => ProjectInput.parse({ title: 'p', area: '学习', goalId: 'not-a-uuid' }));
});

test('任务与里程碑项目一致性', () => {
  const milestone = { id: 'm1', projectId: 'p1' };
  assert.strictEqual(
    rules.assertTaskMilestoneConsistency({ milestoneId: 'm1', projectId: 'p1' }, milestone).ok,
    true
  );
  const bad = rules.assertTaskMilestoneConsistency(
    { milestoneId: 'm1', projectId: 'p2' },
    milestone
  );
  assert.strictEqual(bad.ok, false);
});

test('完成任务记录 completedAt，重开清空', () => {
  const done = rules.completeTask({ status: 'todo' }, '2027-03-10T00:00:00Z');
  assert.strictEqual(done.status, 'done');
  assert.strictEqual(done.completedAt, '2027-03-10T00:00:00Z');
  const reopened = rules.reopenTask(done);
  assert.strictEqual(reopened.status, 'todo');
  assert.strictEqual(reopened.completedAt, null);
});

test('完成率：无有效任务返回 null，忽略 cancelled 与已删除', () => {
  assert.strictEqual(rules.completionRate([]), null);
  assert.strictEqual(rules.completionRate([{ status: 'cancelled' }]), null);
  assert.strictEqual(rules.completionRate([{ status: 'done', deletedAt: '2027-01-01' }]), null);
  const rate = rules.completionRate([
    { status: 'done' },
    { status: 'todo' },
    { status: 'cancelled' },
    { status: 'done', deletedAt: '2027-01-01' },
  ]);
  assert.strictEqual(rate, 0.5);
});

test('未知状态进入导入报告', () => {
  assert.strictEqual(rules.isKnownTaskStatus('todo'), true);
  assert.strictEqual(rules.isKnownTaskStatus('已完成'), false);
});
