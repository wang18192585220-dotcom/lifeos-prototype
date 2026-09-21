'use strict';

/**
 * WorkflowService —— 调度运行与错过检测（S4 T43，README 11）。
 *
 * - 每次发生以 workflowId + scheduledFor 唯一标识（幂等）。
 * - 状态 scheduled/running/succeeded/failed/missed/cancelled。
 * - 启动时将过去未发生的计划标为 missed，不自动补跑。
 */
const { Repository } = require('../core/repository');

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

const WORKFLOW_COLS = {
  trigger: 'trigger',
  timezone: 'timezone',
  action: 'action',
  enabled: 'enabled',
};

const RUN_COLS = {
  workflowId: 'workflow_id',
  scheduledFor: 'scheduled_for',
  status: 'status',
  idempotencyKey: 'idempotency_key',
};

class WorkflowService {
  /** @param {import('../../storage/adapter.js').StorageAdapter} adapter */
  constructor(adapter, clock = () => new Date()) {
    this.adapter = adapter;
    this.workflows = new Repository(adapter, 'workflows', WORKFLOW_COLS);
    this.runs = new Repository(adapter, 'workflow_runs', RUN_COLS);
    this.clock = clock;
  }

  _hydrate(w) {
    if (!w) return null;
    let trigger = {};
    let action = {};
    try {
      trigger = w.trigger ? JSON.parse(w.trigger) : {};
    } catch (_) {}
    try {
      action = w.action ? JSON.parse(w.action) : {};
    } catch (_) {}
    return { ...w, trigger, action, enabled: !!w.enabled };
  }

  createWorkflow({ trigger = {}, action = {}, timezone = 'Asia/Shanghai', enabled = true }) {
    return this._hydrate(
      this.workflows.create({
        trigger: JSON.stringify(trigger),
        action: JSON.stringify(action),
        timezone,
        enabled: enabled ? 1 : 0,
      })
    );
  }

  listWorkflows() {
    return this.workflows.list().map((w) => this._hydrate(w));
  }

  findRun(workflowId, scheduledFor) {
    const rows = this.adapter
      .prepare('SELECT * FROM workflow_runs WHERE workflow_id = ? AND scheduled_for = ? AND deleted_at IS NULL')
      .all(workflowId, scheduledFor);
    return rows[0] ? this.runs.fromRow(rows[0]) : null;
  }

  /** 幂等调度：同 workflowId+scheduledFor 只产生一次 run。 */
  scheduleRun(workflowId, scheduledFor) {
    const existing = this.findRun(workflowId, scheduledFor);
    if (existing) return existing;
    return this.runs.create({
      workflowId,
      scheduledFor,
      status: 'scheduled',
      idempotencyKey: `${workflowId}:${scheduledFor}`,
    });
  }

  /** 启动时：过去未发生的计划标为 missed（不自动补跑）。 */
  markMissed(now = this.clock().toISOString()) {
    this.adapter
      .prepare("UPDATE workflow_runs SET status = 'missed' WHERE status = 'scheduled' AND scheduled_for < ? AND deleted_at IS NULL")
      .run(now);
  }

  setStatus(runId, status) {
    const r = this.runs.get(runId);
    if (!r) throw err('NOT_FOUND', '运行不存在');
    return this.runs.update(runId, r.revision, { status });
  }

  /** 手动执行：复用同一幂等体系，已执行/错过不重复产生结果。 */
  runNow(workflowId, scheduledFor = this.clock().toISOString()) {
    const existing = this.findRun(workflowId, scheduledFor);
    if (existing && existing.status !== 'scheduled') return existing;
    const run = existing || this.scheduleRun(workflowId, scheduledFor);
    return this.setStatus(run.id, 'succeeded');
  }

  listRuns(workflowId) {
    return this.runs.list({ workflowId });
  }
}

module.exports = { WorkflowService };
