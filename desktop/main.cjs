'use strict';

/**
 * LifeOS 桌面主进程（S1 T11）。
 *
 * 职责：单实例锁、窗口生命周期、受限本地服务（随机会话令牌 + 临时端口）、
 *       一次性注入 bridge、退出清理、--smoke 冒烟验证。
 *
 * 安全：renderer 通过 sandbox:true + contextIsolation:true + nodeIntegration:false
 *       隔离，仅经 preload 暴露的受限 bridge 与本地服务通信。
 */

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { createApp, generateToken } = require('../server/app.cjs');
const { CredentialService } = require('../server/platform/credentials');
const { VaultService } = require('../server/storage/vault-service');

const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
const SMOKE_TIMEOUT_MS = 30_000;
const QUIT_GRACE_MS = 1_500;

const isSmoke = process.argv.includes('--smoke');

function smokeLog(msg) {
  if (isSmoke) fs.writeSync(2, `[smoke] ${msg}\n`);
}

let mainWindow = null;
let expressServer = null;
let bootstrap = null; // { baseUrl, token }
const vault = new VaultService(); // 打开/切换 Vault 与一次性路径令牌
let smokeTimer = null;
let quitting = false;
const smoke = { bridgeReady: false, bootstrapServed: false, finished: false };

// ---- 单实例锁 ----
if (!app.requestSingleInstanceLock()) {
  // 第二实例：直接退出，不创建窗口/服务
  app.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(startup).catch(onStartupError);
}

function onStartupError(err) {
  if (isSmoke) {
    smokeFail(`启动失败: ${err && err.message ? err.message : err}`);
  } else {
    console.error('LifeOS 启动失败:', err);
    app.exit(1);
  }
}

function smokeOk() {
  if (smoke.finished) return;
  smoke.finished = true;
  if (smokeTimer) {
    clearTimeout(smokeTimer);
    smokeTimer = null;
  }
  // 同步写 stdout，避免 app.exit 前输出被缓冲丢弃
  fs.writeSync(1, 'SMOKE_OK\n');
  app.exit(0);
}

function smokeFail(reason) {
  if (smoke.finished) return;
  smoke.finished = true;
  if (smokeTimer) {
    clearTimeout(smokeTimer);
    smokeTimer = null;
  }
  fs.writeSync(1, `SMOKE_FAIL: ${reason}\n`);
  app.exit(1);
}

async function runSmokeHealthCheck() {
  if (!isSmoke || smoke.finished) return;
  if (!smoke.bridgeReady || !smoke.bootstrapServed) return;
  try {
    const res = await fetch(`${bootstrap.baseUrl}/api/v1/health`, {
      headers: { authorization: `Bearer ${bootstrap.token}` },
    });
    if (!res.ok) {
      smokeFail(`health 返回 HTTP ${res.status}`);
      return;
    }
    const body = await res.json();
    if (!body || !body.data || body.data.status !== 'ok') {
      smokeFail('health 响应格式不符');
      return;
    }
    smokeOk();
  } catch (err) {
    smokeFail(`health 调用失败: ${err && err.message ? err.message : err}`);
  }
}

function registerIpc() {
  // 一次性注入：renderer 请求时才返回 { baseUrl, token }，不写入源码或 global
  ipcMain.handle('lifeos:bootstrap', () => {
    if (!bootstrap) {
      throw new Error('本地服务尚未就绪');
    }
    smoke.bootstrapServed = true;
    smokeLog('bootstrap served');
    void runSmokeHealthCheck();
    return { baseUrl: bootstrap.baseUrl, token: bootstrap.token };
  });

  // preload 暴露完成后的就绪信号（供 --smoke 校验 bridge 已就绪）
  ipcMain.on('lifeos:bridge-ready', () => {
    smoke.bridgeReady = true;
    smokeLog('bridge-ready received');
    void runSmokeHealthCheck();
  });

  // 文件选择白名单：仅允许选择目录（Vault）
  ipcMain.handle('lifeos:select-vault', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 Vault 目录',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
      return null;
    }
    // 仅由主进程在用户确认目录后签发一次性路径令牌；renderer 经 /vault/open 消费。
    const dir = result.filePaths[0];
    return { path: dir, token: vault.registerPathToken(dir) };
  });
}

async function startServer() {
  const token = generateToken();
  const credentials = new CredentialService();
  const expressApp = createApp({ token, staticDir: RENDERER_DIR, services: { credentials, vault } });
  expressServer = expressApp.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    expressServer.once('listening', resolve);
    expressServer.once('error', reject);
  });
  const address = expressServer.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  bootstrap = { baseUrl: `http://127.0.0.1:${port}`, token };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    title: 'LifeOS',
    show: !isSmoke,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.webContents.on('did-finish-load', () => smokeLog('did-finish-load'));
  mainWindow.webContents.on('did-fail-load', (e, code, desc) =>
    smokeLog(`did-fail-load ${code} ${desc}`)
  );
  mainWindow.webContents.on('preload-error', (e, p, err) =>
    smokeLog(`preload-error ${p}: ${err && err.message ? err.message : err}`)
  );
  mainWindow.webContents.on('render-process-gone', (e, details) =>
    smokeLog(`render-process-gone ${details && details.reason}`)
  );
  mainWindow.webContents.on('console-message', (...args) => {
    const detail = args[1];
    const msg = detail && typeof detail === 'object' ? detail.message : args.slice(1).join(' ');
    smokeLog(`console: ${msg}`);
  });
  await mainWindow.loadURL(`${bootstrap.baseUrl}/`);
}

async function startup() {
  registerIpc();
  await startServer();
  await createWindow();

  if (isSmoke) {
    smokeTimer = setTimeout(() => smokeFail('30 秒超时未完成冒烟验证'), SMOKE_TIMEOUT_MS);
  }
}

function shutdown() {
  if (smokeTimer) {
    clearTimeout(smokeTimer);
    smokeTimer = null;
  }
  const server = expressServer;
  expressServer = null;
  if (server) {
    // 关闭监听并给在途请求短暂窗口；随后强制退出，避免 keep-alive 连接导致无限挂起
    const force = setTimeout(() => app.exit(0), QUIT_GRACE_MS);
    if (typeof force.unref === 'function') force.unref();
    server.close(() => clearTimeout(force));
  }
}

// 关闭窗口默认退出（Windows 桌面客户端）；最小化仍运行（默认行为，不处理即保持）
app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (quitting) return;
  quitting = true;
  shutdown();
});
