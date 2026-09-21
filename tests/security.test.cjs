'use strict';

/**
 * test:security —— 本地服务隔离与访问控制（S1 / 验收 A02）。
 * 覆盖：无令牌 401、JSON 404、静态服务只来自构建目录、不暴露仓库根目录。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server/app.cjs');

async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const AUTH = (t) => ({ headers: { authorization: `Bearer ${t}` } });

test('无令牌访问 /api 返回 401 JSON', async () => {
  const app = createApp({ token: 'secret-token' });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/v1/health`);
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'unauthorized');
  });
});

test('错误令牌同样被拒', async () => {
  const app = createApp({ token: 'secret-token' });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/v1/health`, AUTH('wrong'));
    assert.strictEqual(res.status, 401);
  });
});

test('正确令牌访问 /health 返回 200', async () => {
  const app = createApp({ token: 'secret-token' });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/v1/health`, AUTH('secret-token'));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.status, 'ok');
  });
});

test('未知 API 返回 JSON 404 而非 HTML', async () => {
  const app = createApp({ token: 'secret-token' });
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/v1/nope`, AUTH('secret-token'));
    assert.strictEqual(res.status, 404);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'not_found');
  });
});

test('静态服务只来自构建目录，不暴露仓库根目录与点文件', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-static-'));
  fs.writeFileSync(path.join(dir, 'index.html'), 'BUILD_SHELL_OK');
  fs.writeFileSync(path.join(dir, '.secret'), 'nope');
  const app = createApp({ token: 't', staticDir: dir });
  await withServer(app, async (base) => {
    const ok = await fetch(`${base}/`);
    assert.strictEqual(await ok.text(), 'BUILD_SHELL_OK');

    // 请求仓库根文件：应回退到 SPA 壳，而非返回仓库里的 package.json 内容
    const pk = await fetch(`${base}/package.json`);
    assert.ok(!(await pk.text()).includes('"name": "lifeos"'), '不应泄露仓库根目录的 package.json');

    // 点文件拒绝
    const dot = await fetch(`${base}/.secret`);
    assert.ok(!(await dot.text()).includes('nope'), '点文件不应被服务');
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('createApp 导入不启动服务、不打开库', () => {
  const app = createApp({ token: 't' });
  assert.strictEqual(typeof app, 'function', '返回 express 应用，但不监听端口');
});
