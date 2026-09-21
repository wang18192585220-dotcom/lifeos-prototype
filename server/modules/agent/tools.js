'use strict';

/**
 * 工具注册表 + 默认工具集（S3 T30，README 7.2）。
 *
 * - 只读工具返回真实数据；propose_changes 只创建提案，不直接改业务。
 * - 工具请求经 schema、角色权限、资源授权和幂等校验后执行（授权/幂等随后续阶段补齐）。
 */
class ToolRegistry {
  constructor() {
    this._tools = new Map();
  }

  register(name, { description, parameters }, handler) {
    this._tools.set(name, { name, description, parameters, handler });
    return this;
  }

  definitions() {
    return [...this._tools.values()].map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  has(name) {
    return this._tools.has(name);
  }

  async execute(name, args) {
    const t = this._tools.get(name);
    if (!t) {
      const e = new Error(`未注册工具: ${name}`);
      e.code = 'UNKNOWN_TOOL';
      throw e;
    }
    return t.handler(args || {});
  }
}

const NO_ARGS = { type: 'object', properties: {} };

/**
 * 构建某次 turn 的工具集（绑定会话上下文）。
 * @param {object} deps
 * @param {object} deps.core CoreService
 * @param {object} deps.proposals ProposalService
 * @param {Function} deps.getContext 返回 { sessionId, agentId }
 */
function buildTools({ core, proposals, getContext }) {
  const tools = new ToolRegistry();

  tools.register('read_goals', { description: '读取当前用户的目标列表', parameters: NO_ARGS }, () => core.goals.list());
  tools.register('read_projects', { description: '读取当前用户的项目列表', parameters: NO_ARGS }, () => core.projects.list());
  tools.register('read_tasks', { description: '读取当前用户的任务列表', parameters: NO_ARGS }, () => core.tasks.list());

  tools.register(
    'propose_changes',
    {
      description: '创建业务变更提案（不直接修改目标/计划/任务，须用户确认）',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          actions: { type: 'array' },
        },
        required: ['summary', 'actions'],
      },
    },
    (args) => {
      const ctx = getContext();
      return proposals.create({
        sessionId: ctx.sessionId,
        agentId: ctx.agentId,
        summary: args.summary,
        actions: args.actions || [],
      });
    }
  );

  return tools;
}

module.exports = { ToolRegistry, buildTools };
