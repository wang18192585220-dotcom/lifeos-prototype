'use strict';

/**
 * CredentialService —— 模型凭据解析（README 4.3）。
 *
 * - 只按引用（credentialRef）读写 Key；明文不落日志、渲染层或导出。
 * - 本实现为内存存储；桌面端后续用 safeStorage 持久化到 secrets.enc 再替换。
 */
class CredentialService {
  constructor() {
    this._store = new Map();
  }

  set(ref, key) {
    this._store.set(ref, key);
  }

  get(ref) {
    return this._store.has(ref) ? this._store.get(ref) : null;
  }

  delete(ref) {
    this._store.delete(ref);
  }
}

module.exports = { CredentialService };
