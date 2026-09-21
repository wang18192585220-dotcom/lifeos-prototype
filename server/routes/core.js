'use strict';

/**
 * 核心业务路由（S2 T22）：goals/projects/tasks 的 CRUD + today/calendar 投影。
 * 所有业务读写经 req.lifeos.services.vault.core（当前打开的 Vault 的 CoreService）。
 */
const express = require('express');
const crypto = require('node:crypto');
const { GoalInput, ProjectInput, TaskInput } = require('../domain/schemas');

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
    case 'VALIDATION':
      return fail(res, 422, 'validation', e.message);
    default:
      return fail(res, 500, 'internal_error', 'Internal Error');
  }
}

function getCore(req) {
  const vault = req.lifeos && req.lifeos.services && req.lifeos.services.vault;
  return vault ? vault.core : null;
}

/** 需要 Vault 已打开的中件。 */
function requireCore(req, res, next) {
  if (!getCore(req)) return fail(res, 503, 'vault_not_open', 'Vault 未打开');
  next();
}

/**
 * 生成某实体的 CRUD 路由。
 * @param {string} repoName core 上的仓储名（goals/projects/tasks）
 * @param {import('zod').ZodType} schema 入参校验
 * @param {{create?:Function}} [opts] 自定义创建（如 task 需校验里程碑一致性）
 */
function makeCrud(repoName, schema, opts = {}) {
  const createFn = opts.create || ((core, fields) => core[repoName].create(fields));
  const router = express.Router();
  router.use(requireCore);

  router.get('/', (req, res) => {
    res.json({ data: getCore(req)[repoName].list() });
  });

  router.post('/', (req, res) => {
    let parsed;
    try {
      parsed = schema.parse(req.body || {});
    } catch (e) {
      return fail(res, 422, 'validation', e.issues ? e.issues.map((i) => i.message).join('; ') : String(e));
    }
    try {
      res.status(201).json({ data: createFn(getCore(req), parsed) });
    } catch (e) {
      handleError(res, e);
    }
  });

  router.get('/:id', (req, res) => {
    const item = getCore(req)[repoName].get(req.params.id);
    if (!item) return fail(res, 404, 'not_found', '实体不存在');
    res.json({ data: item });
  });

  router.patch('/:id', (req, res) => {
    const { expectedRevision, changes } = req.body || {};
    if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision)) {
      return fail(res, 400, 'bad_request', '缺少有效的 expectedRevision');
    }
    try {
      res.json({ data: getCore(req)[repoName].update(req.params.id, expectedRevision, changes || {}) });
    } catch (e) {
      handleError(res, e);
    }
  });

  router.delete('/:id', (req, res) => {
    getCore(req)[repoName].archive(req.params.id);
    res.json({ data: { id: req.params.id, archived: true } });
  });

  return router;
}

function coreRoutes() {
  const router = express.Router();

  router.use('/goals', makeCrud('goals', GoalInput));
  router.use('/projects', makeCrud('projects', ProjectInput));
  router.use('/tasks', makeCrud('tasks', TaskInput, { create: (core, f) => core.createTask(f) }));

  router.get('/today', requireCore, (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    res.json({ data: getCore(req).today(date) });
  });

  router.get('/calendar', requireCore, (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return fail(res, 400, 'bad_request', '缺少 from/to 日期区间');
    res.json({ data: getCore(req).calendarRange(String(from), String(to)) });
  });

  return router;
}

module.exports = { coreRoutes };
