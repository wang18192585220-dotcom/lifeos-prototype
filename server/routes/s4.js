'use strict';

/**
 * S4 路由：学习档案/记录、能力评估、记忆、Skills、工作流（README 12.1）。
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

function s4Routes() {
  const router = express.Router();
  for (const p of [
    '/learning-profiles',
    '/learning-records',
    '/assessments',
    '/memories',
    '/skills',
    '/workflows',
    '/workflow-runs',
  ]) {
    router.use(p, requireServices);
  }

  // ---- 学习档案 ----
  router.get('/learning-profiles', (req, res) => res.json({ data: services(req).learning.profiles.list() }));
  router.post('/learning-profiles', (req, res) => {
    try {
      res.status(201).json({ data: services(req).learning.createProfile(req.body || {}) });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.patch('/learning-profiles/:id', (req, res) => {
    const { expectedRevision, changes } = req.body || {};
    if (typeof expectedRevision !== 'number') return fail(res, 400, 'bad_request', '缺少 expectedRevision');
    try {
      res.json({ data: services(req).learning.profiles.update(req.params.id, expectedRevision, changes || {}) });
    } catch (e) {
      handleError(res, e);
    }
  });

  // ---- 学习记录 ----
  router.get('/learning-records', (req, res) => {
    const profileId = req.query.profileId;
    res.json({ data: services(req).learning.listRecords(profileId) });
  });
  router.post('/learning-records', (req, res) => {
    const b = req.body || {};
    if (!b.profileId) return fail(res, 422, 'validation', 'profileId 必填');
    try {
      res.status(201).json({ data: services(req).learning.addRecord(b.profileId, b) });
    } catch (e) {
      handleError(res, e);
    }
  });

  // ---- 能力评估 ----
  router.get('/assessments', (req, res) => res.json({ data: services(req).learning.listAssessments() }));
  router.post('/assessments/:id/confirm', (req, res) => {
    try {
      res.json({ data: services(req).learning.confirmAssessment(req.params.id, req.body && req.body.by) });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.post('/assessments/:id/reject', (req, res) => {
    try {
      res.json({ data: services(req).learning.rejectAssessment(req.params.id, req.body && req.body.by) });
    } catch (e) {
      handleError(res, e);
    }
  });

  // ---- 记忆 ----
  router.get('/memories', (req, res) => res.json({ data: services(req).memory.listValid(req.query.agentId) }));
  router.delete('/memories/:id', (req, res) => {
    try {
      services(req).memory.deleteMemory(req.params.id);
      res.json({ data: { id: req.params.id, deleted: true } });
    } catch (e) {
      handleError(res, e);
    }
  });

  // ---- Skills ----
  router.get('/skills', (req, res) => res.json({ data: services(req).skills.list() }));
  router.post('/skills/drafts', (req, res) => {
    const b = req.body || {};
    try {
      res.status(201).json({ data: services(req).skills.createDraft({ name: b.name, description: b.description, manifest: b.manifest, source: b.source }) });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.post('/skills/:id/install', (req, res) => {
    try {
      res.json({ data: services(req).skills.install(req.params.id) });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.post('/skills/:id/enable', (req, res) => {
    try {
      res.json({ data: services(req).skills.enable(req.params.id) });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.post('/skills/:id/disable', (req, res) => {
    try {
      res.json({ data: services(req).skills.disable(req.params.id) });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.put('/skills/:id/bind', (req, res) => {
    const { agentId, version } = req.body || {};
    if (!agentId) return fail(res, 422, 'validation', 'agentId 必填');
    services(req).skills.bind(agentId, req.params.id, version);
    res.json({ data: { skillId: req.params.id, agentId } });
  });
  router.delete('/skills/:id/bind', (req, res) => {
    const { agentId } = req.query;
    if (!agentId) return fail(res, 422, 'validation', 'agentId 必填');
    services(req).skills.unbind(agentId, req.params.id);
    res.json({ data: { skillId: req.params.id, agentId } });
  });

  // ---- 工作流 ----
  router.get('/workflows', (req, res) => res.json({ data: services(req).workflows.listWorkflows() }));
  router.post('/workflows', (req, res) => {
    const b = req.body || {};
    res.status(201).json({ data: services(req).workflows.createWorkflow({ trigger: b.trigger, action: b.action, timezone: b.timezone }) });
  });
  router.post('/workflows/:id/run', (req, res) => {
    res.json({ data: services(req).workflows.runNow(req.params.id) });
  });
  router.get('/workflow-runs', (req, res) => {
    res.json({ data: services(req).workflows.listRuns(req.query.workflowId) });
  });

  return router;
}

module.exports = { s4Routes };
