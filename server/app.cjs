'use strict';

/**
 * createApp(dependencies) —— 应用工厂（README 4.2 / 4.3 / 12）。
 *
 * - 导入本模块不启动服务、不打开用户库、不运行定时器。
 * - 仅服务前端构建目录；不暴露仓库根目录、Vault、server/data 或配置。
 * - 所有 /api 请求校验会话令牌；未知 API 返回 JSON 404。
 */
const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function requestId() {
  return crypto.randomUUID();
}

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function tokenAuth(expectedToken) {
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    const provided = match ? match[1] : '';
    if (!expectedToken || !timingSafeEqualStr(provided, expectedToken)) {
      return res.status(401).json({
        error: { code: 'unauthorized', message: '缺少或无效的本地访问凭据', requestId: requestId() },
      });
    }
    next();
  };
}

/**
 * @param {object} [deps]
 * @param {string|null} [deps.token] 本地会话令牌；为空则拒绝所有 /api 请求
 * @param {string|null} [deps.staticDir] 前端构建目录（仅此目录可被静态服务）；null 关闭静态服务
 * @param {object} [deps.services] 业务服务注入（S2 起接入）
 * @returns {import('express').Express}
 */
function createApp(deps = {}) {
  const { token = null, staticDir = null, services = {} } = deps;
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json({ limit: '10mb' }));

  // 依赖注入，供后续路由读取业务服务
  app.use((req, res, next) => {
    req.lifeos = { services };
    next();
  });

  // API：令牌门禁
  app.use('/api', tokenAuth(token));

  // API 路由（S1 最小集，随阶段扩展）
  app.get('/api/v1/health', (req, res) => {
    res.json({ data: { status: 'ok', time: new Date().toISOString() } });
  });

  app.get('/api/v1/bootstrap', (req, res) => {
    res.json({
      data: {
        initialized: false,
        vaultStatus: 'none',
        capabilities: { sqlite: true, fts5: true },
      },
    });
  });

  // 未知 API → JSON 404（不暴露 HTML 或内部路径）
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: { code: 'not_found', message: 'Not Found', requestId: requestId() },
    });
  });

  // 静态服务：仅前端构建目录；禁止点文件
  if (staticDir) {
    app.use(express.static(staticDir, { dotfiles: 'deny', index: 'index.html' }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  // 统一错误处理：不泄露内部路径、Key 或堆栈
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      error: { code: 'internal_error', message: 'Internal Error', requestId: requestId() },
    });
  });

  return app;
}

module.exports = { createApp, generateToken };
