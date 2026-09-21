'use strict';

/**
 * test:orchestrator —— Agent 工具循环编排（S3 T30）。
 * 用 mock 模型验证：首轮返回工具调用 → 执行真实工具 → 二轮返回最终答复。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { openVault } = require('../server/storage/vault');
const { CoreService } = require('../server/modules/core');
const { SessionService, ProposalService, buildTools, Orchestrator, ChatClient } = require('../server/modules/agent');

/** mock 模型：首轮调用 read_tasks，二轮（收到 tool 结果）返回最终答复。 */
function startMock() {
  const app = express();
  app.use(express.json());
  app.post('/chat/completions', (req, res) => {
    const messages = req.body.messages || [];
    const hasToolResult = messages.some((m) => m.role === 'tool');
    if (hasToolResult) {
      const toolMsg = messages.find((m) => m.role === 'tool');
      const count = (JSON.parse(toolMsg.content).length);
      return res.json({
        choices: [{ message: { role: 'assistant', content: `你当前有 ${count} 个任务。` }, finish_reason: 'stop' }],
      });
    }
    return res.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read_tasks', arguments: '{}' } }],
          },
          finish_reason: 'tool_calls',
        },
      ],
    });
  });
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

test('工具循环：模型调用 read_tasks → 执行 → 最终答复', async () => {
  const { server, baseUrl } = await startMock();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  try {
    const core = new CoreService(v.adapter);
    const sessions = new SessionService(v.adapter);
    const proposals = new ProposalService(v.adapter, core);
    core.createTask({ title: '任务1' });
    core.createTask({ title: '任务2' });

    const session = sessions.createSession('agent-1');
    const agent = { rolePrompt: '你是西班牙语老师' };
    const tools = buildTools({ core, proposals, getContext: () => ({ sessionId: session.id, agentId: 'agent-1' }) });
    const orchestrator = new Orchestrator({ core, proposals, sessions, tools });
    const client = new ChatClient({ baseUrl, apiKey: 'k', model: 'm' });

    const events = [];
    const result = await orchestrator.runTurn({
      sessionId: session.id,
      userMessage: '我有多少任务？',
      agent,
      modelClient: client,
      onEvent: (e) => events.push(e),
    });

    assert.match(result.content, /2 个任务/);
    assert.ok(events.some((e) => e.type === 'tool.started' && e.payload.name === 'read_tasks'));
    assert.ok(events.some((e) => e.type === 'tool.result' && e.payload.ok));

    // 会话持久化：user + assistant
    const msgs = sessions.listMessages(session.id);
    assert.strictEqual(msgs.length, 2);
    assert.strictEqual(msgs[0].role, 'user');
    assert.strictEqual(msgs[1].role, 'assistant');
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
    server.close();
  }
});

test('propose_changes 工具只创建提案，不直接改业务', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  try {
    const core = new CoreService(v.adapter);
    const sessions = new SessionService(v.adapter);
    const proposals = new ProposalService(v.adapter, core);
    const session = sessions.createSession('agent-1');
    const tools = buildTools({ core, proposals, getContext: () => ({ sessionId: session.id, agentId: 'agent-1' }) });

    const prop = await tools.execute('propose_changes', {
      summary: '新建任务',
      actions: [{ operation: 'task.create', changes: { title: 'AI 提议' } }],
    });

    assert.strictEqual(prop.status, 'pending');
    // 业务未变（提案未确认）
    assert.deepStrictEqual(core.tasks.list(), []);
    // 提案存在
    assert.strictEqual(proposals.list().length, 1);
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
