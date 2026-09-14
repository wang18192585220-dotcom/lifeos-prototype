# LifeOS 后端功能方案

## 一、现状盘点

### 1.1 现有后端已实现的模块

| 模块 | 文件 | 状态 |
|------|------|------|
| AI 聊天（流式+非流式） | `server/routes/chat.js` + `services/llm.js` | ✅ 可用 |
| LLM 配置（API Key、模型等） | `server/routes/agent-config.js` | ✅ 可用 |
| 知识库（文档上传、分片、检索） | `server/routes/knowledge.js` + `services/knowledge.js` | ✅ 可用 |
| 技能管理（联网搜索、创建提醒、添加待办、查询日程） | `server/routes/skills.js` + `services/skills.js` | ✅ 可用 |
| 定时工作流（cron调度 + AI消息） | `server/routes/workflows.js` + `services/workflow.js` | ✅ 可用 |
| 数据存储 | `services/db.js`（轻量JSON文件存储） | ✅ 可用 |

### 1.2 前端数据现状（全部未接入后端）

以下数据目前要么存在浏览器 `localStorage`，要么直接硬编码在 `index.html` 的 JS 里，刷新浏览器/换浏览器就会丢失，页面之间无法真正联动：

| 数据 | 存储位置 | 对应前端页面 |
|------|---------|-------------|
| **目标 goals** | `localStorage(lifeos_full_data)` | 目标页、各领域页、首页 |
| **项目 projects** | `localStorage(lifeos_full_data)` | 领域页项目区、侧栏、项目详情 |
| **阶段 stages**（路线图） | `localStorage(lifeos_full_data)` | AI智能体详情、项目详情 |
| **里程碑 milestones** | `localStorage(lifeos_full_data)` | 项目详情、今日页 |
| **任务 tasks** | `localStorage(lifeos_full_data)` | 今日优先事项、项目详情、日历 |
| **想法 ideas** | 硬编码在JS中 | 想法收集箱 |
| **个人记忆 memories** | 硬编码在JS中 | 个人记忆页 |
| **健康记录** | `localStorage(lifeosHealthRecords)` | 健康管理页（睡眠/精力/营养/饮水/医疗/恢复） |
| **人脉 contacts** | `localStorage(lifeosNetwork)` | 人脉管理页 |
| **运动记录** | 硬编码示例数据 | 运动管理页 |
| **财富数据** | 硬编码示例数据 | 财富管理页 |
| **复盘 reviews** | 硬编码示例数据 | 复盘页 |
| **设置 settings** | 硬编码控件状态 | 设置页 |
| **通知** | 无 | 顶部通知栏（只有提示文字） |

---

## 二、需要新增的后端模块

按优先级分三批实施：

### 第一批（P0）：核心业务数据 —— 让前端数据真正持久化

这一批做完，前端所有CRUD操作就不再依赖 localStorage，数据统一存到后端，页面之间自然联动。

| 模块 | 说明 |
|------|------|
| **目标 Goals** | 目标的增删改查、按领域筛选、关联项目 |
| **项目 Projects** | 项目的增删改查、按领域/目标查询、所属领域变更 |
| **阶段 Stages** | 项目路线图阶段，增删改查、排序、状态 |
| **里程碑 Milestones** | 项目里程碑，增删改查、状态更新 |
| **任务 Tasks** | 任务增删改查、按项目/日期/状态筛选、完成勾选、标记今日 |
| **想法 Ideas** | 想法收集箱CRUD、「转为项目」联动 |
| **个人记忆 Memories** | 记忆CRUD、分类搜索 |

### 第二批（P1）：各人生领域专属模块

| 模块 | 说明 |
|------|------|
| **健康 Health** | 睡眠/精力/营养/饮水/医疗/恢复/行动 记录的CRUD，按日期查询，趋势统计 |
| **运动 Exercise** | 训练计划、训练记录CRUD，本周完成统计，进展追踪 |
| **财富 Finance** | 收支记录CRUD、账户资产、月度/年度统计、储蓄目标 |
| **人脉 Contacts** | 联系人CRUD、跟进记录、关系图谱数据、待跟进提醒 |

### 第三批（P2）：联动聚合与智能

| 模块 | 说明 |
|------|------|
| **今日/仪表盘 Dashboard** | 首页数据聚合（不存新数据，从其他模块计算）：问候、状态摘要数字、今日任务、活跃目标、六领域概览 |
| **日历 Calendar** | 任务排期，月视图数据，拖动改日期，日期详情 |
| **复盘 Reviews** | 每日/每周/每月复盘记录CRUD，自动汇总已完成任务，生成复盘模板 |
| **通知 Notifications** | 里程碑到期、联系人待跟进、工作流触发，标记已读 |
| **全局搜索 Search** | 跨目标/项目/任务/想法/记忆/联系人搜索 |
| **设置 Settings** | 用户偏好持久化（简报、周起始日、主题、语言等） |
| **数据导入导出** | 替代前端的浏览器导出，后端统一导出/导入JSON |

---

## 三、信息联动规则（核心）

数据搬到后端后，联动通过「写操作时后端自动计算 + 前端刷新数据」实现，不需要消息队列。

### 3.1 核心联动链路

```
完成任务（task.status = 'done'）
  │
  ├─→ 检查所属里程碑的所有任务是否全部完成
  │     └─ 是 → 自动标记 milestone.status = 'completed'
  │           └─→ 自动推进到下一个里程碑 status = 'current'
  │                 └─→ 重算项目进度（按里程碑完成率计算）
  │                       └─→ 重算关联目标进度（按关联项目加权）
  │
  ├─→ 今日页统计数字变化（已完成数+1，待完成数-1）
  └─→ 复盘时自动出现在「本周已完成任务」列表中
```

```
新增项目（选择所属领域）
  ├─→ 对应领域页面显示新项目卡片
  └─→ 侧栏该领域下出现新项目子项（前端重新拉导航数据即可）
```

```
想法 → 转为项目
  ├─→ 创建新的 project（复用想法的标题和描述）
  └─→ 原想法标记 converted=true，关联 projectId（不删除，保留来源）
```

```
拖动任务到其他日期（日历）
  ├─→ 更新 task.scheduledDate
  ├─→ 日历视图新日期下显示该任务
  └─→ 若 scheduledDate = 今天 → 出现在今日任务清单
      若 scheduledDate ≠ 今天 → 从今日任务清单移除
```

```
添加联系人跟进记录
  ├─→ 更新 contact.lastFollowupAt
  └─→ 超过设定天数未跟进 → 写入通知表（待跟进提醒）
```

```
添加健康记录
  └─→ 仪表盘/今日页展示今日精力/睡眠状态摘要
```

```
定时工作流触发（已有cron能力）
  └─→ AI生成提醒内容 → 写入通知表 → 前端可轮询/SSE获取
```

### 3.2 联动实现方式

| 联动类型 | 实现方式 |
|---------|---------|
| 进度自动重算 | 后端在任务/里程碑状态变更时，同步更新上层（里程碑→项目→目标）的进度字段 |
| 页面间数据同步 | 前端在操作完成后，调用对应GET接口刷新数据；后续可加SSE推送 |
| 通知生成 | 后端定时任务（复用现有 node-cron）检查到期项，写入notifications |
| 想法转项目 | 后端 `/api/ideas/:id/convert` 接口，在一个操作里创建project并更新idea |

---

## 四、API 接口清单

### 4.1 核心业务接口（P0）

#### 目标 Goals
```
GET    /api/goals                          # 列表，支持 ?area=career 筛选
POST   /api/goals                          # 创建 { name, area, deadline, expectedResult }
GET    /api/goals/:id                      # 详情（含关联项目列表及进度）
PUT    /api/goals/:id                      # 更新
DELETE /api/goals/:id                      # 删除
```

#### 项目 Projects
```
GET    /api/projects                       # 列表，支持 ?area=learning&goalId=xxx&status=进行中
POST   /api/projects                       # 创建 { name, area, goalId?, status, progress, deadline, description }
GET    /api/projects/:id                   # 详情（含 stages、milestones、tasks 聚合）
PUT    /api/projects/:id                   # 更新（进度由后端自动维护，前端不直接传）
DELETE /api/projects/:id                   # 删除
```

#### 阶段 Stages
```
GET    /api/stages?projectId=p-xxx         # 某项目的阶段列表（按order排序）
POST   /api/stages                         # 创建 { projectId, name, order, status }
PUT    /api/stages/:id                     # 更新（名称、顺序、状态）
DELETE /api/stages/:id                     # 删除
```

#### 里程碑 Milestones
```
GET    /api/milestones?projectId=p-xxx     # 某项目的里程碑
POST   /api/milestones                     # 创建 { projectId, stageId?, name, criteria, status }
PUT    /api/milestones/:id                 # 更新（状态、名称、标准）
DELETE /api/milestones/:id                 # 删除
```

#### 任务 Tasks
```
GET    /api/tasks                          # 列表，支持 ?date=2026-09-14&projectId=&status=&today=true&area=
POST   /api/tasks                          # 创建 { projectId?, milestoneId?, name, nextAction, priority, duration, deadline, scheduledDate, today, status }
PUT    /api/tasks/:id                      # 更新任意字段
PATCH  /api/tasks/:id/complete             # 标记完成（触发联动重算）
PATCH  /api/tasks/:id/reschedule           # 改期 { scheduledDate }（日历拖动用）
DELETE /api/tasks/:id                      # 删除
```

#### 想法 Ideas
```
GET    /api/ideas                          # 列表，支持 ?category=xxx
POST   /api/ideas                          # 创建 { name, category, relatedSkills, potential, description? }
PUT    /api/ideas/:id                      # 更新
POST   /api/ideas/:id/convert              # 转为项目 → 自动创建project并关联
DELETE /api/ideas/:id                      # 删除
```

#### 个人记忆 Memories
```
GET    /api/memories                       # 列表，支持 ?category=事实&q=关键词
POST   /api/memories                       # 创建 { category, content, tags? }
PUT    /api/memories/:id                   # 更新
DELETE /api/memories/:id                   # 删除
```

### 4.2 领域模块接口（P1）

#### 健康 Health
```
GET    /api/health/records                 # 记录列表，支持 ?type=sleep&date=2026-09-14&from=&to=
POST   /api/health/records                 # 添加记录 { type, date, data }
GET    /api/health/summary                 # 健康摘要（最近7天趋势，首页用）
DELETE /api/health/records/:id
```

#### 运动 Exercise
```
GET    /api/exercise/plans                 # 训练计划列表
POST   /api/exercise/plans                 # 创建训练计划
GET    /api/exercise/logs                  # 训练记录，支持 ?from=&to=
POST   /api/exercise/logs                  # 添加训练记录 { type, duration, intensity, notes, date }
GET    /api/exercise/stats                 # 统计（本周次数、总时长等）
DELETE /api/exercise/logs/:id
```

#### 财富 Finance
```
GET    /api/finance/records                # 收支记录，支持 ?type=income/expense&month=2026-09&category=
POST   /api/finance/records                # 添加记录 { type, category, amount, date, note }
GET    /api/finance/accounts               # 账户/资产列表
POST   /api/finance/accounts               # 添加账户
GET    /api/finance/summary                # 概览统计（本月收入/支出/储蓄率/净资产）
DELETE /api/finance/records/:id
```

#### 人脉 Contacts
```
GET    /api/contacts                       # 联系人列表，支持 ?category=朋友/职业/导师/招聘/合作者
POST   /api/contacts                       # 创建 { name, category, company?, title?, contact?, notes? }
GET    /api/contacts/:id                   # 详情（含跟进记录）
PUT    /api/contacts/:id                   # 更新
DELETE /api/contacts/:id                   # 删除
POST   /api/contacts/:id/followups         # 添加跟进记录 { content, date }
GET    /api/contacts/:id/followups         # 跟进历史
GET    /api/contacts/graph                 # 关系图谱数据（节点和连线）
```

### 4.3 联动聚合接口（P2）

#### 今日/仪表盘 Dashboard
```
GET    /api/dashboard/today                # 首页全部数据（一次性返回，减少请求数）
                                           # 返回：{ greeting, stats:{taskCount, activeGoals, importantProjects, pendingFollowups},
                                           #         todayTasks, areaOverview:{career,learning,health,exercise,finance,network}, activeGoals }
GET    /api/dashboard/overview             # 顶部状态栏数字
```

#### 日历 Calendar
```
GET    /api/calendar/month?month=2026-09   # 某月所有任务（按月视图需要，返回每天任务数和简要列表）
GET    /api/calendar/day/:date             # 某日期的全部任务详情
```

#### 复盘 Reviews
```
GET    /api/reviews                        # 复盘列表，支持 ?type=daily/weekly/monthly&date=
POST   /api/reviews                        # 创建复盘 { type, dateRange, content }
GET    /api/reviews/:id                    # 复盘详情
GET    /api/reviews/template?type=weekly&date=2026-09-14  # 自动汇总数据生成复盘模板
```

#### 通知 Notifications
```
GET    /api/notifications                  # 通知列表（未读优先，?unread=true）
PATCH  /api/notifications/:id/read         # 标记已读
PATCH  /api/notifications/read-all         # 全部已读
```

#### 全局搜索
```
GET    /api/search?q=关键词                # 返回匹配的 goals/projects/tasks/ideas/memories/contacts
```

#### 设置 Settings
```
GET    /api/settings                       # 获取偏好设置
PUT    /api/settings                       # 批量更新偏好
```

#### 数据导入导出
```
GET    /api/data/export                    # 导出全部数据为JSON文件
POST   /api/data/import                    # 从JSON导入数据（覆盖或合并）
```

---

## 五、数据存储方案

继续使用现有的 JSON 文件存储（和现有 `db.js` 风格一致），不引入数据库。原因：
- 个人产品，数据量小（目标/项目/任务总计不会超过几千条）
- 零部署成本，`npm start` 即可运行
- 和现有代码风格完全一致
- 如果将来需要多设备同步或数据量增长，再迁移到 SQLite

### 5.1 新增的JSON文件

```
server/data/
├── config.json                  # 已有
├── knowledge_docs.json          # 已有
├── knowledge_chunks.json        # 已有
├── knowledge_entries.json       # 已有
├── skills.json                  # 已有
├── workflows.json               # 已有
├── workflow_logs.json           # 已有
├── goals.json                   # 🆕 新增
├── projects.json                # 🆕 新增
├── stages.json                  # 🆕 新增
├── milestones.json              # 🆕 新增
├── tasks.json                   # 🆕 新增
├── ideas.json                   # 🆕 新增
├── memories.json                # 🆕 新增
├── health_records.json          # 🆕 新增
├── exercise_plans.json          # 🆕 新增
├── exercise_logs.json           # 🆕 新增
├── finance_records.json         # 🆕 新增
├── finance_accounts.json        # 🆕 新增
├── contacts.json                # 🆕 新增
├── followups.json               # 🆕 新增
├── reviews.json                 # 🆕 新增
├── notifications.json           # 🆕 新增
└── settings.json                # 🆕 新增
```

### 5.2 核心数据结构示例

**goals.json**
```json
[
  {
    "id": "g1",
    "name": "2027做出可商业化AI产品",
    "area": "career",
    "deadline": "2027-07-01",
    "expectedResult": "有一个能产生收入的AI产品",
    "progress": 32,
    "status": "active",
    "createdAt": 1726000000000,
    "updatedAt": 1726000000000
  }
]
```

**projects.json**
```json
[
  {
    "id": "p-agent",
    "name": "AI 智能体开发",
    "area": "learning",
    "goalId": "g1",
    "status": "进行中",
    "progress": 37,
    "deadline": "2027-01-31",
    "description": "通过真实项目建立AI系统能力",
    "createdAt": 1726000000000,
    "updatedAt": 1726000000000
  }
]
```

**tasks.json**
```json
[
  {
    "id": "t1",
    "projectId": "p-tiktok",
    "milestoneId": "m2",
    "workstream": "抓取",
    "name": "完成Cookie持久化测试",
    "nextAction": "让Playwright复用已登录Cookie并重启验证",
    "priority": "高",
    "duration": "90分钟",
    "deadline": "2026-09-18",
    "scheduledDate": "2026-09-14",
    "status": "doing",
    "today": true,
    "completedAt": null,
    "createdAt": 1726000000000,
    "updatedAt": 1726000000000
  }
]
```

---

## 六、文件结构（新增部分）

```
server/
├── server.js                    # 已有，需要注册新路由
├── services/
│   ├── db.js                    # 已有，需要扩展新的CRUD方法
│   ├── llm.js                   # 已有
│   ├── knowledge.js             # 已有
│   ├── skills.js                # 已有
│   ├── workflow.js              # 已有
│   ├── core.js                  # 🆕 核心业务服务：goals/projects/stages/milestones/tasks/ideas/memories
│   │                            #     包含联动计算逻辑（进度自动重算、想法转项目等）
│   ├── health.js                # 🆕 健康记录服务
│   ├── exercise.js              # 🆕 运动管理服务
│   ├── finance.js               # 🆕 财务管理服务
│   ├── contacts.js              # 🆕 人脉+跟进服务
│   ├── dashboard.js             # 🆕 今日/仪表盘聚合服务
│   ├── calendar.js              # 🆕 日历排期服务
│   ├── review.js                # 🆕 复盘服务
│   └── notification.js          # 🆕 通知服务（含定时检查到期项）
├── routes/
│   ├── chat.js                  # 已有
│   ├── agent-config.js          # 已有
│   ├── knowledge.js             # 已有
│   ├── skills.js                # 已有
│   ├── workflows.js             # 已有
│   ├── core.js                  # 🆕 核心业务路由：goals/projects/stages/milestones/tasks/ideas/memories
│   ├── health.js                # 🆕
│   ├── exercise.js              # 🆕
│   ├── finance.js               # 🆕
│   ├── contacts.js              # 🆕
│   ├── dashboard.js             # 🆕
│   ├── calendar.js              # 🆕
│   ├── reviews.js               # 🆕
│   ├── notifications.js         # 🆕
│   ├── search.js                # 🆕
│   └── settings.js              # 🆕
```

---

## 七、统一响应格式

所有接口统一返回格式（与现有接口风格一致）：

```json
// 成功
{ "ok": true, "data": { ... } }

// 列表（带分页，后续如果数据量大了加分页，前期直接返回数组）
{ "ok": true, "list": [ ... ], "total": 10 }

// 错误
{ "ok": false, "error": "错误信息" }
```

---

## 八、前端改造要点

后端接口就绪后，前端 `index.html` 需要做的改动：

1. **替换 dataStore**：把 `dataStore.get()/save()` 改为调用 `fetch('/api/...')`，从后端读写数据
2. **替换健康存储**：`loadHealth()/saveHealth()` 改为调用 `/api/health/records`
3. **替换人脉存储**：`loadNetwork()/saveNetwork()` 改为调用 `/api/contacts`
4. **替换硬编码数据**：ideas、memories 从 `GET /api/ideas`、`GET /api/memories` 拉取
5. **首页数据**：改为调用 `GET /api/dashboard/today`，一次性获取今日所有数据
6. **新增/编辑表单**：提交时 POST/PUT 到后端，成功后刷新列表
7. **任务勾选**：点击完成时调用 `PATCH /api/tasks/:id/complete`，后端自动重算进度
8. **保留localStorage降级**：后端不可用时可以临时降级到localStorage（可选，个人产品不需要）

---

## 九、实施步骤（共7步）

| 步骤 | 做什么 | 涉及文件 | 完成效果 |
|------|--------|---------|---------|
| **步骤1** | 扩展 `db.js`，新增所有JSON文件的读写函数（和现有风格一致：listXxx/getXxx/insertXxx/updateXxx/deleteXxx） | `services/db.js` | 数据层就绪 |
| **步骤2** | 创建 `services/core.js`，实现核心业务逻辑：CRUD + 联动计算（任务完成→重算里程碑→重算项目→重算目标） | `services/core.js` | 业务逻辑层就绪 |
| **步骤3** | 创建 `routes/core.js`，注册 goals/projects/stages/milestones/tasks/ideas/memories 的所有路由；在 `server.js` 中挂载 | `routes/core.js`, `server.js` | P0接口可调用 |
| **步骤4** | 修改前端 `index.html` 中的 `dataStore`、健康存储、人脉存储，改为调用后端API；把硬编码的 ideas/memories 改为后端拉取 | `index.html` | **核心数据真正持久化，页面间联动生效** |
| **步骤5** | 实现 P1 领域模块：health/exercise/finance/contacts 的 service + route | `services/health.js`, `services/exercise.js`, `services/finance.js`, `services/contacts.js`, 对应routes | 各领域页可用 |
| **步骤6** | 实现 P2 聚合模块：dashboard/calendar/reviews/notifications/search/settings | 对应services和routes | 首页真实数据、日历可用、通知可用 |
| **步骤7** | 数据导入导出替代前端浏览器导出，通知定时检查，全局搜索 | `services/notification.js` 定时任务 | 功能完善 |

---

## 十、不做的事情

为了保持项目简单可靠，以下事情在当前阶段**不做**：
- 不引入数据库（保持JSON文件存储）
- 不引入消息队列（同步API + 前端刷新足够）
- 不做用户认证/登录（本地个人产品，不需要）
- 不做WebSocket（SSE复用现有机制即可，或直接前端轮询通知）
- 不做多用户/多设备同步（单机使用）
- 不做文件版本历史（个人产品不需要操作日志回放）
