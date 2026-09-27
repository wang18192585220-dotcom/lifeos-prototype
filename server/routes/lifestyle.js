'use strict';

/**
 * 生活域路由（财富/人脉/健康）：/finance /network /health。
 * 对应前端 demo「财富中心 / 人脉关系图谱 / 健康管理」的交互数据。
 * 业务经 req.lifeos.services.vault.services 访问。
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
    case 'NOT_FOUND':
      return fail(res, 404, 'not_found', e.message);
    case 'REVISION_CONFLICT':
      return fail(res, 409, 'revision_conflict', e.message);
    case 'CONFLICT':
      return fail(res, 409, 'conflict', e.message);
    case 'VALIDATION':
      return fail(res, 422, 'validation', e.message);
    default:
      return fail(res, 500, 'internal_error', 'Internal Error');
  }
}

function services(req) {
  const vault = req.lifeos && req.lifeos.services && req.lifeos.services.vault;
  return vault ? vault.services : null;
}

function requireServices(req, res, next) {
  if (!services(req)) return fail(res, 503, 'vault_not_open', 'Vault 未打开');
  next();
}

/**
 * 通用 CRUD 生成器（无 zod 强校验，字段由服务层按需处理）。
 * @param {Function} getSvc 从 req 取业务服务（返回含对应仓储/方法的对象）
 * @param {object} opts { repo, list?, create?, get?, update?, archive? }
 */
function crud(getSvc, opts) {
  const router = express.Router();
  router.use(requireServices);

  const list = opts.list || ((svc) => svc[opts.repo].list());
  const get = opts.get || ((svc, id) => svc[opts.repo].get(id));
  const create = opts.create || ((svc, fields) => svc[opts.repo].create(fields));
  const update = opts.update || ((svc, id, rev, changes) => svc[opts.repo].update(id, rev, changes));
  const archive = opts.archive || ((svc, id) => svc[opts.repo].archive(id));

  router.get('/', (req, res) => {
    res.json({ data: list(getSvc(req), req) });
  });

  router.post('/', (req, res) => {
    try {
      res.status(201).json({ data: create(getSvc(req), req.body || {}) });
    } catch (e) {
      handleError(res, e);
    }
  });

  router.get('/:id', (req, res) => {
    const item = get(getSvc(req), req.params.id);
    if (!item) return fail(res, 404, 'not_found', '实体不存在');
    res.json({ data: item });
  });

  router.patch('/:id', (req, res) => {
    const { expectedRevision, changes } = req.body || {};
    if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision)) {
      return fail(res, 400, 'bad_request', '缺少有效的 expectedRevision');
    }
    try {
      res.json({ data: update(getSvc(req), req.params.id, expectedRevision, changes || {}) });
    } catch (e) {
      handleError(res, e);
    }
  });

  router.delete('/:id', (req, res) => {
    archive(getSvc(req), req.params.id);
    res.json({ data: { id: req.params.id, archived: true } });
  });

  return router;
}

function lifestyleRoutes() {
  const router = express.Router();
  const finance = (req) => services(req).finance;
  const network = (req) => services(req).network;
  const health = (req) => services(req).health;

  // ---- 财富 ----
  router.use('/finance/accounts', crud(finance, { repo: 'accounts' }));
  router.use(
    '/finance/transactions',
    crud(finance, {
      repo: 'transactions',
      create: (svc, f) => svc.createTransaction(f),
    })
  );
  router.use('/finance/goals', crud(finance, { repo: 'goals' }));
  router.get('/finance/totals', requireServices, (req, res) => {
    res.json({ data: finance(req).totals() });
  });

  // ---- 人脉 ----
  router.use(
    '/network/contacts',
    crud(network, {
      repo: 'contacts',
      list: (svc) => svc.listContacts(),
      get: (svc, id) => svc.getContact(id),
      create: (svc, f) => svc.createContact(f),
      update: (svc, id, rev, changes) => svc.updateContact(id, rev, changes),
    })
  );
  router.use('/network/relationships', crud(network, { repo: 'relationships' }));
  router.get('/network/state', requireServices, (req, res) => {
    res.json({ data: network(req).getState() });
  });
  router.put('/network/state', requireServices, (req, res) => {
    res.json({ data: network(req).setState(req.body || {}) });
  });

  // ---- 健康 ----
  router.use(
    '/health/records',
    crud(health, {
      repo: 'records',
      list: (svc, req) => svc.list(req.query.section),
      create: (svc, f) => svc.create(f),
      update: (svc, id, rev, changes) => svc.update(id, rev, changes),
    })
  );

  return router;
}

module.exports = { lifestyleRoutes };
