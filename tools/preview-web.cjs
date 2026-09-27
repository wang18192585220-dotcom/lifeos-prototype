'use strict';

/**
 * LifeOS Web 预览（仅开发测试用）：
 * 在浏览器里运行 renderer，用 fetch 桥替代 Electron 的 preload bridge。
 *
 * 运行：node tools/preview-web.cjs
 * 然后打开：http://127.0.0.1:4175
 *
 * 说明：自动打开 ./preview-vault 作为默认 Vault；令牌为本地会话令牌，
 * 仅在本地回环地址可用，仅供测试。
 */
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { createApp, generateToken } = require('../server/app.cjs');
const { VaultService } = require('../server/storage/vault-service');
const { CredentialService } = require('../server/platform/credentials');

const PORT = Number(process.env.LIFEOS_PREVIEW_PORT || 4175);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const rendererDir = path.join(__dirname, '..', 'renderer');
const vaultDir = path.join(__dirname, '..', 'preview-vault');

const token = generateToken();
const vault = new VaultService();
vault.open(vaultDir); // 自动打开默认预览 Vault

const credentials = new CredentialService();
const app = createApp({ token, staticDir: null, services: { vault, credentials } });

// 浏览器端 window.lifeos shim（替代 preload bridge）
app.get('/preview-shim.js', (req, res) => {
  res.type('application/javascript').send(`
window.__LIFEOS_BOOT__ = { baseUrl: ${JSON.stringify(BASE_URL)}, token: ${JSON.stringify(token)}, vaultDir: ${JSON.stringify(vaultDir)} };
window.lifeos = {
  async getBootstrap() { return { baseUrl: window.__LIFEOS_BOOT__.baseUrl }; },
  async request(method, path, body) {
    const boot = window.__LIFEOS_BOOT__;
    const res = await fetch(boot.baseUrl + path, {
      method,
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + boot.token },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error((data && data.error && data.error.message) || ('HTTP ' + res.status));
      err.status = res.status;
      err.body = data;
      err.code = data && data.error && data.error.code;
      throw err;
    }
    return data;
  },
  // 预览模式已自动打开 Vault，故只返回路径、不签发一次性令牌（与桌面 preload 语义对齐）。
  async selectVault() { return { path: window.__LIFEOS_BOOT__.vaultDir }; },
  onEvent() { throw new Error('onEvent 未实现'); },
  offEvent() {},
};
`);
});

// 注入 shim 到 index.html
app.get('/', (req, res) => {
  let html = fs.readFileSync(path.join(rendererDir, 'index.html'), 'utf8');
  html = html.replace(
    '<script type="module" src="./main.js"></script>',
    '<script src="./preview-shim.js"></script>\n    <script type="module" src="./main.js"></script>'
  );
  res.type('html').send(html);
});

// 静态服务 renderer/（index.html 已由上面注入，index:false 避免覆盖）
app.use(express.static(rendererDir, { dotfiles: 'deny', index: false }));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`LifeOS Web 预览：${BASE_URL}`);
  console.log(`Vault：${vaultDir}`);
});
