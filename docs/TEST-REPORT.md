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

## 后续测试脚本

各模块测试脚本（`test:storage` / `test:core` / `test:agent` / `test:knowledge` / `test:memory` / `test:skills` / `test:learning` / `test:workflows` / `test:migration` / `test:backup` / `test:e2e`）随对应阶段实现落地，当前均未实现，不使用空测试或强制 exit 0 充数。
