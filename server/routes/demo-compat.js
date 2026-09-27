'use strict';

/**
 * demo 兼容路由（挂载于 /api，仅供本地 Web 预览）：
 * 把前端 demo（根目录 index.html）依赖的旧版 AI 接口与新生活域接口统一暴露。
 *
 * - 旧 AI 接口（agent-config / chat / knowledge / skills / workflows）直接复用原型路由，
 *   其协议与 demo 的 fetch 调用完全一致（README 原型）。
 * - 生活域（finance / network / health）复用 lifestyleRoutes，落到 SQLite 权威库。
 * - /state/:key 提供整块 JSON 状态持久化，供 demo 的整体数据模型同步。
 */
const express = require('express');
const crypto = require('node:crypto');
const { lifestyleRoutes } = require('./lifestyle');

function rid() {
  return crypto.randomUUID();
}

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message, requestId: rid() } });
}

function adapter(req) {
  const vault = req.lifeos && req.lifeos.services && req.lifeos.services.vault;
  return vault ? vault.adapter : null;
}

function demoCompatRoutes() {
  const router = express.Router();

  // ---- 旧 AI 接口（协议与 demo 完全一致）----
  router.use('/agent-config', require('./agent-config'));
  router.use('/chat', require('./chat'));
  router.use('/knowledge', require('./knowledge'));
  router.use('/skills', require('./skills'));
  router.use('/workflows', require('./workflows'));

  // ---- 新生活域接口（结构化，落到 SQLite）----
  router.use(lifestyleRoutes());

  // ---- 整块状态同步（demo 整体数据模型持久化）----
  router.get('/state/:key', (req, res) => {
    const db = adapter(req);
    if (!db) return fail(res, 503, 'vault_not_open', 'Vault 未打开');
    const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get(req.params.key);
    let value = null;
    if (row) {
      try {
        value = JSON.parse(row.value);
      } catch (_) {
        value = null;
      }
    }
    res.json({ data: value });
  });

  router.put('/state/:key', (req, res) => {
    const db = adapter(req);
    if (!db) return fail(res, 503, 'vault_not_open', 'Vault 未打开');
    const value = JSON.stringify(req.body || {});
    db.prepare(
      `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(req.params.key, value, new Date().toISOString());
    res.json({ data: { key: req.params.key, saved: true } });
  });

  // 删除整块状态（版本升级时清除旧演示数据用）
  router.delete('/state/:key', (req, res) => {
    const db = adapter(req);
    if (!db) return fail(res, 503, 'vault_not_open', 'Vault 未打开');
    db.prepare('DELETE FROM app_state WHERE key = ?').run(req.params.key);
    res.json({ data: { key: req.params.key, deleted: true } });
  });

  return router;
}

module.exports = { demoCompatRoutes };
