'use strict';

/**
 * Vault 打开 / 初始化 / 进程锁（README 4.2 / 5.1 / 6.1）。
 *
 * - 打开时确保目录存在，并在 _system 下建立进程锁。
 * - 锁恢复必须确认原进程已退出，不能仅按超时强行抢占。
 * - 迁移失败时关闭连接并释放锁，不留下半开状态。
 */
const fs = require('node:fs');
const { StorageAdapter } = require('./adapter');
const { runMigrations } = require('./migrate');
const paths = require('../platform/paths');

function ensureDirs(vaultRoot) {
  for (const d of paths.requiredDirs(vaultRoot)) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function isProcessAlive(pid) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM 表示进程存在但无权发信号；其他（如 ESRCH）表示不存在
    return e && e.code === 'EPERM';
  }
}

function acquireLock(vaultRoot, pid = process.pid) {
  const lp = paths.lockPath(vaultRoot);
  if (fs.existsSync(lp)) {
    let existing = 0;
    try {
      existing = Number(fs.readFileSync(lp, 'utf8').trim());
    } catch (_) {
      existing = 0;
    }
    if (isProcessAlive(existing)) {
      const err = new Error(`Vault 已被进程 ${existing} 占用`);
      err.code = 'VAULT_LOCKED';
      throw err;
    }
    // 原进程已退出，允许接管
  }
  fs.writeFileSync(lp, String(pid), 'utf8');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      fs.rmSync(lp, { force: true });
    } catch (_) {
      /* 清理失败不影响关闭 */
    }
  };
}

/**
 * 打开 Vault：建目录、加锁、开库、跑迁移。
 * @param {string} vaultRoot Vault 根目录
 * @returns {{adapter: import('./adapter.js').StorageAdapter, release: Function, close: Function}}
 */
function openVault(vaultRoot) {
  ensureDirs(vaultRoot);
  const release = acquireLock(vaultRoot);
  const adapter = new StorageAdapter(paths.dbPath(vaultRoot));
  adapter.open();
  try {
    runMigrations(adapter);
  } catch (e) {
    adapter.close();
    release();
    throw e;
  }
  return {
    adapter,
    release,
    close() {
      adapter.close();
      release();
    },
  };
}

module.exports = { openVault, acquireLock, isProcessAlive, ensureDirs };
