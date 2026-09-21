'use strict';

/**
 * test:vault —— Vault 打开流程与重启持久化（S1 / T12 集成）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server/app.cjs');
const { VaultService } = require('../server/storage/vault-service');

function tmpVault() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
}

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

const AUTH = { headers: { authorization: 'Bearer t' } };

test('经短期令牌打开 Vault，写入后重启仍在', async () => {
  const dir = tmpVault();
  const svc = new VaultService();
  const app = createApp({ token: 't', services: { vault: svc } });

  await withServer(app, async (base) => {
    // 初始未打开
    const s0 = await (await fetch(`${base}/api/v1/vault/status`, AUTH)).json();
    assert.strictEqual(s0.data.opened, false);

    // 打开
    const token = svc.registerPathToken(dir);
    const r = await fetch(`${base}/api/v1/vault/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
      body: JSON.stringify({ token }),
    });
    assert.strictEqual(r.status, 200);
    const s1 = await r.json();
    assert.strictEqual(s1.data.opened, true);
    assert.strictEqual(s1.data.root, dir);

    // 写入业务数据
    svc.adapter.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run('probe', 'v1');

    // 关闭（模拟退出）
    svc.close();

    // 重启后打开同一目录，数据仍在
    const token2 = svc.registerPathToken(dir);
    const r2 = await fetch(`${base}/api/v1/vault/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
      body: JSON.stringify({ token: token2 }),
    });
    assert.strictEqual(r2.status, 200);
    const row = svc.adapter.prepare("SELECT value FROM app_meta WHERE key='probe'").get();
    assert.strictEqual(row.value, 'v1', '重启后数据仍在');
  });

  svc.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('令牌一次性且过期后无效', async () => {
  const dir = tmpVault();
  const svc = new VaultService();
  const app = createApp({ token: 't', services: { vault: svc } });
  await withServer(app, async (base) => {
    const token = svc.registerPathToken(dir);
    const open = (t) =>
      fetch(`${base}/api/v1/vault/open`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
        body: JSON.stringify({ token: t }),
      });
    assert.strictEqual((await open(token)).status, 200);
    // 第二次用同一令牌 → 无效
    assert.strictEqual((await open(token)).status, 422);
    // 任意令牌 → 无效
    assert.strictEqual((await open('bogus')).status, 422);
  });
  svc.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('打开被占用的 Vault 返回 409 冲突', async () => {
  const dir = tmpVault();
  const svc = new VaultService();
  const app = createApp({ token: 't', services: { vault: svc } });
  // 先由另一个服务占用
  const other = new VaultService();
  other.open(dir);
  try {
    await withServer(app, async (base) => {
      const token = svc.registerPathToken(dir);
      const r = await fetch(`${base}/api/v1/vault/open`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
        body: JSON.stringify({ token }),
      });
      assert.strictEqual(r.status, 409);
      const body = await r.json();
      assert.strictEqual(body.error.code, 'vault_locked');
    });
  } finally {
    svc.close();
    other.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
