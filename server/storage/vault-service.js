'use strict';

/**
 * VaultService —— 管理当前打开的 Vault，并提供文件选择的短期令牌（README 12.1）。
 *
 * - registerPathToken 仅由主进程（桌面）在用户选择目录后调用，绝不做成 HTTP 路由，
 *   以免 renderer/模型注入任意路径。
 * - /vault/open 只消费一次性、短时有效的令牌，不接收原始路径。
 */
const crypto = require('node:crypto');
const { openVault } = require('./vault');

const TOKEN_TTL_MS = 5 * 60 * 1000;

class VaultService {
  constructor() {
    this._handle = null;
    this._core = null;
    this._pathTokens = new Map();
  }

  /** @param {string} root 已由主进程确认的 Vault 目录 */
  registerPathToken(root) {
    this._prune();
    const token = crypto.randomBytes(32).toString('hex');
    this._pathTokens.set(token, { path: root, expiresAt: Date.now() + TOKEN_TTL_MS });
    return token;
  }

  /** 一次性消费令牌，返回目录或 null。 */
  consumePathToken(token) {
    this._prune();
    const entry = this._pathTokens.get(token);
    if (!entry) return null;
    this._pathTokens.delete(token);
    return entry.path;
  }

  _prune() {
    const now = Date.now();
    for (const [k, v] of this._pathTokens) {
      if (v.expiresAt <= now) this._pathTokens.delete(k);
    }
  }

  /** 打开（或切换）Vault；同目录重复打开幂等。 */
  open(root) {
    if (this._handle) {
      if (this._handle.root === root) return this._handle;
      this.close();
    }
    const handle = openVault(root);
    handle.root = root;
    this._handle = handle;
    this._core = null; // 切换 Vault 后重建业务服务
    return handle;
  }

  status() {
    return {
      opened: !!this._handle,
      root: this._handle ? this._handle.root : null,
    };
  }

  get adapter() {
    return this._handle ? this._handle.adapter : null;
  }

  /** 当前 Vault 的核心业务服务（惰性创建）；未打开时返回 null。 */
  get core() {
    if (!this._handle) return null;
    if (!this._core) {
      const { CoreService } = require('../modules/core');
      this._core = new CoreService(this._handle.adapter);
    }
    return this._core;
  }

  close() {
    if (this._handle) {
      this._handle.close();
      this._handle = null;
    }
    this._core = null;
  }
}

module.exports = { VaultService };
