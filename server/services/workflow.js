const cron = require('node-cron');
const db = require('./db');
const { callLLM } = require('./llm');

const scheduledTasks = new Map();

function createWorkflow({ name, triggerType, triggerConfig, actionType, actionConfig }) {
  const wf = db.insertWorkflow({
    name,
    triggerType,
    triggerConfig: JSON.stringify(triggerConfig || {}),
    actionType,
    actionConfig: JSON.stringify(actionConfig || {}),
  });
  scheduleWorkflow(wf.id);
  return { id: wf.id };
}

function listWorkflows() {
  return db.listWorkflows().map((r) => ({
    id: r.id,
    name: r.name,
    triggerType: r.triggerType,
    triggerConfig: safeJSONParse(r.triggerConfig, {}),
    actionType: r.actionType,
    actionConfig: safeJSONParse(r.actionConfig, {}),
    enabled: !!r.enabled,
    lastRunAt: r.lastRunAt,
    createdAt: r.createdAt,
  }));
}

function deleteWorkflow(id) {
  const task = scheduledTasks.get(id);
  if (task) {
    task.stop();
    scheduledTasks.delete(id);
  }
  db.deleteWorkflow(id);
  return true;
}

function toggleWorkflow(id, enabled) {
  db.updateWorkflow(id, { enabled: enabled ? 1 : 0 });
  if (enabled) {
    scheduleWorkflow(id);
  } else {
    const task = scheduledTasks.get(id);
    if (task) {
      task.stop();
      scheduledTasks.delete(id);
    }
  }
}

function scheduleWorkflow(id) {
  const wf = db.getWorkflow(id);
  if (!wf || !wf.enabled) return;

  const triggerConfig = safeJSONParse(wf.triggerConfig, {});

  if (scheduledTasks.has(id)) {
    scheduledTasks.get(id).stop();
    scheduledTasks.delete(id);
  }

  if (wf.triggerType === 'cron' && triggerConfig.cron) {
    try {
      const task = cron.schedule(triggerConfig.cron, () => executeWorkflow(id), {
        scheduled: true,
        timezone: 'Asia/Shanghai',
      });
      scheduledTasks.set(id, task);
      console.log(`Scheduled workflow "${wf.name}" with cron: ${triggerConfig.cron}`);
    } catch (e) {
      console.error(`Failed to schedule workflow ${id}:`, e.message);
    }
  }
}

async function executeWorkflow(id) {
  const wf = db.getWorkflow(id);
  if (!wf) return;

  const actionConfig = safeJSONParse(wf.actionConfig, {});
  const now = Date.now();
  let status = 'success';
  let result = '';

  try {
    if (wf.actionType === 'ai_message' && actionConfig.prompt) {
      const resp = await callLLM(
        [
          { role: 'system', content: '你是 LifeOS 的提醒助手，请生成简洁的提醒内容。用中文回答，不超过100字。' },
          { role: 'user', content: actionConfig.prompt },
        ],
        [],
        false
      );
      result = resp.message?.content || '提醒内容生成失败';
    } else {
      result = `执行了动作：${wf.actionType}`;
    }
  } catch (e) {
    status = 'error';
    result = e.message;
  }

  db.updateWorkflow(id, { lastRunAt: now });
  db.addWorkflowLog({ workflowId: id, status, result, executedAt: now });

  console.log(`Workflow "${wf.name}" executed: ${status} - ${result.slice(0, 80)}`);
  return { status, result };
}

function getWorkflowLogs(workflowId, limit = 20) {
  return db
    .getWorkflowLogs(workflowId, limit)
    .map((l) => ({ id: l.id, status: l.status, result: l.result, executedAt: l.createdAt }));
}

function startWorkflowEngine() {
  const wfs = db.listWorkflows().filter((w) => w.enabled);
  wfs.forEach((wf) => scheduleWorkflow(wf.id));
  console.log(`Workflow engine started, ${wfs.length} workflows scheduled`);
}

function safeJSONParse(str, fallback) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str || fallback;
  } catch {
    return fallback;
  }
}

module.exports = {
  createWorkflow,
  listWorkflows,
  deleteWorkflow,
  toggleWorkflow,
  executeWorkflow,
  getWorkflowLogs,
  startWorkflowEngine,
};
