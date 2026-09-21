'use strict';

/**
 * test:agent —— OpenAI 兼容模型适配器（S3 T30）。
 * 用 mock 模型服务验证：普通回复、流式、工具调用（原生 function calling）、错误分类。
 */
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { ChatClient } = require('../server/modules/agent/model');

/** 构造 mock OpenAI 兼容服务。 */
function startMock() {
  const app = express();
  app.use(express.json());
  app.post('/chat/completions', (req, res) => {
    const { model, stream, messages, tools } = req.body || {};

    // 错误分类触发：用 model 名约定
    if (model === 'err-401') return res.status(401).json({ error: {} });
    if (model === 'err-429') return res.status(429).json({ error: {} });
    if (model === 'err-404') return res.status(404).json({ error: {} });
    if (model === 'err-500') return res.status(500).json({ error: {} });

    const last = (messages && messages[messages.length - 1]) || {};
    const wantsTool = /weather|天气/.test(last.content || '');

    if (stream) {
      res.setHeader('content-type', 'text/event-stream');
      if (wantsTool && tools && tools.length) {
        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '' } }] } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":"' } }] } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: 'NY"}' } }] } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'Hel' } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'lo' } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    if (wantsTool && tools && tools.length) {
      return res.json({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                { id: 'call_1', type: 'function', function: { name: 'get_weather', arguments: '{"city":"NY"}' } },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      });
    }
    return res.json({ choices: [{ message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }] });
  });

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function client(baseUrl, model = 'test-model') {
  return new ChatClient({ baseUrl, apiKey: 'k', model });
}

const TOOL_DEF = [{ type: 'function', function: { name: 'get_weather', parameters: { type: 'object' } } }];

test('普通非流式回复', async () => {
  const { server, baseUrl } = await startMock();
  try {
    const r = await client(baseUrl).chat([{ role: 'user', content: 'hi' }]);
    assert.strictEqual(r.content, 'pong');
    assert.deepStrictEqual(r.toolCalls, []);
  } finally {
    server.close();
  }
});

test('非流式工具调用解析', async () => {
  const { server, baseUrl } = await startMock();
  try {
    const r = await client(baseUrl).chat([{ role: 'user', content: 'weather in NY?' }], { tools: TOOL_DEF });
    assert.strictEqual(r.finishReason, 'tool_calls');
    assert.strictEqual(r.toolCalls.length, 1);
    assert.strictEqual(r.toolCalls[0].name, 'get_weather');
    assert.strictEqual(r.toolCalls[0].arguments, '{"city":"NY"}');
  } finally {
    server.close();
  }
});

test('流式回复：delta 与 finishReason', async () => {
  const { server, baseUrl } = await startMock();
  try {
    const deltas = [];
    let finish;
    for await (const e of client(baseUrl).stream([{ role: 'user', content: 'hi' }])) {
      deltas.push(e.delta);
      if (e.finishReason) finish = e.finishReason;
    }
    assert.strictEqual(deltas.join(''), 'Hello');
    assert.strictEqual(finish, 'stop');
  } finally {
    server.close();
  }
});

test('流式工具调用：参数按 index 累积', async () => {
  const { server, baseUrl } = await startMock();
  try {
    let lastCalls = [];
    for await (const e of client(baseUrl).stream([{ role: 'user', content: 'weather?' }], { tools: TOOL_DEF })) {
      if (e.toolCalls) lastCalls = e.toolCalls;
    }
    assert.strictEqual(lastCalls.length, 1);
    assert.strictEqual(lastCalls[0].name, 'get_weather');
    assert.strictEqual(lastCalls[0].arguments, '{"city":"NY"}');
  } finally {
    server.close();
  }
});

test('错误分类：401/429/404/500', async () => {
  const { server, baseUrl } = await startMock();
  try {
    await assert.rejects(client(baseUrl, 'err-401').chat([{ role: 'user', content: 'x' }]), (e) => e.code === 'AUTH_ERROR');
    await assert.rejects(client(baseUrl, 'err-429').chat([{ role: 'user', content: 'x' }]), (e) => e.code === 'RATE_LIMIT');
    await assert.rejects(client(baseUrl, 'err-404').chat([{ role: 'user', content: 'x' }]), (e) => e.code === 'MODEL_NOT_FOUND');
    await assert.rejects(client(baseUrl, 'err-500').chat([{ role: 'user', content: 'x' }]), (e) => e.code === 'PROVIDER_ERROR');
  } finally {
    server.close();
  }
});
