'use strict';

/**
 * 独立调试启动入口（仅开发用，README 17.1 dev:server）。
 * - 不连接默认真实 Vault，不运行定时器。
 * - 会话令牌随进程生成并打印到控制台。
 * - 不暴露仓库根目录或 server/data。
 */
const { createApp, generateToken } = require('./app.cjs');

const PORT = Number(process.env.LIFEOS_PORT || 4174);
const HOST = '127.0.0.1';
const token = process.env.LIFEOS_TOKEN || generateToken();

const app = createApp({ token, staticDir: null });

app.listen(PORT, HOST, () => {
  console.log(`LifeOS 调试后端运行于 http://${HOST}:${PORT}`);
  console.log(`本地令牌: ${token}`);
});
