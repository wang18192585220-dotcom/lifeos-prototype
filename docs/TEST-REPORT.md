# LifeOS 测试报告（TEST-REPORT）

> 记录实际环境、运行命令、结果、失败与未验证项。

## S0 能力检查（runtime-check）

环境：
- 开发机 Node v24.19.0，SQLite 3.53.3
- Electron 44.4.3，内置 Node v24.21.0，SQLite 3.53.4
- 平台 win32 x64

命令与结果：

| 运行方式 | 命令 | 结果 |
| --- | --- | --- |
| node | `node tools/runtime-check.cjs` | 7/7 PASS |
| electron | `npx electron tools/runtime-check.cjs` | 7/7 PASS |

能力项：open(file)、exec/prepare/run/get、transaction commit、transaction rollback、FTS5 create/insert/match、backup、close。

失败与修复：
- 初版用 `db.backup()` → `TypeError: db.backup is not a function`（backup 是模块级 API），改为 `backup(db, path)` 后通过。见 DECISIONS D-002。

未验证项：
- 打包后的安装版（`dist:win`）S0 未构建，S5 再验证。
- 真实模型提供商联调：未进行（无 API Key），不阻塞，最终交付单独列明。
- npm audit 报 4 个 moderate 漏洞（来自旧原型依赖树），S1 重构依赖时处理。

## S1 存储 / 服务 / 桌面测试

`npm test`（35 项全绿，win32 x64，Node 24.19 + Electron 44.4.3）：

| 套件 | 命令 | 结果 | 覆盖 |
| --- | --- | --- | --- |
| test:storage | `npm run test:storage` | 6/6 | 初始化/迁移、重启不丢、事务回滚、迁移幂等、进程锁、备份 |
| test:security | `npm run test:security` | 6/6 | 无令牌 401、JSON 404、只服务构建目录、不暴露仓库根/点文件 |
| test:content | `npm run test:content` | 4/4 | 内容不可变写入、outbox 发布失败可重试、单项失败不阻塞 |
| test:vault | `npm run test:vault` | 3/3 | 短期令牌打开+重启持久化、令牌一次性、占用 409 |
| test:contracts | `npm run test:contracts` | 4/4 | openapi↔路由一致、成功/错误信封契约 |
| test:core | `npm run test:core` | 8/8 | Zod schema、任务/里程碑一致性、完成/重开、完成率 |
| test:desktop | `npm run test:desktop` | 4/4 | Electron --smoke 冒烟（SMOKE_OK）、bridge 白名单、无令牌落 renderer |

失败与修复：
- Electron 冒烟超时：`renderer/api/client.js` 映射到 `/api/client.js` 被令牌门禁拦下 → 401 → 模块加载失败。令牌门禁与 JSON 404 收窄到 `/api/v1`（DECISIONS D-006）后通过。
- Windows `fsync` 只读句柄 EPERM → 改可写句柄（content.js）。
- desktop 静态检查误匹配注释中的 `XMLHttpRequest`/`localStorage` → 正则改为检测实际调用。

未验证项：
- 打包后的安装版（`dist:win`）S5 再验证。
- 真实模型提供商联调：未进行（无 API Key），不阻塞。
- npm audit 报 moderate 漏洞（旧原型依赖树），S2 起替换旧依赖时处理。

## S2 通用业务闭环测试

`npm test`（50 项全绿）：

| 套件 | 结果 | 覆盖 |
| --- | --- | --- |
| test:core | 22/22 | 仓储 CRUD、revision 乐观锁、任务-里程碑一致性、完成/重开、今日/日历统一投影、计划版本、HTTP 集成（冲突 409/非法 422/软删除 404/未开库 503） |
| test:contracts | 5/5 | 新增 S2 核心路由「openapi 已声明」检查 |
| test:desktop | 4/4 | Electron 冒烟（前端页面加载后 SMOKE_OK） |

失败与修复：
- 前端 `main.js` 按 `renderToday/renderCalendar/...` 具名导入，但页面统一导出 `render` → 模块加载失败、冒烟超时。改为别名导入 `import { render as renderToday }` 后通过。

S2 验收核对：
- 同一任务在各页面一致：各页共用 `state/store.js` + 同一后端 tasks 数据源。
- 版本冲突可见：PATCH 409 → 前端保留输入并提示「内容已被其他操作修改」。
- 无演示数据混入真库：页面只调用真实 API，无内置假数据。

## S4 与 S5 测试

`npm test`（104 项全绿）：

| 套件 | 结果 | 覆盖 |
| --- | --- | --- |
| test:learning | 5/5 | 档案/记录计时/能力评估 pending→确认、拒绝后不再提出 |
| test:memory | 4/4 | 摘要去重(dedupKey)、来源依赖、撤权/删除失效 |
| test:skills | 6/6 | 生命周期/绑定/宿主可用性/内置 Skills 种子 |
| test:workflows | 4/4 | 幂等调度/错过检测/状态流转 |
| test:backup | 2/2 | 快照/校验/恢复、篡改检测 |
| test:migration | 3/3 | 中文状态映射/未知状态报告/幂等去重 |
| test:scenario | 1/1 | 完整西语场景端到端 |

打包验证：
- `npm run pack` → `dist/win-unpacked/LifeOS.exe`（打包版 `--smoke` 输出 SMOKE_OK，exit 0）。
- `npm run dist:win` → `dist/LifeOS Setup 0.1.0.exe`（NSIS 安装包，exit 0）。

未验证项：
- 安装包在全新 Windows 环境的安装启动（本机只验证了 `--dir` 解包版启动）。
- 真实模型提供商人工烟雾验证：未进行（无有效凭据），不阻塞，已列为交付限制。
- 代码签名：无证书，使用默认 Electron 图标与无签名（个人测试版）。
- safeStorage 凭据持久化：未接入（见 DECISIONS D-008）。
