import { get } from './api/client.js';
import { render as renderToday } from './pages/today.js';
import { render as renderCalendar } from './pages/calendar.js';
import { render as renderGoals } from './pages/goals.js';
import { render as renderProjects } from './pages/projects.js';

// baseUrl 只保存在内存变量；令牌由 preload 持有，不进入 renderer（README 4.2）。
const session = { baseUrl: null };

const ROUTES = {
  today: { title: '今日', render: renderToday },
  calendar: { title: '日历', render: renderCalendar },
  goals: { title: '目标', render: renderGoals },
  projects: { title: '项目', render: renderProjects },
};

const statusEl = document.getElementById('status');
const vaultEl = document.getElementById('vault-path');
const viewEl = document.getElementById('view');
const titleEl = document.getElementById('page-title');
const navLinks = Array.from(document.querySelectorAll('.nav a'));

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

function currentRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return ROUTES[hash] ? hash : 'today';
}

function renderErrorView(err) {
  viewEl.textContent = '';
  const box = document.createElement('div');
  box.className = 'page-error';
  box.textContent = err && err.message ? err.message : '页面渲染失败';
  viewEl.append(box);
}

async function renderRoute() {
  const name = currentRoute();
  for (const a of navLinks) {
    a.classList.toggle('active', a.getAttribute('data-route') === name);
  }
  titleEl.textContent = ROUTES[name].title;
  try {
    await ROUTES[name].render(viewEl);
  } catch (err) {
    renderErrorView(err);
  }
}

function onHashChange() {
  void renderRoute();
}

async function init() {
  const ok = await bootstrap();
  if (ok) {
    await checkHealth();
  }
  await renderRoute();
}

document.getElementById('select-vault').addEventListener('click', onSelectVault);
window.addEventListener('hashchange', onHashChange);
init();
