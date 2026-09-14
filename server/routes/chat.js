const express = require('express');
const router = express.Router();
const { callLLM, getProviderConfig } = require('../services/llm');
const { getConfig } = require('../services/db');
const knowledge = require('../services/knowledge');
const skills = require('../services/skills');

// Build system prompt with knowledge context
async function buildSystemPrompt(internalData, agentOverride) {
  const cfg = getConfig();
  const todayKey = new Date().toISOString().slice(0, 10);

  let systemPrompt = '';
  if (agentOverride && agentOverride.systemPrompt) {
    systemPrompt = agentOverride.systemPrompt;
    systemPrompt += `\n\n今天日期：${todayKey}
你运行在"LifeOS · 个人智能操作系统"中。回答简洁、实用、有行动导向，使用中文。`;
  } else {
    systemPrompt = cfg.systemPrompt || '';
    systemPrompt += `\n\n你是 LifeOS AI，嵌入在"LifeOS · 个人智能操作系统"中，是用户 Shiyu 的个人智能助手。
今天日期：${todayKey}
回答简洁、实用、有行动导向，使用中文。`;
  }

  // Inject knowledge base context if enabled
  if (cfg.knowledgeEnabled !== 'false') {
    // Internal LifeOS data
    if (cfg.knowledgeInternalData !== 'false' && internalData) {
      systemPrompt += `\n\n## 当前 LifeOS 数据\n${internalData}`;
    }
  }

  return systemPrompt;
}

// Non-streaming chat (kept for compatibility)
router.post('/', async (req, res) => {
  try {
    const { messages = [], internalData = '', knowledgeId, knowledgeDocumentIds } = req.body;
    const systemContent = await buildSystemPrompt(internalData);
    const fullMessages = [{ role: 'system', content: systemContent }, ...messages];

    // Get enabled skill tool definitions
    const toolDefs = skills.getEnabledToolDefs();

    // Add knowledge retrieval to context if enabled
    const cfg = getConfig();
    if (cfg.knowledgeEnabled !== 'false' && !(Array.isArray(knowledgeDocumentIds) && knowledgeDocumentIds.length === 0)) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        const maxChunks = parseInt(cfg.knowledgeMaxChunks) || 5;
        const relevant = await knowledge.retrieveRelevant(lastUserMsg.content, maxChunks, knowledgeId, knowledgeDocumentIds);
        if (relevant.length > 0) {
          const contextText = relevant.map((r, i) =>
            `[${i + 1}] 来源：${r.source}${r.title ? ` - ${r.title}` : ''}\n${r.content}`
          ).join('\n\n');
          fullMessages.splice(fullMessages.length - 1, 0, {
            role: 'system',
            content: `以下是知识库中与用户问题相关的内容，请在回答时参考：\n\n${contextText}`
          });
        }
      }
    }

    const resp = await callLLM(fullMessages, toolDefs.map(t => t.function), false);
    res.json({ ok: true, message: resp.message, usage: resp.usage });
  } catch (err) {
    res.status(err.message === 'NO_API_KEY' ? 400 : 500).json({
      ok: false,
      error: err.message
    });
  }
});

// Streaming chat (SSE)
router.post('/stream', async (req, res) => {
  const { messages = [], internalData = '', extraTools = [], agentSystemPrompt = '', temperature = null, knowledgeId, knowledgeDocumentIds } = req.body;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const cfg = getConfig();
    const systemContent = await buildSystemPrompt(internalData, agentSystemPrompt ? { systemPrompt: agentSystemPrompt } : null);
    let fullMessages = [{ role: 'system', content: systemContent }, ...messages];

    // Retrieve knowledge
    if (cfg.knowledgeEnabled !== 'false' && !(Array.isArray(knowledgeDocumentIds) && knowledgeDocumentIds.length === 0)) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        const maxChunks = parseInt(cfg.knowledgeMaxChunks) || 5;
        send('status', { status: 'searching_knowledge' });
        const relevant = await knowledge.retrieveRelevant(lastUserMsg.content, maxChunks, knowledgeId, knowledgeDocumentIds);
        if (relevant.length > 0) {
          const contextText = relevant.map((r, i) =>
            `[${i + 1}] ${r.source}${r.title ? ' - ' + r.title : ''}\n${r.content}`
          ).join('\n\n');
          fullMessages.splice(fullMessages.length - 1, 0, {
            role: 'system',
            content: `以下是知识库中与用户问题相关的内容，请在回答时参考：\n\n${contextText}`
          });
          send('knowledge', { sources: relevant.map(r => ({ source: r.source, title: r.title })) });
        }
      }
    }

    // 提取裸 function 对象（callLLM 内部会包装 type:'function'）
    const toolDefs = skills.getEnabledToolDefs();
    const backendTools = toolDefs.map(t => t.function);
    const extraToolFcns = (extraTools || []).map(t => t.function || t);
    const allTools = [...backendTools, ...extraToolFcns];
    const llmOptions = {};
    if (temperature != null) llmOptions.temperature = temperature;
    const llmResp = await callLLM(fullMessages, allTools, true, llmOptions);

    send('status', { status: 'generating' });

    const reader = llmResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let toolCalls = [];

    // Note: SSE streaming parsing for OpenAI-compatible APIs
    // This is a simplified version - a production version would handle Claude streaming too
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          send('done', { content: fullContent, toolCalls });
          res.end();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            send('content', { content: delta.content });
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: tc.id, function: { name: '', arguments: '' } };
              if (tc.id) toolCalls[tc.index].id = tc.id;
              if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        } catch (e) { /* skip malformed JSON */ }
      }
    }

    send('done', { content: fullContent, toolCalls: toolCalls.filter(Boolean) });
    res.end();
  } catch (err) {
    send('error', { error: err.message });
    res.end();
  }
});

// Execute a skill/tool call from frontend (after user confirmation etc.)
router.post('/tool', async (req, res) => {
  try {
    const { name, args } = req.body;
    const result = await skills.executeSkill(name, args);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
