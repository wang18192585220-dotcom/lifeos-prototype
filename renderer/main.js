import { get } from './api/client.js';

// baseUrl 只保存在内存变量；令牌由 preload 持有，不进入 renderer（README 4.2）。
const session = { baseUrl: null };

const statusEl = document.getElementById('status');
const vaultEl = document.getElementById('vault-path');

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.className = ok ? 'status connected' : 'status disconnected';
}

async function bootstrap() {
  try {
    const boot = await window.lifeos.getBootstrap();
    session.baseUrl = boot.baseUrl;
    return true;
  } catch (_) {
    setStatus('未连接（bridge 初始化失败）', false);
    return false;
  }
}

async function checkHealth() {
  try {
    const res = await get('/api/v1/health');
    if (res && res.data && res.data.status === 'ok') {
      setStatus('已连接', true);
      return;
    }
    setStatus('未连接', false);
  } catch (_) {
    setStatus('未连接', false);
  }
}

async function onSelectVault() {
  try {
    const p = await window.lifeos.selectVault();
    vaultEl.textContent = p ? `已选择：${p}` : '未选择';
  } catch (_) {
    vaultEl.textContent = '选择失败';
  }
}

async function init() {
  const ok = await bootstrap();
  if (ok) {
    await checkHealth();
  }
}

document.getElementById('select-vault').addEventListener('click', onSelectVault);
init();
