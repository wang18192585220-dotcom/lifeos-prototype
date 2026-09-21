'use strict';

/**
 * test:s4-routes —— S4 路由 HTTP 集成（学习/评估/记忆/Skills/工作流）。
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

test('学习档案 + 能力评估确认全链路', async () => {
  await withApp(async ({ api, svc }) => {
    const p = await api('POST', '/api/v1/learning-profiles', { language: 'es', purpose: 'exam_preparation', targetLevelMax: 'B2' });
    assert.strictEqual(p.status, 201);

    const rec = await api('POST', '/api/v1/learning-records', {
      profileId: p.body.data.id,
      startedAt: '2027-03-10T09:00:00Z',
      endedAt: '2027-03-10T09:30:00Z',
      result: '8/10',
    });
    assert.strictEqual(rec.body.data.durationMinutes, 30);

    // 评估（经服务提出，确认走路由）
    const a = svc.services.learning.proposeAssessment({ capability: '听力', judgment: 'B1 水平', evidence: 'x' });
    const confirm = await api('POST', `/api/v1/assessments/${a.id}/confirm`, { by: 'user' });
    assert.strictEqual(confirm.body.data.status, 'confirmed');
  });
});

test('记忆保存与删除', async () => {
  await withApp(async ({ api, svc }) => {
    const m = svc.services.memory.saveMemory({ kind: 'summary', agentId: 'a1', contentRef: 'c1' });
    const list = await api('GET', '/api/v1/memories?agentId=a1');
    assert.strictEqual(list.body.data.length, 1);
    await api('DELETE', `/api/v1/memories/${m.id}`);
    const after = await api('GET', '/api/v1/memories?agentId=a1');
    assert.deepStrictEqual(after.body.data, []);
  });
});

test('Skill 草稿 → 安装 → 启用 → 绑定', async () => {
  await withApp(async ({ api }) => {
    const d = await api('POST', '/api/v1/skills/drafts', { name: 'study-review', description: '复盘' });
    assert.strictEqual(d.status, 201);
    const id = d.body.data.id;
    assert.strictEqual((await api('POST', `/api/v1/skills/${id}/install`)).body.data.installStatus, 'installed');
    assert.strictEqual((await api('POST', `/api/v1/skills/${id}/enable`)).body.data.enabled, true);
    await api('PUT', `/api/v1/skills/${id}/bind`, { agentId: 'agent-a', version: '1.0' });
    const list = await api('GET', '/api/v1/skills');
    assert.ok(list.body.data.length >= 1, '应至少包含创建的 Skill');
  });
});

test('工作流创建与手动执行', async () => {
  await withApp(async ({ api }) => {
    const wf = await api('POST', '/api/v1/workflows', { trigger: { daily: '09:00' }, action: { kind: 'review' } });
    assert.strictEqual(wf.status, 201);
    const run = await api('POST', `/api/v1/workflows/${wf.body.data.id}/run`);
    assert.strictEqual(run.body.data.status, 'succeeded');
  });
});
