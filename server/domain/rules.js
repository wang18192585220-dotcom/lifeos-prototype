'use strict';

/**
 * 纯领域规则（README 6.3）。不依赖数据库与 I/O，便于单测。
 */

/**
 * 任务关联 milestone 时，其 projectId 必须与 milestone 所属项目一致。
 * @returns {{ok:boolean, error?:string}}
 */
function assertTaskMilestoneConsistency(task, milestone) {
  if (task.milestoneId && milestone && task.projectId !== milestone.projectId) {
    return { ok: false, error: 'task.projectId 与 milestone 所属项目不一致' };
  }
  return { ok: true };
}

/** 完成任务记录 completedAt（README：完成任务记录 completedAt）。 */
function completeTask(task, completedAt = new Date().toISOString()) {
  return { ...task, status: 'done', completedAt };
}

/** 重开任务清空 completedAt 并回到 todo（README：重开清空）。 */
function reopenTask(task) {
  return { ...task, status: 'todo', completedAt: null };
}

/**
 * 完成率：只统计未删除且未取消的任务；无任务返回 null（表示「尚无任务」，不是 100%）。
 * @param {Array<{status:string, deletedAt?:string|null}>} tasks
 * @returns {number|null}
 */
function completionRate(tasks) {
  const active = tasks.filter((t) => t.deletedAt == null && t.status !== 'cancelled');
  if (active.length === 0) return null;
  const done = active.filter((t) => t.status === 'done').length;
  return done / active.length;
}

/** 旧状态是否为已知枚举（未知值进入导入报告，README 6.3）。 */
function isKnownTaskStatus(s) {
  return ['todo', 'in_progress', 'done', 'cancelled'].includes(s);
}

module.exports = {
  assertTaskMilestoneConsistency,
  completeTask,
  reopenTask,
  completionRate,
  isKnownTaskStatus,
};
