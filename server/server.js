'use strict';

/**
 * 独立开发启动入口（npm start / npm run dev）。
 *
 * 现在同时承担「前端 demo + 后端」：
 * - 服务根目录 index.html（用户手写的前端 demo）。
 * - /api/* 为 demo 兼容层（旧 AI 接口 + 新生活域接口 + 整块状态同步），仅本地回环、无需令牌。
 * - /api/v1/* 为正式后端接口（Bearer 令牌门禁），供程序化访问。
 *
 * 数据默认落在 ./demo-vault（可用 LIFEOS_VAULT 覆盖），结构化数据存 SQLite。
 */
const fs = require('node:fs');
const path = require('node:path');
const { createApp, generateToken } = require('./app.cjs');
const { VaultService } = require('./storage/vault-service');
const { CredentialService } = require('./platform/credentials');
const { demoCompatRoutes } = require('./routes/demo-compat');
const { startWorkflowEngine } = require('./services/workflow');

const PORT = Number(process.env.LIFEOS_PORT || 4174);
const HOST = '127.0.0.1';
const token = process.env.LIFEOS_TOKEN || generateToken();

const demoFile = path.join(__dirname, '..', 'index.html');
const vaultDir = process.env.LIFEOS_VAULT
  ? path.resolve(process.env.LIFEOS_VAULT)
  : path.join(__dirname, '..', 'demo-vault');

// 打开默认 Vault：财富/人脉/健康等结构化数据需要它。
const vault = new VaultService();
vault.open(vaultDir);

const credentials = new CredentialService();
const app = createApp({ token, staticDir: null, services: { vault, credentials } });

// demo 兼容层（/api/*，无令牌，仅本地回环）
app.use('/api', demoCompatRoutes());

// 根路径服务前端 demo（每次读盘，刷新即生效）
app.get('/', (req, res) => {
  res.type('html').send(fs.readFileSync(demoFile, 'utf8'));
});

// 启动工作流引擎：恢复上次已启用的定时工作流
startWorkflowEngine();

app.listen(PORT, HOST, () => {
  console.log(`LifeOS 运行于 http://${HOST}:${PORT}（前端 demo + 后端）`);
  console.log(`Vault：${vaultDir}`);
  console.log(`本地令牌：${token}`);
});
