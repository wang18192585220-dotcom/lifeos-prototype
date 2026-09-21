'use strict';

/**
 * 领域 Zod 校验（README 4.1「Zod 统一校验请求、模型输出、工具参数」）。
 * 输入 schema 用于创建/编辑实体的入参校验；字段与 docs/openapi.yaml 对齐。
 */
const { z } = require('zod');

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

const TaskStatus = z.enum(['todo', 'in_progress', 'done', 'cancelled']);
const Priority = z.enum(['low', 'normal', 'high']);
const GoalStatus = z.enum(['active', 'completed', 'archived']);
const ProjectStatus = z.enum(['active', 'completed', 'archived']);
const ProgressMode = z.enum(['manual', 'from_projects']);

const TaskInput = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(20000).default(''),
  status: TaskStatus.default('todo'),
  priority: Priority.default('normal'),
  projectId: uuid.nullable().optional(),
  milestoneId: uuid.nullable().optional(),
  estimatedMinutes: z.number().int().min(0).nullable().optional(),
  scheduledDate: isoDate.nullable().optional(),
  timezone: z.string().default('Asia/Shanghai'),
});

const GoalInput = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(20000).default(''),
  area: z.string().trim().min(1),
  targetDate: isoDate.nullable().optional(),
  status: GoalStatus.default('active'),
  progressMode: ProgressMode.default('manual'),
  manualProgress: z.number().min(0).max(100).optional(),
});

const ProjectInput = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().max(20000).default(''),
  area: z.string().trim().min(1),
  goalId: uuid.nullable().optional(),
  status: ProjectStatus.default('active'),
});

const StageBody = z.object({
  ord: z.number().int().min(0).default(0),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(20000).default(''),
  targetDate: isoDate.nullable().optional(),
});

const MilestoneBody = StageBody.extend({
  completedAt: z.string().nullable().optional(),
});

module.exports = {
  uuid,
  isoDate,
  TaskStatus,
  Priority,
  GoalStatus,
  ProjectStatus,
  ProgressMode,
  TaskInput,
  GoalInput,
  ProjectInput,
  StageBody,
  MilestoneBody,
};
