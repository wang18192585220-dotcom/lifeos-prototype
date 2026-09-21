'use strict';

/**
 * 领域枚举常量（README 6.2 / 6.3）。与 docs/openapi.yaml 中的枚举保持一致。
 */
const TASK_STATUS = ['todo', 'in_progress', 'done', 'cancelled'];
const PRIORITY = ['low', 'normal', 'high'];
const GOAL_STATUS = ['active', 'completed', 'archived'];
const PROJECT_STATUS = ['active', 'completed', 'archived'];
const PROGRESS_MODE = ['manual', 'from_projects'];
const PROPOSAL_STATUS = ['pending', 'applied', 'rejected', 'expired', 'conflict'];
const ASSESSMENT_STATUS = ['pending', 'confirmed', 'rejected', 'superseded'];

module.exports = {
  TASK_STATUS,
  PRIORITY,
  GOAL_STATUS,
  PROJECT_STATUS,
  PROGRESS_MODE,
  PROPOSAL_STATUS,
  ASSESSMENT_STATUS,
};
