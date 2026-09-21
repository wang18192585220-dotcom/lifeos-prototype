'use strict';

/**
 * test:turn —— 会话 turn 路由端到端（S3 T30）。
 * mock 模型 + mock 凭据：配置模型→建角色→开会话→发消息→编排器返回答复。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { createApp } = require('../server/app.cjs');
const { VaultService } = require('../server/storage/vault-service');
const { CredentialService } = require('../server/platform/credentials');

const TOKEN = 't';
const AUTH = { authorization: `Bearer ${TOKEN}` };

function startMockModel() {
  const app = express();
  app.use(express.json());
  app.post('/chat/completions', (req, res) => {
    return res.json({ choices: [{ message: { role: 'assistant', content: '¡Hola! 我是西语老师。' }, finish_reason: 'stop' }] });
  });
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }));
  });
}

test('turn：配置模型→角色→会话→发消息→返回答复并持久化', async () => {
  const { server: mock, baseUrl } = await startMockModel();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const svc = new VaultService();
  const credentials = new CredentialService();
  const app = createApp({ token: TOKEN, services: { vault: svc, credentials } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const api = async (method, p, body) => {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: { 'content-type': 'application/json', ...AUTH },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  try {
    const t = svc.registerPathToken(dir);
    await api('POST', '/api/v1/vault/open', { token: t });

    // 配置模型（凭据引用）
    credentials.set('ref-1', 'secret-key');
    const profile = await api('POST', '/api/v1/model-profiles', {
      baseUrl,
      model: 'mock-model',
      credentialRef: 'ref-1',
    });
    const agent = await api('POST', '/api/v1/agents', {
      name: '西语老师',
      rolePrompt: '你是西班牙语备考老师',
      modelProfileId: profile.body.data.id,
    });
    const session = await api('POST', '/api/v1/sessions', { agentId: agent.body.data.id });

    const turn = await api('POST', `/api/v1/sessions/${session.body.data.id}/turns`, { message: '你好' });
    assert.strictEqual(turn.status, 200);
    assert.match(turn.body.data.content, /Hola/);

    // 消息持久化
    const msgs = await api('GET', `/api/v1/sessions/${session.body.data.id}/messages`);
    assert.strictEqual(msgs.body.data.length, 2);
    assert.strictEqual(msgs.body.data[0].role, 'user');
    assert.strictEqual(msgs.body.data[1].role, 'assistant');
  } finally {
    await new Promise((r) => server.close(r));
    svc.close();
    mock.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('turn：未配置凭据返回 422', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const svc = new VaultService();
  const credentials = new CredentialService();
  const app = createApp({ token: TOKEN, services: { vault: svc, credentials } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = async (method, p, body) => {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: { 'content-type': 'application/json', ...AUTH },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  try {
    const t = svc.registerPathToken(dir);
    await api('POST', '/api/v1/vault/open', { token: t });
    const profile = await api('POST', '/api/v1/model-profiles', { baseUrl: 'http://x', model: 'm', credentialRef: 'unset-ref' });
    const agent = await api('POST', '/api/v1/agents', { name: 'a', modelProfileId: profile.body.data.id });
    const session = await api('POST', '/api/v1/sessions', { agentId: agent.body.data.id });
    const turn = await api('POST', `/api/v1/sessions/${session.body.data.id}/turns`, { message: 'hi' });
    assert.strictEqual(turn.status, 422);
  } finally {
    await new Promise((r) => server.close(r));
    svc.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
