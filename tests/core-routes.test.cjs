'use strict';

/**
 * test:core-routes —— 核心业务路由 HTTP 集成（S2 T22）。
 * 覆盖：CRUD 全链路、revision 冲突 409、非法输入 422、未打开 Vault 503、软删除 404。
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

function tmpVault() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
}

async function withApp(fn) {
  const dir = tmpVault();
  const svc = new VaultService();
  const app = createApp({ token: TOKEN, services: { vault: svc } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // 打开 Vault
  const token = svc.registerPathToken(dir);
  await fetch(`${base}/api/v1/vault/open`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...AUTH },
    body: JSON.stringify({ token }),
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
    await fn({ api });
  } finally {
    await new Promise((r) => server.close(r));
    svc.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('核心业务 CRUD 经 HTTP 全链路 + 今日/日历投影', async () => {
  await withApp(async ({ api }) => {
    const g = await api('POST', '/api/v1/goals', { title: 'g', area: '学习' });
    assert.strictEqual(g.status, 201);
    const goal = g.body.data;
    assert.strictEqual(goal.status, 'active');

    const p = await api('POST', '/api/v1/projects', { title: 'p', area: '学习', goalId: goal.id });
    assert.strictEqual(p.status, 201);

    const t = await api('POST', '/api/v1/tasks', {
      title: 't',
      projectId: p.body.data.id,
      scheduledDate: '2027-03-10',
    });
    assert.strictEqual(t.status, 201);
    assert.strictEqual(t.body.data.status, 'todo');

    const today = await api('GET', '/api/v1/today?date=2027-03-10');
    assert.deepStrictEqual(today.body.data.map((x) => x.title), ['t']);

    const cal = await api('GET', '/api/v1/calendar?from=2027-03-09&to=2027-03-11');
    assert.strictEqual(cal.body.data.length, 1);
  });
});

test('PATCH 版本冲突返回 409 revision_conflict', async () => {
  await withApp(async ({ api }) => {
    const t = await api('POST', '/api/v1/tasks', { title: 't' });
    const id = t.body.data.id;
    const r1 = await api('PATCH', `/api/v1/tasks/${id}`, { expectedRevision: 1, changes: { title: 't2' } });
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.body.data.revision, 2);
    const r2 = await api('PATCH', `/api/v1/tasks/${id}`, { expectedRevision: 1, changes: { title: 't3' } });
    assert.strictEqual(r2.status, 409);
    assert.strictEqual(r2.body.error.code, 'revision_conflict');
  });
});

test('非法输入返回 422 validation', async () => {
  await withApp(async ({ api }) => {
    assert.strictEqual((await api('POST', '/api/v1/tasks', { title: '' })).status, 422);
    assert.strictEqual((await api('POST', '/api/v1/tasks', { title: 'x', status: 'bogus' })).status, 422);
  });
});

test('删除后 get 返回 404，列表不再包含', async () => {
  await withApp(async ({ api }) => {
    const t = await api('POST', '/api/v1/tasks', { title: 't' });
    const id = t.body.data.id;
    assert.strictEqual((await api('DELETE', `/api/v1/tasks/${id}`)).status, 200);
    assert.strictEqual((await api('GET', `/api/v1/tasks/${id}`)).status, 404);
    const list = await api('GET', '/api/v1/tasks');
    assert.deepStrictEqual(list.body.data, []);
  });
});

test('未打开 Vault 时核心路由返回 503', async () => {
  const dir = tmpVault();
  const svc = new VaultService();
  const app = createApp({ token: TOKEN, services: { vault: svc } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(`${base}/api/v1/tasks`, { headers: AUTH });
    assert.strictEqual(res.status, 503);
  } finally {
    await new Promise((r) => server.close(r));
    svc.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('阶段/里程碑 CRUD 与任务一致性', async () => {
  await withApp(async ({ api }) => {
    const p = await api('POST', '/api/v1/projects', { title: 'p', area: 'a' });
    const pid = p.body.data.id;

    const s = await api('POST', `/api/v1/projects/${pid}/stages`, { title: '阶段1', ord: 0 });
    assert.strictEqual(s.status, 201);
    assert.strictEqual(s.body.data.projectId, pid);

    const m = await api('POST', `/api/v1/projects/${pid}/milestones`, { title: '里程碑1', ord: 0 });
    assert.strictEqual(m.status, 201);
    const mid = m.body.data.id;

    const list = await api('GET', `/api/v1/projects/${pid}/milestones`);
    assert.strictEqual(list.body.data.length, 1);

    // 任务关联里程碑
    const t = await api('POST', '/api/v1/tasks', { title: 't', projectId: pid, milestoneId: mid });
    assert.strictEqual(t.status, 201);

    // 编辑里程碑
    const e = await api('PATCH', `/api/v1/milestones/${mid}`, {
      expectedRevision: 1,
      changes: { title: '改' },
    });
    assert.strictEqual(e.status, 200);
    assert.strictEqual(e.body.data.title, '改');
  });
});
