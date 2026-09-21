'use strict';

/**
 * CoreService —— 目标/项目/任务/计划 业务服务（S2 T20）。
 * 统一数据源：今日/日历/项目详情/统计都查询同一 tasks 表（README 6.3）。
 */
const { Repository } = require('./repository');
const rules = require('../../domain/rules');

const GOAL_COLS = {
  title: 'title',
  description: 'description',
  area: 'area',
  targetDate: 'target_date',
  status: 'status',
  progressMode: 'progress_mode',
  manualProgress: 'manual_progress',
};

const PROJECT_COLS = {
  title: 'title',
  description: 'description',
  area: 'area',
  goalId: 'goal_id',
  status: 'status',
};

const STAGE_COLS = {
  projectId: 'project_id',
  ord: 'ord',
  title: 'title',
  description: 'description',
  targetDate: 'target_date',
};

const MILESTONE_COLS = {
  projectId: 'project_id',
  ord: 'ord',
  title: 'title',
  description: 'description',
  targetDate: 'target_date',
  completedAt: 'completed_at',
};

const TASK_COLS = {
  projectId: 'project_id',
  milestoneId: 'milestone_id',
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  estimatedMinutes: 'estimated_minutes',
  scheduledDate: 'scheduled_date',
  startTime: 'start_time',
  timezone: 'timezone',
  dueAt: 'due_at',
  completedAt: 'completed_at',
};

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

class CoreService {
  /** @param {import('../../storage/adapter.js').StorageAdapter} adapter */
  constructor(adapter) {
    this.goals = new Repository(adapter, 'goals', GOAL_COLS);
    this.projects = new Repository(adapter, 'projects', PROJECT_COLS);
    this.stages = new Repository(adapter, 'stages', STAGE_COLS);
    this.milestones = new Repository(adapter, 'milestones', MILESTONE_COLS);
    this.tasks = new Repository(adapter, 'tasks', TASK_COLS);
  }

  /** 创建任务：关联 milestone 时校验 projectId 一致性（README 6.3）。 */
  createTask(fields) {
    if (fields.milestoneId) {
      const milestone = this.milestones.get(fields.milestoneId);
      if (!milestone) throw err('VALIDATION', 'milestone 不存在');
      const check = rules.assertTaskMilestoneConsistency(
        { milestoneId: fields.milestoneId, projectId: fields.projectId },
        milestone
      );
      if (!check.ok) throw err('VALIDATION', check.error);
    }
    return this.tasks.create(fields);
  }

  /** 完成任务：记录 completedAt（README 6.3）。 */
  completeTask(id, expectedRevision, completedAt) {
    const task = this.tasks.get(id);
    if (!task) throw err('NOT_FOUND', '任务不存在');
    return this.tasks.update(id, expectedRevision, {
      status: 'done',
      completedAt: completedAt || new Date().toISOString(),
    });
  }

  /** 重开任务：清空 completedAt 并回到 todo（README 6.3）。 */
  reopenTask(id, expectedRevision) {
    const task = this.tasks.get(id);
    if (!task) throw err('NOT_FOUND', '任务不存在');
    return this.tasks.update(id, expectedRevision, { status: 'todo', completedAt: null });
  }

  /** 今日投影：指定日期的非取消任务。 */
  today(date) {
    return this.tasks.listRange('scheduled_date', date, date).filter((t) => t.status !== 'cancelled');
  }

  /** 日历投影：日期区间内的非取消任务。 */
  calendarRange(from, to) {
    return this.tasks.listRange('scheduled_date', from, to).filter((t) => t.status !== 'cancelled');
  }

  /** 完成率：某项目（或全部）未删除未取消任务的完成比例；无任务返回 null。 */
  completionRate(projectId) {
    const tasks = this.tasks.list(projectId ? { projectId } : {});
    return rules.completionRate(tasks);
  }
}

module.exports = { CoreService };
