# LifeOS 决策记录（DECISIONS）

> 记录依赖版本、兼容性验证、必要实现调整及理由。纯工程细节调整在此记录；产品范围或确认边界变更需用户明确要求。

## D-001 Electron 版本锁定（2026-09-21）

- 决策：锁定 **Electron 44.4.3**（devDependencies）。
- 验证：`npx electron tools/runtime-check.cjs` 通过 7 项；内置 Node v24.21.0、SQLite 3.53.4，FTS5 与 backup 均可用。
- 理由：满足 README 4.1 的 node:sqlite / FTS5 / backup 能力门槛；与开发机 Node（v24.19.0）分别独立验证通过。

## D-002 node:sqlite 的 backup 是模块级 API（2026-09-21）

- 事实：Node 24.19 与 Electron 内置 Node 24.21 中，backup **不是** `db.backup()`，而是模块级 `backup(sourceDb, destination[, options])`，返回 Promise。
- 证据：`tools/runtime-check.cjs` 首次运行报 `TypeError: db.backup is not a function`；探测 `DatabaseSync.prototype` 无 backup，模块导出含 `backup`。
- 影响：StorageAdapter 与备份模块统一 `const { backup } = require('node:sqlite')`。

## D-003 node:sqlite 可用性与 FTS5（2026-09-21）

- 事实：node:sqlite 在 Node 24.19 与 Electron 44.4.3 中均无需 flag 即可 `require`，含 FTS5（SQLite 3.53.x）。开发机 SQLite 3.53.3，Electron 3.53.4。
- 附带能力：模块还导出 `Session`、`createSession`、`applyChangeset`、`serialize`/`deserialize`（会话扩展与序列化），供后续备份/一致性参考。
- 影响：首版直接采用 node:sqlite，经自有 StorageAdapter 隔离驱动；不引入 better-sqlite3。

## D-004 目录结构与模块规范（2026-09-21）

- 按 README 第 14 节：`desktop/`、`renderer/`、`server/`（domain/storage/modules/platform）、`skills/builtin/`、`contracts/`、`tools/`、`tests/`、`docs/`。
- 保留 CommonJS；业务模块配 JSDoc，不强制全量 TypeScript 转换。
- 只有主 Agent 修改 package.json / lockfile / 全局路由装配 / renderer/main.js / 契约 / 迁移编号注册表。
