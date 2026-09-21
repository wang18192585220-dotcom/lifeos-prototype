'use strict';

/**
 * 受限 bridge（S1 T11）。
 *
 * 通过 contextBridge.exposeInMainWorld 暴露 window.lifeos，仅含白名单能力。
 * 不暴露 ipcRenderer / require / process / Node 原生能力 / 任意 HTTP 或文件系统。
 * 令牌与 baseUrl 只保存在本模块内存，不落盘、不写入 global。
 */

const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

// 会话令牌与地址只保存在 preload 内存。
let boot = null;

async function ensureBootstrap() {
  if (!boot) {
    boot = await ipcRenderer.invoke('lifeos:bootstrap');
  }
  return boot;
}

function assertSafePath(path) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('path 必须是非空字符串');
  }
  if (path.includes('://') || path.startsWith('//')) {
    throw new Error('拒绝绝对 URL');
  }
  if (!path.startsWith('/api/')) {
    throw new Error('只允许访问 /api/ 白名单接口');
  }
  return path;
}

/**
 * 转发到本地服务并返回 JSON。令牌由 preload 注入，不暴露给任意 URL/HTTP。
 * @param {string} method 白名单方法
 * @param {string} path 必须以 /api/ 开头
 * @param {*} [body] 可选 JSON 请求体
 */
async function request(method, path, body) {
  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`不支持的方法: ${method}`);
  }
  const safePath = assertSafePath(path);
  const { baseUrl, token } = await ensureBootstrap();

  const hasBody = body !== undefined && body !== null;
  const res = await fetch(`${baseUrl}${safePath}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = text;
    }
  }
  if (!res.ok) {
    const err = new Error(
      (data && data.error && data.error.message) || `请求失败（HTTP ${res.status}）`
    );
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function getBootstrap() {
  // 只返回 baseUrl；令牌留在 preload 内部，不暴露给 renderer（README 4.2）。
  return ensureBootstrap().then((b) => ({ baseUrl: b.baseUrl }));
}

function selectVault() {
  return ipcRenderer.invoke('lifeos:select-vault');
}

// S3 实现真实事件订阅；S1 只留接口并显式说明未实现。
function onEvent() {
  throw new Error('LifeOS: onEvent 未实现（S3 接入真实订阅）');
}

function offEvent() {
  throw new Error('LifeOS: offEvent 未实现（S3 接入真实订阅）');
}

contextBridge.exposeInMainWorld('lifeos', {
  request,
  getBootstrap,
  selectVault,
  onEvent,
  offEvent,
});

// 通知主进程 bridge 已就绪（供 --smoke 校验）
ipcRenderer.send('lifeos:bridge-ready');
