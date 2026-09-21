# LifeOS 使用说明（首版）

版本：0.1.0。个人桌面学习助手，数据全部保存在你选定的本地 Obsidian Vault。

## 1. 启动与首次配置

1. 启动 `LifeOS.exe`（或开发态 `npm run pack` 后运行 `dist/win-unpacked/LifeOS.exe`）。
2. 点击左侧「选择 Vault」选择（或新建）一个 Obsidian 仓库目录。LifeOS 会在其中创建 `LifeOS/` 子目录存放数据。
3. 「设置 → 模型配置」新增模型：填 `baseUrl`（OpenAI 兼容）、`model`、`credentialRef`；随后「设置 API Key」填入 Key。
4. 「设置 → 角色」新增角色（如「西班牙语老师」），选择模型、填写提示词、勾选资料库授权。
5. 首次打开会自动种入 4 个内置教学 Skill（规划访谈 / 小步学习 / 学习复盘 / 记忆摘要）。

## 2. 开始学习（西班牙语备考）

1. 「学习」页创建学习档案（语言 es、目的 exam_preparation、期望 B1–B2）。
2. 「聊天」页选择「西班牙语老师」，开始对话；老师会做规划访谈。
3. AI 拟定的目标/计划/任务会以「提案」形式出现，点「确认」才生效。
4. 「今日/日历/目标/项目」页管理任务与进度；完成任务、记录学习结果。
5. AI 推断的「已掌握某能力」进入「学习 → 待确认能力评估」，由你确认或拒绝。

## 3. 数据与备份

- 数据目录：`<你的Vault>/LifeOS/`，其中 `_system/lifeos.sqlite` 为权威数据，`content/` 为不可变正文，`Knowledge/Memory/Learning` 为可在 Obsidian 阅读的笔记。
- 备份：`POST /api/v1/backups`（当前经接口；UI 入口后续补）。快照存于 `LifeOS/Backups/<snapshotId>/`，含 SQLite + 内容 + 附件 + Skills，并有校验清单。
- 恢复：`POST /api/v1/backups/:id/restore`（目标目录经主进程选择令牌），恢复到新目录后重新打开即可。

## 4. 旧数据迁移

旧原型数据（浏览器 localStorage / server/data JSON）经 `POST /api/v1/imports/preview` 预览、`POST /api/v1/imports/commit` 幂等导入；旧中文状态（待办/进行中/已完成/已取消）自动映射，不认识的状态进入导入报告并回退为「待办」。

## 5. 退出与错过的工作

- 关闭窗口默认退出应用；最小化仍运行。
- 错过的定时工作流在下次启动时标记为「missed」，不自动补跑，由你手动触发。

## 6. 已知限制（首版）

- 模型 Key 当前保存在内存（`CredentialService`），重启后需重新设置；safeStorage 持久化（`secrets.enc`）后续接入。
- 打包版使用默认 Electron 图标、无代码签名证书（个人测试版）。
- 实时语音、自动口语评分、OCR、手机端同步均后置。
- 未连接真实模型提供商做过人工烟雾验证（需用户提供有效凭据）。

## 7. 开发与测试

```bash
npm ci                 # 安装依赖
npm test               # 运行全部测试（104 项）
npm run runtime-check  # 验证 node:sqlite/FTS5/backup
npm run pack           # 生成本地可启动目录 dist/win-unpacked
npm run dist:win       # 生成 Windows 安装包 dist/LifeOS Setup 0.1.0.exe
```
