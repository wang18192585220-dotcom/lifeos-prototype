'use strict';

/**
 * Agent 编排器（S3 T30，README 7.1）。
 *
 * 单次对话流程：保存用户消息 → 组装角色提示 + 会话上下文 → 调用模型 →
 * 工具循环（最多 8 次迭代）→ 业务变更只产生提案 → 保存助手消息。
 */
const MAX_TOOL_ITERATIONS = 8;
const CONTEXT_MESSAGES = 20;

class Orchestrator {
  constructor({ core, proposals, sessions, tools }) {
    this.core = core;
    this.proposals = proposals;
    this.sessions = sessions;
    this.tools = tools;
  }

  /**
   * @param {object} opts
   * @param {string} opts.sessionId
   * @param {string} opts.userMessage
   * @param {object} opts.agent 角色（含 rolePrompt）
   * @param {object} opts.modelClient ChatClient
   * @param {Function} [opts.onEvent] 事件回调（SSE）
   */
  async runTurn({ sessionId, userMessage, agent, modelClient, onEvent = () => {} }) {
    this.sessions.addMessage(sessionId, { role: 'user', content: userMessage });

    const messages = [];
    if (agent && agent.rolePrompt) messages.push({ role: 'system', content: agent.rolePrompt });
    for (const m of this.sessions.listMessages(sessionId).slice(-CONTEXT_MESSAGES)) {
      messages.push({ role: m.role, content: m.content });
    }

    let assistantContent = '';
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const resp = await modelClient.chat(messages, { tools: this.tools.definitions() });
      assistantContent = resp.content;

      if (!resp.toolCalls || resp.toolCalls.length === 0) {
        this.sessions.addMessage(sessionId, { role: 'assistant', content: assistantContent });
        onEvent({ type: 'run.done', payload: { content: assistantContent } });
        return { content: assistantContent, toolCalls: [] };
      }

      messages.push({
        role: 'assistant',
        content: assistantContent,
        tool_calls: resp.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      for (const tc of resp.toolCalls) {
        onEvent({ type: 'tool.started', payload: { name: tc.name } });
        let args = {};
        try {
          args = JSON.parse(tc.arguments || '{}');
        } catch (_) {
          args = {};
        }
        try {
          const result = await this.tools.execute(tc.name, args);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
          onEvent({ type: 'tool.result', payload: { name: tc.name, ok: true } });
        } catch (e) {
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: e.message }) });
          onEvent({ type: 'tool.result', payload: { name: tc.name, ok: false, error: e.message } });
        }
      }
    }

    const e = new Error('达到最大工具迭代次数');
    e.code = 'MAX_TOOL_ITERATIONS';
    throw e;
  }
}

module.exports = { Orchestrator, MAX_TOOL_ITERATIONS };
