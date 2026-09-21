'use strict';

/**
 * test:contracts —— 接口契约测试（S1 / T12）。
 * 校验 docs/openapi.yaml 与实际注册路由、成功/错误信封格式一致（README 12）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { createApp } = require('../server/app.cjs');

function loadOpenapi() {
  const p = path.join(__dirname, '..', 'docs', 'openapi.yaml');
  return yaml.load(fs.readFileSync(p, 'utf8'));
}

/** 收集 Express 应用实际注册的路由（GET/POST 等） */
function registeredRoutes(app) {
  const out = [];
  const stack = app._router && app._router.stack ? app._router.stack : [];
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]);
      out.push({ path: layer.route.path, methods });
    }
  }
  return out;
}

async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test('openapi.yaml 是合法 OpenAPI 3.1 文档，含通用契约', () => {
  const doc = loadOpenapi();
  assert.strictEqual(doc.openapi, '3.1.0');
  assert.ok(Object.keys(doc.paths).length > 0);
  assert.ok(doc.components.schemas.Error, '应定义 Error');
  assert.ok(doc.components.schemas.Envelope, '应定义 Envelope');
  assert.ok(doc.components.schemas.TaskStatus, '应定义 TaskStatus 枚举');
});

test('所有实际注册路由都在 openapi 中声明且方法一致', () => {
  const doc = loadOpenapi();
  const app = createApp({ token: 't' });
  const routes = registeredRoutes(app);
  assert.ok(routes.length > 0, '应至少注册一个路由');
  for (const r of routes) {
    const pathItem = doc.paths[r.path];
    assert.ok(pathItem, `openapi 未声明路由 ${r.path}`);
    for (const m of r.methods) {
      assert.ok(pathItem[m.toLowerCase()], `openapi 未声明 ${m} ${r.path}`);
    }
  }
});

test('错误响应符合 ErrorEnvelope（code/message/requestId）', async () => {
  const app = createApp({ token: 't' });
  await withServer(app, async (base) => {
    const cases = [
      { url: `${base}/api/v1/health`, expect: 401, code: 'unauthorized' },
      {
        url: `${base}/api/v1/nope`,
        headers: { authorization: 'Bearer t' },
        expect: 404,
        code: 'not_found',
      },
    ];
    for (const c of cases) {
      const res = await fetch(c.url, { headers: c.headers || {} });
      assert.strictEqual(res.status, c.expect, c.url);
      const body = await res.json();
      assert.ok(body.error, '错误响应含 error');
      assert.strictEqual(body.error.code, c.code);
      assert.ok(typeof body.error.message === 'string');
      assert.ok(body.error.requestId, '错误响应含 requestId');
    }
  });
});

test('成功响应符合 Envelope（含 data）', async () => {
  const app = createApp({ token: 't' });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/v1/health`, { headers: { authorization: 'Bearer t' } });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok('data' in body, '成功响应含 data');
  });
});

test('S2 核心业务路由均在 openapi 中声明', () => {
  const doc = loadOpenapi();
  const required = [
    ['/api/v1/goals', 'get'],
    ['/api/v1/goals', 'post'],
    ['/api/v1/goals/{id}', 'patch'],
    ['/api/v1/goals/{id}', 'delete'],
    ['/api/v1/projects', 'get'],
    ['/api/v1/projects', 'post'],
    ['/api/v1/projects/{id}', 'patch'],
    ['/api/v1/projects/{id}/stages', 'post'],
    ['/api/v1/projects/{id}/milestones', 'post'],
    ['/api/v1/projects/{id}/plan', 'get'],
    ['/api/v1/projects/{id}/plan-versions', 'post'],
    ['/api/v1/plans/{id}/versions', 'get'],
    ['/api/v1/tasks', 'get'],
    ['/api/v1/tasks', 'post'],
    ['/api/v1/tasks/{id}', 'patch'],
    ['/api/v1/tasks/{id}', 'delete'],
    ['/api/v1/today', 'get'],
    ['/api/v1/calendar', 'get'],
  ];
  for (const [p, m] of required) {
    assert.ok(doc.paths[p] && doc.paths[p][m], `openapi 应声明 ${m.toUpperCase()} ${p}`);
  }
});
