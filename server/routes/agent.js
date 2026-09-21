'use strict';

/**
 * S3 路由：模型配置 / 角色 / 资料库与文档 / 授权 / 检索 / 会话 / 提案（README 12.1）。
 * 业务经 req.lifeos.services.vault.services 访问。
 */
const express = require('express');
const crypto = require('node:crypto');
const { ChatClient, buildTools, Orchestrator } = require('../modules/agent');

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

/** 序列化模型配置：不返回凭据引用，只返回是否已设置。 */
function serializeProfile(p) {
  if (!p) return p;
  let capabilities = {};
  try {
    capabilities = p.capabilities ? JSON.parse(p.capabilities) : {};
  } catch (_) {}
  const { credentialRef, ...rest } = p;
  return { ...rest, capabilities, credentialSet: !!credentialRef };
}

function serializeAgent(a) {
  if (!a) return a;
  return { ...a, enabled: !!a.enabled };
}

function agentRoutes() {
  const router = express.Router();
  // 仅对 AI/资料资源路径要求 Vault 已打开，不拦截其它 /api/v1 路径
  for (const p of ['/model-profiles', '/agents', '/libraries', '/documents', '/search', '/sessions', '/proposals']) {
    router.use(p, requireServices);
  }

  // ---- model-profiles ----
  router.get('/model-profiles', (req, res) => {
    res.json({ data: services(req).modelProfiles.list().map(serializeProfile) });
  });
  router.post('/model-profiles', (req, res) => {
    const b = req.body || {};
    if (!b.baseUrl || !b.model) return fail(res, 422, 'validation', 'baseUrl 与 model 必填');
    try {
      const p = services(req).modelProfiles.create({
        providerType: b.providerType || 'openai_compatible',
        baseUrl: b.baseUrl,
        model: b.model,
        capabilities: JSON.stringify(b.capabilities || {}),
        temperature: typeof b.temperature === 'number' ? b.temperature : 0,
        credentialRef: b.credentialRef || null,
      });
      res.status(201).json({ data: serializeProfile(p) });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.patch('/model-profiles/:id', (req, res) => {
    const { expectedRevision, changes } = req.body || {};
    if (typeof expectedRevision !== 'number') return fail(res, 400, 'bad_request', '缺少 expectedRevision');
    const c = { ...changes };
    if (c.capabilities !== undefined) c.capabilities = JSON.stringify(c.capabilities);
    try {
      res.json({ data: serializeProfile(services(req).modelProfiles.update(req.params.id, expectedRevision, c)) });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.delete('/model-profiles/:id', (req, res) => {
    services(req).modelProfiles.archive(req.params.id);
    res.json({ data: { id: req.params.id, archived: true } });
  });
  router.post('/model-profiles/:id/credential', (req, res) => {
    const s = services(req);
    const profile = s.modelProfiles.get(req.params.id);
    if (!profile) return fail(res, 404, 'not_found', '模型配置不存在');
    const key = req.body && req.body.key;
    if (typeof key !== 'string' || !key.trim()) return fail(res, 422, 'validation', 'key 必填');
    const credentials = req.lifeos.services.credentials;
    if (!credentials) return fail(res, 503, 'not_available', '凭据服务不可用');
    const ref = profile.credentialRef || `ref-${req.params.id}`;
    credentials.set(ref, key.trim());
    res.json({ data: { id: req.params.id, credentialSet: true } });
  });

  // ---- agents ----
  router.get('/agents', (req, res) => {
    res.json({ data: services(req).agents.list().map(serializeAgent) });
  });
  router.post('/agents', (req, res) => {
    const b = req.body || {};
    if (!b.name) return fail(res, 422, 'validation', 'name 必填');
    try {
      const a = services(req).agents.create({
        name: b.name,
        rolePrompt: b.rolePrompt || '',
        modelProfileId: b.modelProfileId || null,
        enabled: b.enabled ? 1 : 0,
      });
      res.status(201).json({ data: serializeAgent(a) });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.patch('/agents/:id', (req, res) => {
    const { expectedRevision, changes } = req.body || {};
    if (typeof expectedRevision !== 'number') return fail(res, 400, 'bad_request', '缺少 expectedRevision');
    const c = { ...changes };
    if (c.enabled !== undefined) c.enabled = c.enabled ? 1 : 0;
    try {
      res.json({ data: serializeAgent(services(req).agents.update(req.params.id, expectedRevision, c)) });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.delete('/agents/:id', (req, res) => {
    services(req).agents.archive(req.params.id);
    res.json({ data: { id: req.params.id, archived: true } });
  });
  router.put('/agents/:id/grants', (req, res) => {
    const { libraryIds } = req.body || {};
    services(req).knowledge.setLibraryGrants(req.params.id, Array.isArray(libraryIds) ? libraryIds : []);
    res.json({ data: { id: req.params.id, libraryIds: Array.isArray(libraryIds) ? libraryIds : [] } });
  });

  // ---- libraries / documents ----
  router.get('/libraries', (req, res) => {
    res.json({ data: services(req).knowledge.libraries.list() });
  });
  router.post('/libraries', (req, res) => {
    const b = req.body || {};
    if (!b.title) return fail(res, 422, 'validation', 'title 必填');
    res.status(201).json({ data: services(req).knowledge.createLibrary(b.title) });
  });
  router.post('/libraries/:id/documents', (req, res) => {
    const b = req.body || {};
    if (typeof b.text !== 'string' || !b.text.trim()) return fail(res, 422, 'validation', 'text 必填');
    try {
      const doc = services(req).knowledge.importDocument(req.params.id, { title: b.title, text: b.text, source: b.source });
      res.status(201).json({ data: doc });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.get('/documents/:id', (req, res) => {
    const doc = services(req).knowledge.documents.get(req.params.id);
    if (!doc) return fail(res, 404, 'not_found', '文档不存在');
    res.json({ data: doc });
  });
  router.delete('/documents/:id', (req, res) => {
    services(req).knowledge.documents.archive(req.params.id);
    res.json({ data: { id: req.params.id, archived: true } });
  });

  // ---- search ----
  router.post('/search', (req, res) => {
    const { agentId, query } = req.body || {};
    if (!agentId || !query) return fail(res, 422, 'validation', 'agentId 与 query 必填');
    res.json({ data: services(req).knowledge.search(agentId, query) });
  });

  // ---- sessions ----
  router.get('/sessions', (req, res) => {
    res.json({ data: services(req).sessions.sessions.list() });
  });
  router.post('/sessions', (req, res) => {
    const { agentId } = req.body || {};
    if (!agentId) return fail(res, 422, 'validation', 'agentId 必填');
    res.status(201).json({ data: services(req).sessions.createSession(agentId) });
  });
  router.get('/sessions/:id/messages', (req, res) => {
    res.json({ data: services(req).sessions.listMessages(req.params.id) });
  });
  router.post('/sessions/:id/turns', async (req, res) => {
    const s = services(req);
    const session = s.sessions.getSession(req.params.id);
    if (!session) return fail(res, 404, 'not_found', '会话不存在');
    const agent = s.agents.get(session.agentId);
    if (!agent) return fail(res, 404, 'not_found', '角色不存在');
    const profile = agent.modelProfileId ? s.modelProfiles.get(agent.modelProfileId) : null;
    if (!profile) return fail(res, 422, 'validation', '角色未配置模型');
    const credentials = req.lifeos.services.credentials;
    const apiKey = profile.credentialRef && credentials ? credentials.get(profile.credentialRef) : null;
    if (!apiKey) return fail(res, 422, 'validation', '模型凭据未设置');

    const message = req.body && req.body.message;
    if (typeof message !== 'string' || !message.trim()) return fail(res, 422, 'validation', 'message 必填');

    const client = new ChatClient({
      baseUrl: profile.baseUrl,
      apiKey,
      model: profile.model,
      temperature: typeof profile.temperature === 'number' ? profile.temperature : 0,
    });
    const tools = buildTools({
      core: s.core,
      proposals: s.proposals,
      getContext: () => ({ sessionId: session.id, agentId: agent.id }),
    });
    const orchestrator = new Orchestrator({ core: s.core, proposals: s.proposals, sessions: s.sessions, tools });
    const events = [];
    try {
      const result = await orchestrator.runTurn({
        sessionId: session.id,
        userMessage: message,
        agent: { rolePrompt: agent.rolePrompt },
        modelClient: client,
        onEvent: (e) => events.push(e),
      });
      const pendingProposals = s.proposals.list({ sessionId: session.id }).filter((p) => p.status === 'pending');
      res.json({ data: { content: result.content, proposals: pendingProposals, events } });
    } catch (e) {
      handleError(res, e);
    }
  });

  // ---- proposals ----
  router.get('/proposals', (req, res) => {
    res.json({ data: services(req).proposals.list() });
  });
  router.get('/proposals/:id', (req, res) => {
    const p = services(req).proposals.get(req.params.id);
    if (!p) return fail(res, 404, 'not_found', '提案不存在');
    res.json({ data: p });
  });
  router.post('/proposals/:id/confirm', (req, res) => {
    try {
      res.json({ data: services(req).proposals.confirm(req.params.id, req.body && req.body.payloadHash) });
    } catch (e) {
      handleError(res, e);
    }
  });
  router.post('/proposals/:id/reject', (req, res) => {
    try {
      res.json({ data: services(req).proposals.reject(req.params.id) });
    } catch (e) {
      handleError(res, e);
    }
  });

  return router;
}

module.exports = { agentRoutes };
