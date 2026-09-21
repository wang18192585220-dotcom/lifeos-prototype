'use strict';

/**
 * S5 路由：备份 / 迁移（README 12.1）。
 */
const express = require('express');
const crypto = require('node:crypto');

function rid() {
  return crypto.randomUUID();
}
function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message, requestId: rid() } });
}
function handleError(res, e) {
  switch (e && e.code) {
    case 'BACKUP_INVALID':
      return fail(res, 422, 'backup_invalid', e.message);
    case 'NOT_FOUND':
      return fail(res, 404, 'not_found', e.message);
    default:
      return fail(res, 500, 'internal_error', 'Internal Error');
  }
}
function vault(req) {
  return req.lifeos && req.lifeos.services && req.lifeos.services.vault;
}
function services(req) {
  return vault(req) ? vault(req).services : null;
}

function s5Routes() {
  const router = express.Router();
  for (const p of ['/backups', '/imports']) {
    router.use(p, (req, res, next) => {
      if (!services(req)) return fail(res, 503, 'vault_not_open', 'Vault 未打开');
      next();
    });
  }

  // ---- 备份 ----
  router.get('/backups', (req, res) => res.json({ data: services(req).backup.list() }));
  router.post('/backups', async (req, res) => {
    try {
      const id = await services(req).backup.create();
      res.status(201).json({ data: { snapshotId: id } });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.post('/backups/:id/verify', (req, res) => {
    res.json({ data: services(req).backup.verify(req.params.id) });
  });
  router.post('/backups/:id/restore', (req, res) => {
    const v = vault(req);
    const token = req.body && req.body.token;
    const target = token ? v.consumePathToken(token) : null;
    if (!target) return fail(res, 422, 'invalid_token', '无效或过期的目标目录令牌');
    try {
      services(req).backup.restore(req.params.id, target);
      res.json({ data: { restoredTo: target } });
    } catch (e) {
      handleError(res, e);
    }
  });

  // ---- 迁移 ----
  router.post('/imports/preview', (req, res) => {
    res.json({ data: services(req).migration.preview(req.body || { entities: {} }) });
  });
  router.post('/imports/commit', (req, res) => {
    try {
      res.json({ data: services(req).migration.commit(req.body || { sourceSystem: 'unknown', entities: {} }) });
    } catch (e) {
      handleError(res, e);
    }
  });

  return router;
}

module.exports = { s5Routes };
