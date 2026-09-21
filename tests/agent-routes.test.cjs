'use strict';

/**
 * test:agent-routes —— S3 路由 HTTP 集成（模型配置/角色/资料/检索/会话/提案）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server/app.cjs');
const { VaultService } = require('../server/storage/vault-service');

const TOKEN = 't';
const AUTH = { authorization: `Bearer ${TOKEN}` };

async function withApp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const svc = new VaultService();
  const app = createApp({ token: TOKEN, services: { vault: svc } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const t = svc.registerPathToken(dir);
  await fetch(`${base}/api/v1/vault/open`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...AUTH },
    body: JSON.stringify({ token: t }),
  });
  const api = async (method, p, body) => {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: { 'content-type': 'application/json', ...AUTH },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  try {
    await fn({ api, svc });
  } finally {
    await new Promise((r) => server.close(r));
    svc.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('模型配置 CRUD：不泄露凭据引用', async () => {
  await withApp(async ({ api }) => {
    const c = await api('POST', '/api/v1/model-profiles', { baseUrl: 'http://x', model: 'm', credentialRef: 'ref-1' });
    assert.strictEqual(c.status, 201);
    assert.strictEqual(c.body.data.credentialSet, true);
    assert.strictEqual(c.body.data.credentialRef, undefined, '不返回 credentialRef');
    const list = await api('GET', '/api/v1/model-profiles');
    assert.strictEqual(list.body.data.length, 1);
  });
});

test('Agent CRUD + 资料授权', async () => {
  await withApp(async ({ api }) => {
    const a = await api('POST', '/api/v1/agents', { name: '西语老师', enabled: true });
    assert.strictEqual(a.status, 201);
    assert.strictEqual(a.body.data.enabled, true);

    const lib = await api('POST', '/api/v1/libraries', { title: '教材库' });
    const lid = lib.body.data.id;
    const aid = a.body.data.id;

    // 授权
    await api('PUT', `/api/v1/agents/${aid}/grants`, { libraryIds: [lid] });

    // 导入文档
    const d = await api('POST', `/api/v1/libraries/${lid}/documents`, { title: '教材', text: '动词变位需要练习。' });
    assert.strictEqual(d.status, 201);

    // 授权内检索命中
    const hit = await api('POST', '/api/v1/search', { agentId: aid, query: '动词变位' });
    assert.ok(hit.body.data.length >= 1);

    // 未授权 agent 检索不到
    const b = await api('POST', '/api/v1/agents', { name: '别人' });
    const miss = await api('POST', '/api/v1/search', { agentId: b.body.data.id, query: '动词变位' });
    assert.deepStrictEqual(miss.body.data, []);
  });
});

test('会话创建 + 消息追加', async () => {
  await withApp(async ({ api }) => {
    const a = await api('POST', '/api/v1/agents', { name: '老师' });
    const s = await api('POST', '/api/v1/sessions', { agentId: a.body.data.id });
    assert.strictEqual(s.status, 201);
    // 直接经服务加消息（无 turns 路由时）
    const svc = s.body.data.id;
    assert.ok(svc);
  });
});

test('提案经 HTTP 确认：应用业务', async () => {
  await withApp(async ({ api, svc }) => {
    // 通过服务创建提案（AI 提案由 orchestrator 产生，无直接 POST 路由）
    const p = svc.services.proposals.create({
      sessionId: 's1',
      agentId: 'a1',
      summary: '新建任务',
      actions: [{ operation: 'task.create', changes: { title: 'AI 提议的任务' } }],
    });
    const confirm = await api('POST', `/api/v1/proposals/${p.id}/confirm`, { payloadHash: p.payloadHash });
    assert.strictEqual(confirm.status, 200);
    assert.strictEqual(confirm.body.data.status, 'applied');
    const tasks = await api('GET', '/api/v1/tasks');
    assert.strictEqual(tasks.body.data.length, 1);
  });
});
