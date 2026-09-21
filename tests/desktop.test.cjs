'use strict';

/**
 * test:desktop —— 桌面端生命周期、受限 bridge 与本地服务隔离（S1 T11）。
 *
 * 覆盖：
 *  1. --smoke 冒烟：spawn 本地 electron 二进制（等价于 `npx electron desktop/main.cjs --smoke`），
 *     断言退出码 0 且 stdout 含 SMOKE_OK。
 *  2. 纯逻辑静态检查：preload 只暴露白名单能力、client.js 只经 bridge 请求、
 *     renderer 不把令牌写入 localStorage。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

// require('electron') 返回本地 electron 可执行文件路径（与 `npx electron` 内部行为等价）。
function electronBinary() {
  return require('electron');
}

function runSmoke() {
  return new Promise((resolve) => {
    const child = spawn(electronBinary(), ['desktop/main.cjs', '--smoke'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => resolve({ code: null, stdout, stderr, error: String(err) }));
    child.on('close', (code) => resolve({ code, stdout, stderr, error: null }));
  });
}

test(
  '--smoke：启动、bridge 就绪、health 通过后打印 SMOKE_OK 且退出码 0',
  { timeout: 120_000 },
  async () => {
    const result = await runSmoke();
    if (result.error) {
      assert.fail(`无法启动 Electron: ${result.error}`);
    }
    assert.strictEqual(
      result.code,
      0,
      `退出码应为 0，实际 ${result.code}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
    assert.match(result.stdout, /SMOKE_OK/, `stdout 应包含 SMOKE_OK\nstdout:\n${result.stdout}`);
  }
);

test('preload 只暴露白名单能力，不暴露 ipcRenderer/require/process 等', () => {
  const src = fs.readFileSync(path.join(ROOT, 'desktop/preload.cjs'), 'utf8');
  const m = src.match(/exposeInMainWorld\(['"]lifeos['"],\s*\{([\s\S]*?)\n\}\)/);
  assert.ok(m, 'preload 应通过 contextBridge.exposeInMainWorld 暴露 window.lifeos');
  const keys = [...m[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*,?\s*$/gm)].map((x) => x[1]);
  const allowed = ['request', 'getBootstrap', 'selectVault', 'onEvent', 'offEvent'];
  assert.deepStrictEqual(
    keys.slice().sort(),
    allowed.slice().sort(),
    '暴露的能力应恰好等于白名单'
  );
  for (const bad of [
    'ipcRenderer',
    'process',
    'require',
    'child_process',
    'shell',
    'fs',
    'http',
    'https',
    'net',
    'dialog',
    'clipboard',
  ]) {
    assert.ok(!keys.includes(bad), `不应暴露 ${bad}`);
  }
});

test('client.js 只经 window.lifeos.request 访问后端，不直接发 HTTP 或写 localStorage', () => {
  const src = fs.readFileSync(path.join(ROOT, 'renderer/api/client.js'), 'utf8');
  assert.match(src, /window\.lifeos\.request/, 'client 应通过 bridge.request 请求');
  assert.doesNotMatch(src, /\bfetch\s*\(/, 'client 不应直接 fetch');
  assert.doesNotMatch(src, /new\s+XMLHttpRequest|XMLHttpRequest\s*\(/, 'client 不应使用 XHR');
  assert.doesNotMatch(src, /localStorage\s*\./, 'client 不应使用 localStorage');
});

test('renderer main.js 不把令牌持久化到 localStorage', () => {
  const src = fs.readFileSync(path.join(ROOT, 'renderer/main.js'), 'utf8');
  assert.doesNotMatch(src, /localStorage\.setItem/, '不应把令牌写入 localStorage');
  assert.match(src, /window\.lifeos\.getBootstrap/, '应经 bridge 获取 bootstrap');
});
