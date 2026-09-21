'use strict';

/**
 * ProposalService —— AI 变更提案（S3 T30，README 7.3）。
 *
 * - AI 涉及业务变更只创建 proposal，不直接修改目标/计划/任务。
 * - confirm 在事务内重新校验 status/revision/外键，全部通过才一次提交；
 *   任一 action 失败则整体回滚。revision 冲突返回 409。
 */
const crypto = require('node:crypto');
const { Repository } = require('../core/repository');

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function safeParse(text, fallback) {
  if (text == null) return fallback;
  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

const PROPOSAL_COLS = {
  sessionId: 'session_id',
  agentId: 'agent_id',
  summary: 'summary',
  actions: 'actions',
  baseRevisions: 'base_revisions',
  status: 'status',
  expiresAt: 'expires_at',
  payloadHash: 'payload_hash',
};

class ProposalService {
  /** @param {import('../../storage/adapter.js').StorageAdapter} adapter */
  constructor(adapter, core) {
    this.adapter = adapter;
    this.core = core;
    this.proposals = new Repository(adapter, 'proposals', PROPOSAL_COLS);
  }

  _hydrate(p) {
    if (!p) return null;
    return { ...p, actions: safeParse(p.actions, []), baseRevisions: safeParse(p.baseRevisions, {}) };
  }

  list(filter = {}) {
    return this.proposals.list(filter).map((p) => this._hydrate(p));
  }

  get(id) {
    return this._hydrate(this.proposals.get(id));
  }

  /**
   * 创建提案。actions 形如：
   * { operation: 'task.update'|'task.create'|... , entityId?, expectedRevision?, changes?, reason?, sourceRefs? }
   */
  create({ sessionId, agentId, summary, actions = [] }) {
    const baseRevisions = {};
    for (const a of actions) {
      if (a.entityId) {
        const repo = this._repo(this._entityType(a));
        const cur = repo ? repo.get(a.entityId) : null;
        if (cur) baseRevisions[a.entityId] = cur.revision;
      }
    }
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(actions)).digest('hex');
    const p = this.proposals.create({
      sessionId,
      agentId,
      summary,
      actions: JSON.stringify(actions),
      baseRevisions: JSON.stringify(baseRevisions),
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      payloadHash,
    });
    return this._hydrate(p);
  }

  /** 原子确认：全部 action 通过才提交，否则整体回滚。 */
  confirm(id, payloadHash) {
    return this.adapter.transaction(() => {
      const proposal = this.proposals.get(id);
      if (!proposal) throw err('NOT_FOUND', '提案不存在');
      if (proposal.status !== 'pending') throw err('CONFLICT', '提案已处理');
      if (payloadHash !== undefined && proposal.payloadHash !== payloadHash) {
        throw err('CONFLICT', '提案已被修改，请重新确认');
      }
      const actions = safeParse(proposal.actions, []);
      for (const action of actions) {
        this._execute(action);
      }
      this.proposals.update(id, proposal.revision, { status: 'applied' });
      return this.get(id);
    });
  }

  reject(id) {
    const proposal = this.proposals.get(id);
    if (!proposal) throw err('NOT_FOUND', '提案不存在');
    if (proposal.status !== 'pending') throw err('CONFLICT', '提案已处理');
    this.proposals.update(id, proposal.revision, { status: 'rejected' });
    return this.get(id);
  }

  _repo(entityType) {
    const map = { task: 'tasks', goal: 'goals', project: 'projects' };
    const name = map[entityType];
    return name ? this.core[name] : null;
  }

  /** 从 'task.update' 形式的 operation 提取实体类型。 */
  _entityType(action) {
    const op = String(action.operation || '');
    const dot = op.indexOf('.');
    return dot > 0 ? op.slice(0, dot) : '';
  }

  _execute(action) {
    const op = String(action.operation || '');
    const dot = op.indexOf('.');
    const entityType = dot > 0 ? op.slice(0, dot) : '';
    const verb = dot > 0 ? op.slice(dot + 1) : op;
    const repo = this._repo(entityType);
    if (!repo) throw err('VALIDATION', `未知实体类型: ${entityType}`);
    switch (verb) {
      case 'create':
        return entityType === 'task'
          ? this.core.createTask(action.changes || {})
          : repo.create(action.changes || {});
      case 'update':
        if (!action.entityId) throw err('VALIDATION', 'update 缺少 entityId');
        return repo.update(action.entityId, action.expectedRevision, action.changes || {});
      case 'archive':
        if (!action.entityId) throw err('VALIDATION', 'archive 缺少 entityId');
        return repo.archive(action.entityId);
      case 'complete':
        return this.core.completeTask(action.entityId, action.expectedRevision);
      case 'cancel':
        return this.core.tasks.update(action.entityId, action.expectedRevision, { status: 'cancelled' });
      default:
        throw err('VALIDATION', `未知操作: ${verb}`);
    }
  }
}

module.exports = { ProposalService };
