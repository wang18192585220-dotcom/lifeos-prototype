# LifeOS：个人桌面学习助手 · 开发交接文档

版本：2026-09-21。交付对象：DeepSeek Harness 主开发 Agent 及其子 Agent。

**本文件是首版开发依据。需求和架构方案已整理完成，应用开发尚未按本方案实施。** 先建立通用基础，再完整跑通“西班牙语备考”场景，之后扩展其他人生领域。不要重新启动需求访谈，也不要把全部页面同时重写。

本文中的“必须”是验收条件；“默认”是开发可直接采用的工程决策；“后续”不属于首版。学习基础、学习时间、考试类型等个人信息，由应用运行时的老师 Agent 询问，不是开发开始的前置条件。

## 1. 给主开发 Agent 的启动指令

将下面内容直接作为 DeepSeek Harness 的任务：

> 阅读本 README 全文，检查仓库现状和已有未提交修改，从 S0 开始按阶段实施。保留现有页面风格与交互，完成 Windows 个人桌面客户端、本地 Obsidian Vault 存储、目标项目任务与日历、用户自配模型 API、按角色分配的资料与 Skills、AI 修改提案确认、长期记忆，以及西班牙语学习完整流程。
>
> 使用本文的任务编号和子 Agent 协作规则。先冻结接口与数据约定，再分派独立文件范围；主 Agent 负责集成和阶段验收。每阶段必须有可运行结果和实际测试证据，不以生成代码或子 Agent 自述作为完成依据。继续已有任务时，读取执行状态并检查真实代码，不重复已完成阶段。
>
> 不向用户追问西班牙语基础、考试类型、学习时间或 Vault 路径来阻塞开发；这些是首次使用时的配置和规划访谈。没有真实 API Key 时使用可重复的测试服务完成工程验证，并清楚记录真实提供商联调尚未验证。不要伪造模型调用、工具执行、记忆检索或测试成功。

主 Agent 在 S0 创建并持续维护以下文件；它们是执行产物，当前不代表已经存在：

- docs/EXECUTION-STATUS.md：任务状态、依赖、负责人、验证结果、下一步。
- docs/DECISIONS.md：依赖版本、兼容性验证、必要的实现调整及理由。
- docs/TEST-REPORT.md：实际环境、运行命令、结果、失败和未验证项。
- docs/openapi.yaml：可验证的接口契约。

## 2. 已确认的产品约束

| 事项 | 首版决定 |
| --- | --- |
| 使用者 | 仅用户本人，不做注册、多租户、多人协作 |
| 客户端 | Windows 桌面优先；手机后续共用数据，首版不开发手机端 |
| 运行条件 | 电脑开机且 LifeOS 正在运行才执行自动化；关闭窗口默认退出应用与后台服务 |
| 错过的工作 | 重启后展示，由用户点击继续或跳过，不自动补跑 |
| 模型 | 用户自行配置 API 地址、Key 和模型；先支持 OpenAI 兼容协议适配器 |
| 数据 | 所有业务数据、资料、会话、记忆均保存在用户选定的本地 Obsidian Vault 内 |
| 操作入口 | 在 LifeOS 页面和聊天里操作；无需用户直接编辑 Obsidian 文件 |
| 手动修改 | 用户在页面直接编辑并保存，正常生效 |
| AI 修改 | 目标、计划、项目、任务、排期及完成状态的变更先形成提案，用户确认后生效 |
| 自动积累 | 学习记录、对话摘要、资料摘要可以自动保存 |
| 能力判断 | “已掌握某能力”“达到某等级”先保存为待确认结论，不自动当作事实 |
| 资料与 Skills | 用户按 Agent 分配，默认不向所有 Agent 共享 |
| 开发工具 | DeepSeek Harness 是本项目的开发执行工具，不是产品必须使用的模型提供商或运行时 |

### 2.1 首版必须贯通的使用过程

1. 启动客户端，选择或创建 Vault，配置自己的模型 API。
2. 在“设置 → Agent 团队”启用西班牙语备考老师，分配资料库与 Skills。
3. 上传教材、笔记或考试资料；处理完成后可预览、检索并引用来源。
4. 与老师聊天。老师通过规划访谈了解基础和时间，提出目标、阶段和近期小任务。
5. 用户查看变化、修改提案并确认；任务进入项目、今日和日历。
6. 用户完成学习、练习和记录。AI 自动保存有来源的记录和摘要；修改后续计划仍需确认。
7. 关闭后重新启动，继续过去的会话，检索以前的学习情况，不丢失进度。
8. 在 LifeOS 中查看、纠正或删除记忆；看到待确认能力结论、待确认计划和错过的工作。
9. 导出备份并恢复到新目录后，仍能继续以上流程。

### 2.2 西班牙语样板的准确边界

用户期望：以考试为导向，在约一年内达到 B1—B2 水平，倾向 B2，B1 也可接受；对话中的“明年”指 2027 年。**这是一项学习愿望，不是已证明可达的承诺，也不是已确认的具体考试日期。**

初始配置保存语言 es、方向 exam-preparation、期望区间 B1/B2、期望周期约 12 个月。当前水平、每周投入、考试类型、教材、报名日期均可为空。首次启用时呈现“建立我的学习计划”，不静默创建一年任务。

具体询问方式、合理拆分、复盘调整由老师 Agent 和规划 Skill 负责。通用任务服务不能写死西班牙语、DELE 或某个等级；初期以 B1 为检查点、B2 为进阶目标也只能是待确认的建议。

### 2.3 后续版本

手机端与安全远程接入、跨设备同步、离线多端合并、云端持续执行、多用户、完整健康/财务/人脉业务、完整 Obsidian 双向业务编辑、OCR、实时双向语音、任意第三方脚本执行均后置。首版保留相关既有页面，未接入区域明确显示原型状态，不展示假成功。

## 3. 仓库现状与改造边界

以下是静态代码检查结论，不代表已经验证运行通过：

| 位置 | 当前状态 | 实施要求 |
| --- | --- | --- |
| index.html | 单文件交互原型，含样式、页面、数据和浏览器端 Agent 循环 | 逐步拆为模块，保留布局与现有交互，不做无关视觉重设计 |
| preview.cjs | 旧单文件页面的预览入口 | 保留为旧原型预览，不能冒充新客户端启动入口 |
| server/server.js | Express、定时器、初始化与启动耦合；静态服务暴露仓库根目录 | 拆应用工厂与生命周期，只服务前端构建目录；未知 API 返回 JSON 404 |
| server/services/db.js | 实际为 JSON 文件，不是 SQLite | 增量迁移，不能因读取失败而当作空库覆盖 |
| server/services/llm.js | 有模型调用和流式处理，但不能视为完整多提供商兼容 | 建立适配器、能力探测、结构校验和可测试的流式协议 |
| server/routes/chat.js | 接受前端业务快照、工具和提示；工具调用边界薄弱 | 后端加载真实数据、权限和工具，承担完整 Agent 循环 |
| server/services/skills.js | 多个演示技能返回占位或假成功 | 替换为真实工具注册表，未实现能力显式不可用 |
| knowledge 相关文件 | 已有上传、解析、检索雏形 | 保留可复用解析器，重建来源、状态、授权及检索索引 |
| workflow 相关文件 | 定时执行与 JSON 日志雏形 | 补持久化运行记录、错过检测、幂等和恢复策略 |
| 设置页 | 已有 Agent、知识库、Skills、工作流入口 | 在既有入口完成真实配置、安装、分配和状态反馈 |

当前 package.json 使用 CommonJS，start/dev 都启动旧后端。本文后述脚本是待开发的交付约定，**现在不能把它们当作已经存在的命令**。

浏览器已有数据分散在 lifeos_full_data、lifeosHealthRecords、lifeosNetwork、lifeosKnowledgeLibraries、lifeos_custom_agents、lifeos_career_override、lifeos_career_knowledge_selection、lifeos_active_agent 等键；还需扫描其他 lifeos 前缀及历史 lifeosProjects。日历、财务、部分会话和记忆是内存或示例数组，不保证刷新后可恢复。

实施前记录 Git 状态及未提交文件。尤其不能覆盖现有 index.html 修改。旧页面的侧栏展开、箭头位置、项目单选关联、弹窗关闭和窄窗口行为应进入回归清单。

## 4. 总体架构与技术决策

采用**单机模块化应用**，不引入微服务、消息中间件、独立向量数据库或云端数据库。

~~~text
LifeOS 页面（沿用现有 HTML/CSS，逐步模块化）
    ↓ 受限 preload bridge：请求、事件订阅、文件选择
Electron 主进程：窗口生命周期、凭据加解密、本地 API 网关
    ↓ 仅本机、临时端口、随机会话令牌
Express 应用
    ├─ 业务服务：目标 / 项目 / 任务 / 日历 / 学习
    ├─ Agent 编排：上下文 / 工具 / 提案 / 模型适配
    ├─ 知识与记忆：导入 / 来源 / 授权 / 检索 / 摘要
    ├─ Skills：安装 / 版本 / 绑定 / 受限工具能力
    └─ 工作队列 / 调度 / 迁移 / 备份
    ↓ 唯一业务写入通道
用户 Vault / LifeOS
    ├─ SQLite：结构化权威数据
    ├─ 原始附件与不可变 Markdown 内容
    ├─ 面向 Obsidian 阅读的知识与记忆笔记
    └─ 可重建索引、审计、备份
~~~

### 4.1 技术栈

| 层 | 决策 |
| --- | --- |
| 桌面 | Electron，首个安装产物为 Windows x64 |
| 后端 | Node.js + Express；沿用 CommonJS，业务模块配 JSDoc，不要求全量 TypeScript 转换 |
| 前端 | 保留现有样式与原生 JS；拆为 renderer 下的 ES modules，不强制换 React |
| 数据 | SQLite；优先 node:sqlite，通过自有 StorageAdapter 隔离驱动 |
| 校验 | Zod 统一校验请求、模型输出、工具参数和持久化结构；OpenAPI 3.1 记录接口 |
| 检索 | 首版 SQLite FTS5 + 来源过滤 + 中西文分词预处理；语义检索接口预留，非首版依赖 |
| 测试 | node:test、临时 Vault、模拟模型服务、Playwright Electron 场景测试 |
| 打包 | electron-builder；记录并锁定实际验证通过的精确版本和 lockfile |

开发环境采用 Node 24 LTS。Electron 的内置 Node 与开发机 Node 不是同一个运行时：S0 必须分别验证 node:sqlite 的打开、事务、FTS5、backup 和关闭操作，并在打包程序中再验证。node:sqlite 当前文档仍标为 release candidate，必须经适配层隔离，不使用未验证的新 API；不能因版本不支持而静默退回 JSON。[Node SQLite 文档](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)

若候选 Electron 不满足能力门槛，由主 Agent 选择并锁定兼容版本；只有经过独立冒烟验证，才可在 DECISIONS 中记录切换 SQLite 驱动及其打包影响。属于实现决策，不重新要求用户选择数据库。

### 4.2 进程与生命周期

- 后端导出 createApp(dependencies)，导入模块不启动服务、不打开用户库、不运行定时器。
- Electron 主进程启动服务，监听 127.0.0.1 和系统分配端口；生成不落盘的随机令牌。renderer 不持有 API Key 或本地服务令牌，通过受限 bridge 请求。
- bridge 按操作白名单映射固定 API，验证调用页面、参数及订阅所属窗口；不得提供任意 HTTP、文件读写或 shell 能力。
- Electron 使用单实例锁；同一 Vault 增加进程锁，防止桌面与调试服务并发写入。锁恢复必须确认原进程已退出，不能仅按超时强行抢占。
- SQL 事务短小，只有一个写入队列；文件解析和索引计算放到 worker，计算结果经业务服务提交，worker 不直接写业务库。
- 窗口关闭默认退出；最小化仍运行。退出时停止调度、取消模型请求、标记未完成作业、关闭连接。退出失败不能无限挂起。
- Vault 不可用、只读、损坏或迁移失败时进入恢复界面；不能自动新建空库掩盖数据丢失。

### 4.3 本地服务与凭据

禁止静态暴露项目根目录、Vault、server/data 或配置文件。API 必须检查会话令牌，默认不开放跨来源访问；文件下载经 ID 查找、授权及路径校验。所有路径做规范化，拒绝越界、符号链接/连接点逃逸和压缩包路径穿越。

Electron 使用 contextIsolation、sandbox，关闭 renderer 的 nodeIntegration，配置 CSP，渲染模型 Markdown 时消毒 HTML，校验 IPC 发送来源。模型文本、资料和 Skill 内容均不能改变这些宿主权限。[Electron 安全指南](https://www.electronjs.org/docs/latest/tutorial/security)

模型 Key 用系统支持的 safeStorage 加密后放在 Vault/LifeOS/_system/secrets.enc；明文仅短暂存在主进程及实际请求中，不进日志、渲染层、笔记或导出。Windows 加密依赖操作系统账户，换电脑后允许重新输入 Key。加密能力不可用时仅允许本次会话使用，不退回明文保存。[safeStorage 文档](https://www.electronjs.org/docs/latest/api/safe-storage)

应用目录只保存最后选用 Vault 的路径、窗口状态等启动信息；业务日志及学习内容都留在 Vault。使用外部模型时，需要的提问与已授权上下文会发送到用户配置的服务，首次配置应说明这一点，不能宣称所有推理均离线。

## 5. Vault、权威数据与可靠保存

### 5.1 目录约定

~~~text
用户的 Obsidian Vault/
└─ LifeOS/
   ├─ Home.md
   ├─ Knowledge/<libraryId>/<documentId>.md
   ├─ Memory/<agentId>/<memoryId>.md
   ├─ Learning/<profileId>/<recordId>.md
   ├─ Attachments/<sha256>/<originalName>
   ├─ Skills/<skillId>/<version>/
   ├─ Exports/
   ├─ Backups/<snapshotId>/
   └─ _system/
      ├─ lifeos.sqlite
      ├─ search.sqlite
      ├─ content/<sha256>.md
      ├─ secrets.enc
      ├─ logs/
      ├─ staging/
      └─ imports/
~~~

业务结构、会话原文、关系、版本和授权以 lifeos.sqlite 为准；正文以数据库引用的不可变 content 文件为准；原始资料以 Attachments 中的原件为准。Knowledge、Memory、Learning 是供 Obsidian 阅读的可再生成笔记，不是第二套可独立写入的业务库。search.sqlite 可删除并重建，不承载唯一数据。

这些数据都在 Vault 文件夹中，但并非所有数据都必须转换成 Markdown。用户可以用 Obsidian 阅读长期知识，日常编辑仍在 LifeOS 完成。Obsidian 使用本地文件存储，适合作为这层容器；核心功能直接访问选定目录，不依赖 Obsidian 始终运行。[Obsidian 数据存储说明](https://help.obsidian.md/Files+and+folders/How+Obsidian+stores+data)

“在 Obsidian 中打开”是可选功能。CLI 适配在检测可用后启用，失败不影响保存和学习。[Obsidian CLI 文档](https://help.obsidian.md/cli)

### 5.2 写入协议

1. 校验业务结构、权限、引用对象和 revision。
2. 涉及正文时，先写 staging，刷盘并原子重命名为 content 下的哈希文件；不可变文件不覆盖。
3. 在一个 SQLite 事务中提交结构变化、正文引用、审计与 file_outbox 待发布项。
4. 提交成功后生成面向阅读的 Markdown 文件和索引；成功再标记 outbox 完成。
5. 启动时只修复已提交事务的文件投影与索引，不触发新模型推理，也不补跑学习工作流。

事务失败留下的未引用文件可在备份后清理。数据库提交成功但笔记发布失败时，UI 显示“已保存，笔记同步待修复”，不能重复提交业务操作。磁盘满、文件被占用、应用退出等必须有故障测试。

若用户在 Obsidian 改了生成笔记，通过内容哈希检测差异，保留外部版本并在 LifeOS 提示冲突，提供查看、导入为新资料或重新生成的选择；不静默覆盖，也不自动把 Markdown 变更转成任务变更。Vault 其他目录不扫描、不改写，除非用户在界面选择导入。

### 5.3 删除、更正与备份

- 普通删除先软删除并移出检索。纠正产生新版本，旧版本仅供历史查看，不参与当前回答。
- 删除来源后，将依赖该来源的摘要、记忆和索引标记失效并重算可见性；不能在下一次摘要中复活。
- 提供“彻底删除”操作，列出原件、内容版本、摘要及备份影响，执行后保留不含正文的抑制标识，防止旧作业重新生成。既有备份含历史内容，必须在 UI 明示并提供对应备份清理入口。
- 每日首次满足运行条件时做一次本地快照，默认保留最近 7 份；支持手动导出到用户选定目录。Vault 内快照不等同于异盘备份。
- 暂停写入与后台提交，通过 SQLite backup API 获取一致快照，再复制该快照引用的不可变内容、附件和 Skills，生成校验清单与完成标记；排除 Backups 自身、索引、临时文件和 secrets.enc。
- 不能直接复制运行中的单个 SQLite 文件而遗漏 WAL。恢复先在新目录校验完整性及 schema 版本，再由用户切换，不直接覆盖现用 Vault。[SQLite 在线备份](https://www.sqlite.org/backup.html)
- 首版不支持把正在写入的 SQLite 当作多端同步文件。后续手机通过服务接口或明确的同步协议访问同一数据，而不是同时打开这个文件。

## 6. 数据模型与业务一致性

### 6.1 通用约定

所有可修改实体使用 UUID、revision、createdAt、updatedAt、deletedAt。时间戳用 UTC ISO 8601；计划日期单独保存 YYYY-MM-DD 与 IANA 时区，默认 Asia/Shanghai。目标日期未知为 null，不能填演示日期。外键开启，所有业务关联使用 ID，不使用标题或数组下标。

读取失败必须产生错误，不能返回空数组冒充正常。数据库按顺序执行版本迁移，迁移前备份；不能通过删库解决 schema 冲突。金额等其他领域暂不扩展表，原始迁移数据归档保留。

### 6.2 最小实体集合

| 实体 | 必要字段或关系 |
| --- | --- |
| goals | title、description、area、targetDate、status、progressMode、manualProgress |
| projects | title、area、goalId 可空、status、description |
| stages / milestones | projectId、顺序、说明、目标日期；milestone 的完成由用户操作或确认提案决定 |
| plans / plan_versions | projectId、目标约束、阶段结构、当前生效版本、提案来源 |
| tasks | projectId 可空、milestoneId 可空、title、description、status、priority、estimatedMinutes、scheduledDate、startTime 可空、timezone、dueAt 可空、completedAt |
| agents | name、rolePrompt、modelProfileId、enabled、revision |
| model_profiles | providerType、baseUrl、model、capabilities、temperature、credentialRef；不存明文 Key |
| libraries / documents | 标题、原件引用、正文引用、hash、解析状态、来源、版本 |
| agent_library_grants / agent_document_grants | Agent 与资料授权；资料库授权和单篇授权可选，撤销即时生效 |
| sessions / messages / agent_runs / tool_runs | agentId、原文、事件序号、状态、时间、关联来源、调用幂等键 |
| proposals / proposal_actions | 来源会话、变更列表、预期 revision、状态、确认版本哈希、执行结果 |
| learning_profiles | language、purpose、期望等级区间、期望周期、当前已确认水平可空、examType 可空、weeklyMinutes 可空 |
| learning_records / evidence | 实际练习、开始结束时间、时长来源、用户反馈、原始证据与相关任务 |
| assessments | 能力、判断、证据、pending/confirmed/rejected/superseded、确认人及时间 |
| memories / memory_sources | kind、正文引用、事实状态、来源版本、作者 Agent、派生授权范围、失效原因 |
| skills / skill_versions / agent_skill_bindings | 包来源、内容 hash、manifest、安装/适配状态、版本、启用与 Agent 绑定 |
| workflows / workflow_runs | 触发规则、时区、动作、计划发生时间、运行状态、幂等键 |
| jobs / notifications | 后台作业、进度、失败原因、可重试状态、面向用户的待处理项 |
| audit_events / file_outbox / import_batches | 确认与写入审计、文件发布、迁移映射和去重结果 |

S0 将字段、枚举、唯一约束与 API schema 写入契约。以此表为最低范围，不要求一次性建立所有空表；表随阶段迁移添加。

### 6.3 业务规则

- 目标可以关联多个项目；项目的 goalId 至多一个、可以为空，area 必填。修改项目目标不能改写其他项目。
- 任务可以独立存在；关联 milestone 时，其 projectId 必须与 milestone 所属项目一致。
- 默认任务状态 todo / in_progress / done / cancelled；priority 为 low / normal / high。旧中文状态通过显式迁移映射，不认识的值进入导入报告。
- 日历、今日、项目详情和统计都查询同一 tasks 数据源。今日标记转换为明确日期，不能继续维护独立日历任务数组。
- 完成任务记录 completedAt；重开清空。完成率只统计未删除且未取消的任务，无任务显示“尚无任务”，不是 100%。
- 项目执行进度可按已完成任务数计算；目标默认手动进度，可显式选择按关联项目计算。自动显示执行统计不等于自动完成目标或认定学习能力。
- 删除有子项的目标/项目时列出影响，默认归档而不是级联永久删除。AI 提案中的级联影响必须明示。
- 用户页面保存为直接操作；聊天中即使说“帮我改成周三”，也先呈现准确变更供确认。

## 7. 后端 Agent 与确认机制

### 7.1 单次对话流程

1. 保存用户消息；从服务端会话确定 agentId，加载其模型配置、已绑定 Skills 和当前授权。
2. 读取相关目标、任务和进度的最新结构化数据。检索长期资料和记忆时先限制授权，再检索、再检查结果授权。
3. 组合角色提示、适用 Skill 指令、有效会话上下文与有来源的检索片段。
4. 调用模型；工具请求经 schema、角色权限、资源授权和幂等校验后执行。
5. 涉及业务变更只创建 proposal。流式返回解释、来源、提案及运行状态。
6. 保存助手消息和工具结果；按摘要规则排队自动积累，不能借此修改计划。

默认每轮最多 8 次工具迭代、同时 1 个模型作业，支持取消与超时。消息和工具事件持久化；重新连接仅重放事件，不重新执行工具。模型输出不合法时最多一次格式修复，仍失败则展示可重试错误，不猜测执行。

前端不得上传“全量真实业务状态”、任意工具定义或 systemPrompt 来覆盖服务端规则。Agent 配置通过专门设置接口修改。模型不能调用任意路径、SQL、进程或未注册工具。

### 7.2 工具权限

| 工具类型 | 示例 | 首版处理 |
| --- | --- | --- |
| 只读 | read_goals、read_tasks、search_knowledge、search_memory | 验证角色与来源范围后返回真实数据 |
| 自动记录 | record_learning、save_summary | 只写记录和摘要；必须有来源，不接受任意“事实已确认” |
| 业务提案 | propose_changes | 只创建提案，不能直接修改目标、计划或任务 |
| 能力评估 | propose_assessment | 只写 pending 结论 |
| 学习辅助 | generate_exercise、create_worksheet | 生成练习内容与附件，不自动标记任务完成 |
| 外部能力 | 显式配置的只读 HTTP、转写或朗读 | 按 Skill 绑定与配置使用；首版不开放第三方外部写入操作 |

宿主规则始终高于 Skill 和检索文本。Skill 中要求“跳过确认”“共享所有记忆”等内容不产生权限。

### 7.3 提案契约

提案包含 proposalId、sessionId、agentId、summary、actions、baseRevisions、status、expiresAt、payloadHash。每项 action 包含 operation、entityType、entityId 或临时 ID、before、after、reason、sourceRefs。操作只允许预定义的业务命令，不接收原始 SQL 或任意 JSON Patch 路径。

~~~json
{
  "summary": "把未完成的听力练习移到周三",
  "actions": [{
    "operation": "task.update",
    "entityId": "task-uuid",
    "expectedRevision": 3,
    "changes": { "scheduledDate": "2027-03-10" },
    "reason": "用户要求调整时间"
  }]
}
~~~

以上日期仅为接口示例，不是用户的计划。模型生成 actions 后，由后端读取真实 before 并计算 after，不能信任模型伪造的旧值。

UI 显示新增、修改、取消、影响数量及日期变化；允许编辑和拒绝。编辑产生新版本及新哈希；确认必须针对用户实际看过的版本。用户选择部分接受时生成独立的新提案并重新展示，不部分执行原事务。

确认端点只接受可信 UI 通道，不注册成模型工具。事务内重新校验所有权限、版本和外键，全部通过才一次提交。revision 冲突返回 409，展示差异，重新生成/编辑后再次确认；不能覆盖用户刚改的内容。

提案状态 pending → applied / rejected / expired；检测冲突后转 conflict，不得直接重试旧确认。默认 7 天到期。连续点击、请求重试、进程重启均返回同一已执行结果；审计保存确认时间、操作与结果。一次提交的动作上限默认 100，更多内容分批展示与确认。

### 7.4 模型适配

首版实现 OpenAI 兼容聊天接口，配置 API base URL、model、Key、temperature、超时。连接测试分别展示普通回复、流式、工具调用支持情况；不要将“连接成功”等同于全能力兼容。

不支持原生工具调用时，可使用受同样校验约束的结构化文本提案模式；不支持流式则退为完整回复。模型名字不固定；embedding、语音是独立能力，不默认假设聊天提供商支持。保留 temperature=0，配置布尔值按真实布尔校验。

未配置模型或网络不可用时，手动目标/任务编辑、查看已有资料和记忆、记录学习、备份仍可使用；聊天及需要模型的作业显示明确状态。首次配置允许先跳过模型设置，不以 API Key 阻塞本地功能。

错误区分认证失败、限流、网络、模型不存在、格式错误和用户取消。只有未产生副作用的请求可有限重试；工具执行依赖独立幂等记录。模型用量可记录，不记录 Key 或完整认证头。

## 8. 资料、长期记忆与可控自生长

### 8.1 资料导入

首版接收 Markdown、TXT、含文本的 PDF、DOCX、JSON、CSV。文件默认上限 20 MB，批量最多 20 个，可在设置调整。旧 DOC 格式提示转换，扫描 PDF 提示需要 OCR；不能把空文本当作处理完成。

资料状态 uploaded → extracting → ready / failed。保留原件、哈希、来源时间、解析器版本和错误原因。重试根据源文件 hash 去重。标题、段落、页码等定位信息随切片保存，回答能够打开实际来源。

按标题与段落切片，默认约 1000 字符、重叠 150 字符，避免切断短练习；参数可调。对西班牙语处理重音与大小写，对中文采用字符 bigram 等预处理，避免仅按空格分词。索引查询参数化，不拼接任意 FTS 表达式。

### 8.2 授权与检索

安装资料、创建资料库不等于对所有 Agent 开放。用户在设置中选择共享给哪些 Agent；从某个 Agent 的上传入口上传时，界面明确默认分配对象，用户可以修改。

检索规则：

1. 计算当前 Agent 可访问的来源集合，包括资料、会话和记忆作用域。
2. 在集合内检索；先返回相关任务事实，再合并近期记录与知识片段。
3. 对结果按来源版本、删除状态、结论状态再次过滤；默认最多 8 个片段、合计 12000 字符，按实际上下文预算裁剪。
4. 附带 sourceId、revision、页码/段落、来源类别与 pending 标记。没有证据时说明未找到，不凭摘要猜造记录。

自动派生摘要只能被同时有权访问其全部来源的 Agent 使用，即来源授权的交集。若需要扩大共享，用户必须在界面显式批准来源共享；只共享一个摘要不能悄悄绕过源资料范围。

撤销授权后，相关索引、缓存、会话压缩摘要和旧工具结果都要重新过滤。旧聊天可保留供用户本人查看，但不能未经筛选重新注入无权访问它的 Agent 上下文。无法可靠拆分受污染摘要时整体失效。工具执行前再校验一次，防止检索后、调用前撤权。

### 8.3 记忆类型与可信程度

| 内容 | 保存方式 | 能否作为当前已确认事实 |
| --- | --- | --- |
| 用户原话和实际练习记录 | 自动保存原始证据 | 可陈述“用户说过/记录显示”，不升级为客观能力证明 |
| 对话摘要、资料摘要 | 自动生成，关联源版本 | 必须保留来源、条件与不确定性 |
| 用户偏好 | 用户明确表述可记录；模型推测标为 inferred | 推测不能替代明确设置 |
| 错题和薄弱点 | 保存练习证据及暂时判断 | 不从一次错误推断永久能力 |
| “已掌握”“达到 B1/B2” | assessments.pending | 用户确认前不能当作已掌握 |
| 目标、计划、任务变化 | proposal | 用户确认前不生效 |

确认能力结论不等同于官方证书。用户可确认、修改或拒绝；拒绝原因留存，后续总结不得恢复同一被拒绝结论。证据矛盾时并列展示并请求运行时核实，不自行覆盖。

### 8.4 自动积累与知识演化

默认在资料处理完成、用户结束一次学习、或会话每累计 20 条新消息时排队摘要；30 秒合并重复触发。最多并发 2 个解析作业、1 个模型作业。开启界面可关闭自动摘要或调整频率，关闭后保留原文。

使用 sourceHash + kind + agentId + processorVersion 作去重键，记录已处理的消息区间。先积累原始证据，再整理摘要、关联概念、补充主题页；不把自己生成的摘要循环当新资料无限总结。

知识更新建立新版本，保留 sourceRefs、supersedes、状态和修改理由。生成主题页不能改写原始教材。出现冲突、来源删除或能力推断时进入待检查状态；不会自动修改学习目标和任务。

“自生长知识库”借鉴将资料持续整理为可检索、可关联、可修订知识的思路；这里的权限、版本、确认和恢复机制是本项目的具体设计，不宣称复制了某个完整实现。参考作者公开的 [Karpathy LLM Wiki 资料入口](https://gist.github.com/karpathy?direction=desc&sort=updated)。

重启后未完成的模型摘要/导入作业显示“继续处理”，由用户点击；仅重建索引、发布已提交文件等确定性修复可自动执行。摘要失败不影响原始学习记录保存。

### 8.5 用户可见入口

“个人记忆”显示来源、生成时间、事实状态、相关 Agent，并提供查看原文、编辑、更正、删除、重新生成。“学习记录”与“能力评估”分开；“计划提案”与“待确认能力”分开，不能一个确认按钮同时批准两者。

## 9. Skills 与角色配置

### 9.1 两类能力均纳入首版

一类是教学方法和问答规范，如规划访谈、目标拆解、错题复盘；另一类是真实工具能力，如检索资料、读取进度、生成练习、创建变更提案。Skill 不能只展示卡片，也不能用返回一段“已完成”来冒充工具执行。

包至少包含 SKILL.md，支持 name、description 及 references、assets。按 Agent Skills 格式解析，但平台权限由 LifeOS 决定，不把包声明的 allowed-tools 当成授权。[Agent Skills 规范](https://agentskills.io/specification)

首版兼容范围明确为：

- 指令型 Skill 与引用资料。
- 调用 LifeOS 已注册工具的 Skill。
- 使用 lifeos.skill.json 声明固定 HTTPS 接口的工具 Skill。
- 需要任意 shell、Python、Node 脚本或浏览器控制的第三方包，可以导入并预览，但标为“需要适配”，不执行代码，也不假称兼容。

### 9.2 安装与更新

支持本地 SKILL.md、文件夹、ZIP，以及公开 HTTPS 仓库归档导入；远程导入记录 URL、版本/提交与内容 hash。下载不是执行安装脚本，不运行仓库 hooks 或依赖安装命令。

安装流程：导入 → 校验与预览 → 显示兼容性及请求能力 → 用户安装 → 选择 Agent → 启用。默认不分配给其他 Agent；更新产生新版本，变更权限必须重新确认，旧版本可回退。

包路径必须限制在 Skills 子目录，拒绝路径穿越、连接点和过大解压量；默认压缩包 20 MB、解压后 100 MB、最多 1000 个文件。解析不执行代码。

### 9.3 聊天制作 Skill

用户与 Agent 聊天描述教学方式，Agent 生成 Skill 草稿。UI 显示名称、适用场景、指令、引用和工具需求，允许修改。用户保存后才成为安装版本，再选择分配对象。不能由模型直接修改当前生效 Skill 或自动赋予自己权限。

首版内置示例：

- planning-interview：收集目标约束、形成可确认计划。
- small-step-learning：把近期任务拆成可执行的小步骤。
- study-review：基于记录复盘并提出调整。
- memory-summary：后台摘要模板；仅有记录权限，没有业务变更权限。

首次设置推荐将前三个分配给西班牙语老师，用户点击启用后生效。后台摘要使用专门受限处理器，不能自动继承所有角色的资料。

### 9.4 声明式工具扩展

lifeos.skill.json 记录 schemaVersion、toolBindings、HTTP 操作的固定 host、method、path、输入输出 schema、timeout、credentialRef、sideEffect。不得由模型动态指定目标主机、认证头或原始请求体结构。

声明式 HTTP 工具首版只开放 GET 读取，sideEffect 必须为 read_only；发消息、下单、改远端数据等外部写入操作标为不支持，后续另建明确的副作用确认机制。模型、转写、朗读的 POST 请求由专用适配器处理，不通过任意 HTTP Skill。

HTTP 工具只访问用户配置并批准的 HTTPS 域名，重定向和 DNS 解析后的实际目标地址重新校验，默认拒绝本机及私网地址，响应大小和时间有限制。确需接入用户本地模型的 loopback 地址仅由模型配置路径显式授权，不能顺带开放给导入 Skill。凭据由后端注入。

真实工具被调用时必须依次检查：Skill 已安装且可用、当前版本已启用、绑定当前 Agent、工具在宿主允许集合内、相关数据已授权、必要的副作用已确认。卸载或解绑即时失效。

## 10. 学习规划与教学闭环

### 10.1 规划访谈 Skill

输入包含已知学习意愿、当前档案、历史问答、可用资料和近期任务。先使用已有答案，每次只问 1—2 个关键缺口；用户不确定可跳过并标为未知，不反复要求填完整调查表。

应逐步了解：当前基础、可投入时间、考试或用途、期望时间、教材资源、学习偏好与近期限制。这些信息影响方案粒度和可行性，由运行时 Agent 讨论。

输出结构包含 phase（collecting / ready / proposal）、knownFacts、unknowns、nextQuestions、profileObservations、planOutline、taskDrafts、assumptions、sourceRefs。Zod 校验后分别处理：

- 用户明确提供的资料存为有来源的档案观察记录。
- 推断的能力水平进入 pending assessment。
- 目标、排期、正式计划和任务进入 proposal。
- 未知考试类型保持 null，不自动默认 DELE；未知日期不得自动填报名日期。

### 10.2 合理拆解

默认先给长期阶段概览与近期 7 天草案，不一次填满 365 天。阶段包含目标、可观察证据、练习方向和复盘点；小任务包含具体动作、输入材料、完成标准、预计时长和依赖。

建议以 5—25 分钟可完成单元为起点、每日不超过 3 个主要学习任务，但这只是 Skill 默认策略，需结合用户时间调整。所谓“最小单位”是用户能开始并判断完成的动作，不是把每个单词都拆成数据库任务。

示例：“听指定音频前 2 分钟，记录 3 个听不懂的片段，再核对文本”，比“提高听力”更可执行。预计时长不能超过已知可用时间；依赖不能成环；不能同时安排冲突时段而不提示。

### 10.3 学习与复盘

任务详情提供开始学习、相关资料、老师问答、记录结果、完成/继续。记录实际完成情况、耗时来源、练习结果与用户感受。暂停时间不能自动计为学习时间；没有实际计时则由用户输入或留空。

老师可针对听、说、读、写提供练习与反馈；首版支持音频附件播放、用户录音或上传音频、手动转录与练习记录。若用户另配可用转写/朗读 API，可启用自动转写或 TTS；未配置时明确提示，不返回假识别或假发音评分。实时语音和自动口语考试评分后置。

周复盘按实际记录比较计划与完成情况，提出减少负荷、调整顺序、补练等建议。所有影响正式计划的建议仍需确认。完成率、学习时长、练习正确率与 CEFR 能力分开展示。

考试要求仅在用户选择考试后作为该考试的资料与 Skill 内容。DELE 官方 B1/B2 资料可作为候选来源，不预设用户参加 DELE，也不把完成任务视为达到等级。[DELE B1](https://examenes.cervantes.es/es/dele/examenes/b1)、[DELE B2](https://examenes.cervantes.es/es/dele/examenes/b2)

## 11. 工作流、恢复与通知

首版支持用户设置每日/每周时间与时区、暂停/启用、手动执行。初始动作限定为学习提醒、复盘草稿、摘要整理；改变计划的工作流只能生成提案。复用调度库可以，但持久化状态和幂等规则必须由业务层保证。

每次发生以 workflowId + scheduledFor 唯一标识。状态为 scheduled、running、succeeded、failed、missed、cancelled；摘要等 jobs 另有 interrupted 状态。规则记录 activeSince 与 lastEvaluatedAt，只有启用后到当前时间的有效发生点参与错过检测，不生成规则创建前的历史任务。启动时将过去未发生的计划标为 missed，崩溃中断的执行标为 interrupted/failed，不自动调用模型补做。

大量错过的计划按工作流合并展示，例如“错过 5 次复盘”，用户可选择执行一次最新复盘或全部跳过；若选择逐次执行，必须列出次数。手动执行使用同一幂等体系，连点不重复创建结果。

应用运行期间，调度按规则触发；系统睡眠唤醒也先检查是否错过，不能当作一直在线。切换时区、修改周期、禁用规则不得重放历史事件。过渡到夏令时按明确时区计算，并在测试中覆盖。

通知先做应用内真实待处理列表；系统通知是可选展示，不影响记录。通知点击后定位提案、失败任务或学习计划，不能只显示 toast 却没有持久化结果。

## 12. 接口与前端集成契约

所有新接口使用 /api/v1。通用错误格式为 error.code、error.message、error.details、requestId；成功格式为 data、meta。日期、枚举、分页和关联字段以 schema 为准。

列表默认每页 50、最大 200；详情返回 revision。PATCH 带 expectedRevision，新增及会产生副作用的 POST 带 Idempotency-Key；同一键重复请求返回原结果，同键不同内容返回 409。400 表示结构错误，401 表示本地访问凭据错误，403 表示权限不足，404 表示不存在，409 表示版本或幂等冲突，422 表示业务约束不满足。内部错误不能泄露本地路径、Key 或原始堆栈。

### 12.1 必须落地的路由组

| 路由 | 行为 |
| --- | --- |
| GET /health；GET /bootstrap | 服务状态；初始化状态、功能能力、当前 Vault 状态、设置摘要 |
| POST /vault/open；GET /vault/status | 消费主进程文件选择产生的短期令牌并打开 Vault；查询状态；不接受模型传入任意路径 |
| GET/POST /goals、/projects、/tasks | 查询及创建 |
| GET/PATCH/DELETE /goals/:id、/projects/:id、/tasks/:id | 详情、手动编辑、软删除/归档；删除影响先预览 |
| GET/POST /projects/:id/stages、/projects/:id/milestones | 阶段、里程碑列表与创建 |
| PATCH/DELETE /stages/:id、/milestones/:id | 编辑与归档 |
| GET /projects/:id/plan；GET /plans/:id/versions | 当前计划与历史版本 |
| POST /projects/:id/plan-versions | 用户直接保存计划新版本；AI 只能经提案调用内部同一服务 |
| GET /calendar；GET /today | 由 tasks 按日期、时区和状态投影，不维护独立任务副本 |
| GET/POST /agents；GET/PATCH/DELETE /agents/:id | 角色配置及归档 |
| PUT /agents/:id/grants；PUT /agents/:id/skills | 更新明确的资料授权、Skill 版本绑定 |
| GET/POST /model-profiles；PATCH/DELETE /model-profiles/:id | 配置、修改、删除；响应只返回是否已设置凭据 |
| POST /model-profiles/:id/test | 连接及能力探测，记录结果 |
| GET/POST /libraries；PATCH/DELETE /libraries/:id | 资料库管理 |
| POST /libraries/:id/documents；GET /documents/:id | 导入及处理状态 |
| GET /documents/:id/content；GET /documents/:id/file | 授权后读取正文/原件；正文包含来源定位 |
| PATCH/DELETE /documents/:id；POST /documents/:id/retry | 元数据编辑、删除、失败重试 |
| POST /search | 指定 agentId、query、scope；服务端限制资料和记忆授权 |
| GET/POST /sessions；GET /sessions/:id/messages | 会话及历史；Agent 执行上下文需要额外执行来源过滤 |
| POST /sessions/:id/turns | 保存消息、创建运行，返回 runId；后端执行工具循环 |
| GET /runs/:id/events；POST /runs/:id/cancel | SSE 事件与取消 |
| GET /proposals；GET /proposals/:id | 待处理列表及完整变化 |
| PATCH /proposals/:id；POST /proposals/:id/confirm、/reject | 修改草稿、确认、拒绝；确认包含 payloadHash 和版本 |
| GET/POST /learning-profiles；PATCH /learning-profiles/:id | 学习档案；明确事实与推测来源 |
| GET/POST /learning-records；PATCH/DELETE /learning-records/:id | 学习记录、纠错和删除 |
| GET /assessments；POST /assessments/:id/confirm、/reject | 能力结论及单独确认 |
| GET /memories；GET/PATCH/DELETE /memories/:id | 记忆阅读、更正和删除 |
| POST /memories/:id/regenerate | 显式重新整理，重新检查来源和权限 |
| GET /skills；POST /skills/import、/skills/drafts | 安装列表、第三方导入预览、聊天创建草稿 |
| GET/PATCH /skills/:id；POST /skills/:id/install、/enable、/disable | 详情、草稿修改、安装和启停 |
| POST /skills/:id/versions、/skills/:id/rollback；DELETE /skills/:id | 新版本预览/安装、回退和卸载 |
| GET/POST /workflows；PATCH/DELETE /workflows/:id | 规则列表、创建、修改、停用或归档 |
| POST /workflows/:id/run；GET /workflow-runs | 手动执行与运行历史 |
| POST /workflow-runs/:id/resume、/skip | 用户处理错过或中断的运行 |
| GET /jobs；POST /jobs/:id/resume、/cancel | 导入/摘要进度与显式恢复 |
| GET /notifications；PATCH /notifications/:id | 通知查询与已读 |
| POST /imports/preview、/imports/commit；GET /imports/:id | 旧数据迁移预览、确认提交及报告 |
| POST /backups；GET /backups；POST /backups/:id/verify | 创建、列表及完整性验证 |
| POST /backups/:id/restore | 恢复到新目录，路径来自主进程选择令牌 |

路径采用表内逗号缩写的地方，需要在 OpenAPI 中展开为独立完整路径。所有 UI 必须实际调用对应服务；不能先写一套不匹配的 OpenAPI 再另写路由。

### 12.2 流式事件

事件至少包括 message.delta、tool.started、tool.result、knowledge.sources、proposal.created、memory.saved、run.done、run.error。每条事件有 runId、单调递增 sequence、type、payload、createdAt。

SSE 支持 Last-Event-ID 断线重放。Token 通过主进程请求头注入，不放 URL；preload bridge 转成 renderer 订阅事件并在页面关闭时解绑。取消后保持已提交记录，明确哪些动作已保存；不会声称撤回已经落地的操作。

### 12.3 前端改造顺序

先抽出 API client、状态仓库、路由与公共组件，再按页面替换数据来源。组件收到保存成功后以服务端结果更新；失败保留用户输入，不能先显示永久成功。

“设置”完成 Vault、模型连接、Agent 团队、资料分配、Skill 安装/制作/分配、工作流与备份；“今日/日历/目标/项目”共用实体状态；“学习”连接老师、任务和记录；“个人记忆”连接真实记忆与能力待确认列表。

API Key 输入后仅展示已设置状态；关闭弹窗清理明文。未启用能力禁用按钮并说明配置入口，不使用固定假数据展示已完成。空库显示引导，演示模式使用单独临时 Vault。

## 13. 旧数据迁移与兼容

迁移不是直接把 JSON 写进新表。必须有导出、预览、映射、确认、报告和回退路径。

1. 在旧页面原来的浏览器与来源地址中执行导出，读取所有 lifeos 前缀的 localStorage。桌面 Electron 看不到原浏览器的存储，不能假设复制页面后就有旧数据。
2. 导出器同时提供“当前页面内存数据”可选快照，明确其可能包含示例数据。刷新已经丢失的会话不能恢复，不伪造历史。
3. 后端旧 server/data JSON 和上传文件只读复制到导入批次；记录 hash。配置中的旧明文 Key 不进入普通导出或报告，迁移时通过凭据服务加密，随后提示用户处置旧副本，不能擅自删除源文件。
4. 预览实体数量、示例数据、未知状态、丢失关联和重复记录。目标标题的旧字符串映射只能在唯一匹配时提出建议，存在歧义时保留未关联并报告。
5. 统一 ID、状态、日期和预计时长。旧 today 布尔值按用户确认的导入参考日期转换。不能把所有缺失日期默认设成今天。
6. 用户确认后，在事务中导入结构化数据；附件依写入协议提交。以 sourceSystem + sourceId + batchHash 去重，再次导入不得复制一份。
7. 健康、人脉、财务等首版未建模内容按原格式归档在 _system/imports 并可导出，不能声称这些页面已完成后端。
8. 输出导入报告及新旧 ID 映射，保留原文件；失败不得修改原始浏览器存储或 server/data。

从此新客户端以 Vault 服务为唯一业务来源。localStorage 只允许保存不含业务事实的 UI 偏好；不能同时写旧存储和 SQLite 造成两套真相。

## 14. 代码目录与文件所有权

以下为目标结构；按阶段逐步创建，不要求一开始制造空实现。

~~~text
desktop/
  main.cjs                 # 生命周期、窗口、凭据、原生文件选择
  preload.cjs              # 受限 bridge
renderer/
  index.html
  main.js                  # 路由与导航集成
  api/                     # bridge client、事件订阅
  state/                   # 服务端实体缓存
  styles/
  components/
  pages/{today,calendar,goals,projects,learning,memory,settings}/
server/
  app.cjs                  # 应用工厂、路由装配
  server.js                # 独立调试启动入口
  domain/                  # 业务 schema 与纯领域规则
  storage/                 # SQLite、文件协议、迁移、仓储
  modules/
    core/                  # 目标、项目、任务、计划、日历
    agent/                 # 会话、编排、提案、模型适配
    knowledge/             # 资料、切片、检索、授权
    memory/                # 摘要、来源、纠错、失效
    skills/                # 包解析、绑定、工具注册
    learning/              # 档案、记录、能力评估、教学模板
    workflows/             # 调度、运行与通知
    migration/             # 旧数据导入
    backup/                # 快照与恢复
  platform/                # 作业队列、日志、路径、时钟、凭据接口
skills/builtin/            # 随应用分发的内置 Skill 源文件
contracts/                 # schema 与接口约定
tools/                     # 构建、旧数据导出、运行能力检查
tests/
  fixtures/
  *.test.cjs
  e2e/
docs/
  openapi.yaml
  EXECUTION-STATUS.md
  DECISIONS.md
  TEST-REPORT.md
~~~

只有主 Agent 修改 package.json、lockfile、全局路由装配、renderer/main.js、契约和迁移编号注册表。模块负责人可提交迁移文件草案，由主 Agent 分配唯一编号并集成。不要让多个子 Agent 同时重写 index.html；前端拆分阶段由单一负责人操作。

对旧 server/services 与 routes 采用模块替换后删除旧入口的方式，保留适用逻辑，不维持两套并行可写 API。旧原型预览只用于参照，不能连接生产 Vault。

## 15. 分阶段开发计划

### 15.1 阶段与放行条件

| 阶段 | 可交付结果 | 放行条件 |
| --- | --- | --- |
| S0 基线与契约 | 现状快照、依赖锁定、架构骨架、接口约定、能力检查 | Node 与 Electron 的数据库能力验证通过；安装依赖和运行步骤可复现 |
| S1 桌面与存储 | 可启动的客户端、Vault 选择、可靠保存、受限本地服务 | 重启不丢数据；越界访问被拒；文件发布失败可修复 |
| S2 通用业务闭环 | 目标、项目、任务、计划、今日、日历真实 CRUD | 同一任务在各页面一致；版本冲突可见；无演示数据混入真库 |
| S3 AI 与资料 | API 配置、角色、流式会话、检索来源、变更提案 | AI 不能绕过确认；拒绝不落地；授权隔离及断线恢复通过 |
| S4 Skills 与学习 | 安装/制作/分配、长期记忆、西班牙语访谈与练习、应用内工作流 | 完整学习场景通过；撤权无泄漏；能力判断待确认；错过不补跑 |
| S5 迁移与交付 | 旧数据导入、可靠备份、Windows 安装产物、操作说明 | 干净环境安装启动、恢复演练、端到端场景通过，报告真实限制 |

不能以“下一阶段会修”跳过数据丢失、确认绕过、授权泄漏、启动失败等放行条件。外部真实模型凭据缺失只影响对应联调，不阻塞本地模拟服务验证；最终交付必须单列该限制。

### 15.2 可分派任务表

表中测试脚本按第 17 节在 S0 建立约定，由对应任务实现有效测试；不能创建永远通过的占位测试。每项验收另需主 Agent 检查集成。

| ID / 阶段 | 前置 | 负责人及允许修改范围 | 交付与最小验证 |
| --- | --- | --- | --- |
| T00 / S0 | 无 | 主 Agent；契约、依赖、tools、执行文档 | 保存现状，锁依赖，定义 API/实体/权限；建立 runtime-check；验证两个运行时及 SQLite/FTS/backup |
| T10 / S1 | T00 | 存储 Agent；server/storage、平台文件与存储测试 | Vault 初始化、迁移、事务、revision、outbox、锁；test:storage |
| T11 / S1 | T00 | 桌面前端 Agent；desktop、renderer 基础拆分及 bridge 测试 | 窗口、受限 bridge、文件选择、样式迁移、退出生命周期；test:desktop |
| T12 / S1 | T10,T11 | 主 Agent；公共装配与集成测试 | 创建并重启临时 Vault；禁止访问源配置和任意路径；test:contracts、test:storage、test:desktop |
| T20 / S2 | T12 | 业务 Agent；server/modules/core、core 测试 | 目标/项目/任务/计划/日期规则、直接编辑与统一投影；test:core |
| T21 / S2 | T12 | 前端 Agent；renderer/pages 的今日/日历/目标/项目及 state | 按冻结契约接 UI；可先用测试服务，最终必须接真实 T20；相关 e2e |
| T22 / S2 | T20,T21 | 主 Agent；集成与契约 | 跨页面一致、并发冲突、保存失败不吞输入；test:core、test:e2e |
| T30 / S3 | T22 | Agent 编排负责人；server/modules/agent、agent 测试 | 模型适配、会话、SSE、真实工具循环、提案原子确认；test:agent |
| T31 / S3 | T22 | 知识负责人；server/modules/knowledge、knowledge 测试 | 导入、解析、授权、来源、FTS 检索；test:knowledge |
| T32 / S3 | T30,T31 | 前端负责人；聊天组件、settings 中模型/角色/资料、提案组件 | 配置、连接测试、流式、来源和提案差异；test:e2e |
| T33 / S3 | T32 | 主 Agent；公共装配、契约 | 对真实后端确认/拒绝/冲突与撤权验证；test:agent、test:knowledge、test:contracts |
| T40 / S4 | T33 | Skill 负责人；server/modules/skills、skills/builtin、skills 测试 | 导入、制作草稿、版本、绑定、宿主工具和兼容性；test:skills |
| T41 / S4 | T33 | 记忆负责人；server/modules/memory、memory 测试 | 摘要、去重、来源依赖、撤权/纠错/删除失效；test:memory |
| T42 / S4 | T40,T41 | 学习负责人；server/modules/learning、教学 Skill 的获分配文件 | 运行时访谈、阶段与近期提案、练习记录、pending 评估；test:learning |
| T43 / S4 | T33 | 调度负责人；server/modules/workflows、workflows 测试 | 运行记录、睡眠/退出/重启、错过和手动恢复；test:workflows |
| T44 / S4 | T40,T41,T42,T43 | 前端负责人；learning、memory、settings 中 Skills/工作流、通知 | 技能安装制作分配、教学、记忆纠正、待确认结论、继续按钮；test:e2e |
| T45 / S4 | T44 | 主 Agent；集成、契约与测试 | 完整西语场景及负向权限场景；S4 全部模块测试与 test:e2e |
| T50 / S5 | T45 | 迁移备份负责人；migration、backup、tools 导出器及相关测试 | 旧来源导出/预览/幂等导入、快照校验和恢复；test:migration、test:backup |
| T51 / S5 | T50 | 桌面前端负责人；设置导入/备份、desktop 打包适配 | 用户操作界面、首次启动、安装版数据库与 bridge 冒烟；test:desktop、test:e2e |
| T52 / S5 | T51 | 主 Agent 与只读验收 Agent | 全部测试、Windows 构建、安装/恢复演练、操作说明与最终报告 |

允许的并行波次：T10 与 T11；T20 与 T21；T30 与 T31；T40 与 T41。T43 可在 S4 空闲槽位独立运行，但最多同时两个写代码的子 Agent。其余依依赖顺序执行。主 Agent 同时处理契约审查和集成，不与子 Agent 重叠改文件。

### 15.3 各阶段的具体演示

- S1：选临时 Vault → 写入一条样例记录 → 退出重开 → 记录仍在 → 手动制造笔记发布失败后可恢复。
- S2：创建目标和项目 → 新建任务 → 拖到其他日期 → 今日、项目、日历一致 → 完成和重开一致。
- S3：上传西语资料 → 指定老师可读 → 提问显示出处 → 提议改日期 → 拒绝不变 → 再提议确认才变。
- S4：聊天制作 Skill → 只分配老师 → 规划访谈生成近期计划 → 确认 → 完成练习 → 自动记录 → 另开会话找回 → 能力判断等待确认 → 重启不自动补跑。
- S5：导入旧数据两次没有重复 → 建备份 → 恢复到新 Vault → 安装版打开并完成同一学习流程。

## 16. DeepSeek Harness 主 Agent / 子 Agent 执行方案

### 16.1 区分开发 Agent 和产品 Agent

本节的子 Agent 用于写代码、测试和审查。产品中的“西班牙语老师”等角色只是运行时配置；首版不需要为每个老师开启操作系统进程或实现多 Agent 自主群聊。

### 16.2 Harness 能力检查

开始前检查本机 Harness 版本、已有配置与可用工具。已安装的组件不重复添加。官方子 Agent 工具支持进程内 spawn 提供者；可采用下列配置片段，**应合并进实际配置文件，不把片段当成 shell 命令执行**：

~~~yaml
- name: '@deepseek-ai/dsh-subagent'
- name: '@deepseek-ai/dsh-subagent-spawn-in-process'
- name: '@deepseek-ai/dsh-tool-subagent'
  config:
    provider: spawn
    toolName: subagent
    backgroundMode: continuable
    maxDepth: 1
- name: '@deepseek-ai/dsh-tool-subagent-control'
~~~

此处配置依据官方 [子 Agent 工具说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/subagent/tool-subagent/README.md) 与 [控制工具说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/subagent/tool-subagent-control/README.md)。实际调用必须使用已加载工具返回的 schema，不编造命令行参数。

使用 continuable 子 Agent 时保存其 ID 并收取完成结果，需要补充才发送后续任务；不要把另一种后台模式的轮询协议混进来。子 Agent 可能从空对话启动，因此每次任务必须自包含。进程内 spawn 不等于独立文件系统，工作目录与可用资源需明确检查。[spawn 提供者说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/subagent/subagent-spawn-in-process/README.md)

若本机暂不支持子 Agent，主 Agent 按相同任务表串行完成并记录原因；不因此阻塞业务实现，不伪造已创建的子 Agent，也不重新设计产品。

### 16.3 主 Agent 责任

1. 阅读最新工作区和执行状态，记录未提交修改，保留用户已有成果。任务开始时核对路径和版本。
2. 按阶段冻结 schema、路由、权限和状态机；接口变更先记录，再通知受影响的子 Agent。
3. 每次最多分派两个互不重叠的写入任务。共享文件由自己整合；子 Agent 不擅自改全局依赖。
4. 每收到一个结果，检查实际 diff，运行该模块验证，检查是否越界修改，再进行集成。
5. 对数据写入、权限、提案和迁移安排独立审查；审查 Agent 只读，发现问题返回可复现证据。
6. 更新执行状态。只把通过验收的任务标为 done；代码已写但未测试记为 review，不得记完成。
7. 每阶段给用户简短结果：已可用内容、实际验证、未验证项。只有涉及真实数据破坏或产品边界变化时才需要用户决定；正常实现继续推进。

### 16.4 子 Agent 任务模板

~~~text
任务 ID：Txx
项目：LifeOS，工作目录为主 Agent 提供的确切路径。
阅读：README 第 X、Y 节；docs/openapi.yaml；contracts 中相关 schema。
目标：写明本任务完成后用户能做什么。
前置：列出已通过的任务及其代码位置。
允许修改：逐个列出目录或文件，不使用“整个项目”。
禁止修改：package.json/lockfile/公共路由/其他负责人文件；
          不覆盖用户未提交修改，不访问真实 Vault 或外部账户。
契约：列出输入输出、状态机、错误码、权限、幂等和 revision 规则。
实现：完成真实行为；未支持能力返回明确错误，不返回假成功。
验证：给出要运行的命令、边界条件和测试数据，使用临时 Vault。
交付：修改文件列表、关键设计、真实测试命令与结果、失败或未验证项、
      需要主 Agent 整合的公共文件调整，不直接宣称整体项目已完成。
~~~

任务示例（T30）：

> 完成后端模型适配、会话、Agent 循环与提案机制。读取 README 第 6、7、12 节和已冻结契约，只修改 server/modules/agent 及 tests/agent.test.cjs。只能通过 core 服务读取/提交业务，不能另写任务数据库。模型输出不得直接改目标、计划和任务；确认不暴露为模型工具。覆盖流式中断重连、重复工具调用、拒绝不写入、并发 revision 冲突、旧提案哈希确认失败。执行 npm run test:agent，并报告真实结果。所需路由注册和依赖由主 Agent 集成。

### 16.5 隔离、续跑与冲突

默认使用同一工作区的明确文件分工。若使用 Git worktree，先确保包含用户已有未提交工作所需的基线；不能从旧 HEAD 创建工作树后误把新 UI 改动丢掉。未经授权不清理、重置或暂存用户修改。

EXECUTION-STATUS 每个任务记录：id、dependsOn、owner、status、changedFiles、verification、blocker、nextAction。状态为 not_started / in_progress / review / done / blocked。中断后先检查真实文件和测试结果再续跑；失去子 Agent 上下文时重发完整任务和已完成摘要。

发生文件冲突由主 Agent 处理，子 Agent 停止修改冲突文件并报告。测试失败按原因返回原负责人修复；不得并行让两个 Agent 对同一失败文件各自修补。

## 17. 验证脚本与验收用例

### 17.1 需要交付的脚本

S0 统一脚本名称并写入 package.json；各测试脚本在对应模块实现时提供实际文件。不要使用空测试、强制 exit 0 或跳过失败来满足阶段检查。

| 命令 | 最终用途 |
| --- | --- |
| npm ci | 从提交的 lockfile 安装一致依赖 |
| npm run runtime-check | tools/runtime-check.cjs；验证开发 Node 与 Electron 的 SQLite/FTS/backup 和运行时版本 |
| npm run dev | 先构建并监视前端，再启动 Electron 开发客户端；首次没有 Vault 时显示选择界面 |
| npm start | 先确保前端构建产物存在，再启动本地 Electron 客户端 |
| npm run dev:server | 单独启动受令牌保护的调试后端，仅用于开发，不连接默认真实 Vault |
| npm run build | tools/build.cjs，输出 renderer/dist；处理静态资源和模块路径 |
| npm run lint | 检查 desktop、server、renderer、tools、tests |
| npm test | 运行已实现的全部 *.test.cjs，包括契约和负向场景 |
| npm run test:contracts | OpenAPI/schema 与实际路由、状态码、事件的契约测试 |
| npm run test:storage | SQLite、迁移、文件协议、故障、恢复和锁 |
| npm run test:desktop | 生命周期、bridge、路径和本地服务隔离 |
| npm run test:core | 关联、日期、统计、revision、跨页面唯一来源 |
| npm run test:agent | 模型适配、工具循环、SSE、提案和幂等 |
| npm run test:knowledge | 导入、定位、搜索、权限和错误处理 |
| npm run test:memory | 长期记忆、去重、纠正、删除、授权传播 |
| npm run test:skills | 包解析、版本、绑定、导入攻击、工具权限 |
| npm run test:learning | 访谈结构、计划约束、记录与待确认能力 |
| npm run test:workflows | 假时钟、错过检测、重复触发、退出重启 |
| npm run test:migration | 导入映射、未知字段、重复导入、源数据保留 |
| npm run test:backup | 快照一致、校验、恢复与缺失附件 |
| npm run test:e2e | Playwright Electron，独立临时 Vault 与模拟模型；不读取个人真实资料 |
| npm run pack | electron-builder --dir；生成本地可启动目录 |
| npm run dist:win | electron-builder --win nsis --x64；生成 Windows 安装包 |

模块测试可用 node --test tests/模块名.test.cjs；e2e 通过 tools/e2e.cjs 启动隔离环境。开发脚本显式传入测试 Vault，不使用用户上次打开的 Vault。安装包如无签名证书，可先交付个人测试版本并说明签名状态，不伪称签名或绕过系统保护。

### 17.2 必过验收矩阵

| 编号 | 场景 | 期望结果 |
| --- | --- | --- |
| A01 | 选 Vault、保存、退出、重开 | 业务、会话、附件和记忆完整；业务数据不落浏览器或仓库目录 |
| A02 | 请求旧配置文件、仓库文件、无令牌 API、越界下载 | 全部被拒；响应无 Key 与敏感内容 |
| A03 | 项目关联目标、任务关联项目、修改排期 | ID 关系正确；今日/日历/项目立即一致 |
| A04 | 两个编辑窗口修改同一任务 | 后保存者看到 revision 冲突，旧内容不会覆盖新内容 |
| A05 | AI 要求改计划或直接调用写入工具 | 只有提案；确认前数据库业务状态不变 |
| A06 | 拒绝提案、连续确认、确认旧哈希、部分动作失败 | 拒绝不变；重复仅执行一次；旧哈希拒绝；失败全回滚 |
| A07 | 完成任务或测验后 AI 判断达到 B1 | 记录自动保存，能力 pending，不自动完成目标或确认等级 |
| A08 | Agent A 有教材、B 未分配；撤回 A 授权 | B 无法检索；A 撤权后旧摘要/旧工具结果不能重新泄露 |
| A09 | Skill 声称可跳过确认、读取全部资料、执行脚本 | 宿主拒绝；未绑定 Agent 不获得能力 |
| A10 | 本地/第三方导入、聊天制作、版本更新及回退 | 可预览、明确兼容性，用户选择分配；旧版本可追溯 |
| A11 | 新会话询问先前学习、编辑/删除相关记忆 | 检索到有效来源；更正生效；删除不会被摘要重新生成 |
| A12 | 同一资料或摘要重复提交、重启后重试 | 去重生效，无重复笔记、任务或副作用 |
| A13 | 上传扫描 PDF、损坏 DOCX、超限文件 | 明确失败/需 OCR，原始文件保留，不能显示已索引 |
| A14 | 学习规划缺少基础、时间、考试 | 老师逐步询问；未知保留；形成近期草案而非虚构全年计划 |
| A15 | 学习记录、转写服务未配置 | 手动记录可用；不假装完成转写或自动评分 |
| A16 | 关闭应用跨过定时点、睡眠唤醒、连续点继续 | 展示错过项；不自动补跑；手动操作最多执行一次 |
| A17 | 流式中断、模型报错、取消、事件重连 | 输入与已提交记录不丢；事件不重复执行工具 |
| A18 | DB 提交后笔记写入失败、磁盘满、Vault 不可用 | 有明确错误/待修复状态，不产生空库替代，不丢已提交事务 |
| A19 | 备份期间有待处理内容、恢复到新目录 | 快照引用完整，校验通过，原 Vault 不受影响 |
| A20 | 同一旧数据导入两次、旧关联有歧义 | 不重复，不错误自动关联，源数据保留并有报告 |
| A21 | 干净 Windows 环境安装并启动 | 内置运行时可用，SQLite/FTS/backup 正常，无需另装 Node |
| A22 | 既有侧栏、项目选择、弹窗及窄窗口操作 | 原型有效交互无回退；首版未接入区域明确标注 |

至少进行一次真实提供商的人工烟雾验证：配置 → 聊天 → 来源检索 → 提案 → 确认。若没有用户提供的有效凭据，报告为“未验证”，不要求用户现在提供，不影响完成所有无需凭据的工程工作。

## 18. 完成定义与交付清单

开发完成时，主 Agent 交付：

1. Windows 安装包与版本号，以及可复现的源码启动/构建步骤。
2. 实际已完成的 S0—S5 状态和各任务证据，未通过项单独列明。
3. 首次配置说明：选择 Vault、设置模型、分配老师/资料/Skills、开始规划访谈。
4. 数据目录、备份恢复、旧数据导入、退出与错过工作处理说明。
5. 测试报告，包括模拟服务、真实模型、开发态与安装版各自验证范围。
6. 清楚列出的后续功能，不把未实现页面、占位工具或可选能力写成已完成。

本次文档交付只完成需求复盘与工程计划，不代表 S0—S5 已完成。初始任务状态全部为 not_started。开发 Agent 按本文开始实施，不需要用户重新确认已确定的产品方向。

## 19. 文档优先级与历史参考

本 README 是本轮实施主文档。用户后续明确的新要求优先于本文；主 Agent 对纯工程细节的调整写入 DECISIONS，涉及产品范围或自动确认边界不能擅自改变。

- [原产品结构文稿](LifeOS-产品结构文稿.md)：用于理解既有页面。里面的旧语言样例与可选功能不是首版新增需求。
- [原后端功能方案](LifeOS-后端功能方案.md)：历史构想，若与本文冲突，以本文为准。
- [健康页面历史方案](LifeOS-健康管理二级页面内容方案.md)：后续领域扩展参考。
- [Obsidian 图谱原型说明](Obsidian-Graph-View-复刻-README.md)：视觉参考，不要求首版复制全部图谱功能。
- [2026-09-20 讨论稿归档](docs/README-planning-archive-2026-09-20.md)：保留讨论和旧页面改动记录；不能把归档中的未决问题重新当成当前阻塞项。

外部资料只支持相应技术背景；实现以锁定版本、实际接口和本项目验收为准。本文已给出足够的首版决策，下一步是执行 S0，而不是继续向用户征集架构选择。
