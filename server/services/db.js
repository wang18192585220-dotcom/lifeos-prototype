/**
 * 轻量 JSON 文件存储（替代 better-sqlite3，避免原生编译问题）
 * 数据存储在 server/data/ 目录下，启动时自动创建
 */
const fs = require('fs');
const path = require('path');

function resolveDataDir() {
  return process.env.LIFEOS_DATA_DIR
    ? path.resolve(process.env.LIFEOS_DATA_DIR)
    : path.join(__dirname, '..', 'data');
}

let DATA_DIR = resolveDataDir();
let CONFIG_FILE = path.join(DATA_DIR, 'config.json');
let DOCS_FILE = path.join(DATA_DIR, 'knowledge_docs.json');
let CHUNKS_FILE = path.join(DATA_DIR, 'knowledge_chunks.json');
let ENTRIES_FILE = path.join(DATA_DIR, 'knowledge_entries.json');
let WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');
let WORKFLOW_LOGS_FILE = path.join(DATA_DIR, 'workflow_logs.json');
let SKILLS_FILE = path.join(DATA_DIR, 'skills.json');
let UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

/**
 * 重定向数据目录。桌面端打包后 __dirname 位于只读的 app.asar 内，
 * 直接写入会抛 ENOTDIR；必须在服务启动前指向可写目录（如 Electron userData）。
 */
function configureDataDir(dir) {
  DATA_DIR = path.resolve(dir);
  CONFIG_FILE = path.join(DATA_DIR, 'config.json');
  DOCS_FILE = path.join(DATA_DIR, 'knowledge_docs.json');
  CHUNKS_FILE = path.join(DATA_DIR, 'knowledge_chunks.json');
  ENTRIES_FILE = path.join(DATA_DIR, 'knowledge_entries.json');
  WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');
  WORKFLOW_LOGS_FILE = path.join(DATA_DIR, 'workflow_logs.json');
  SKILLS_FILE = path.join(DATA_DIR, 'skills.json');
  UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ============ 初始化 ============
function initDB() {
  ensureDir(DATA_DIR);
  ensureDir(UPLOADS_DIR);

  // 默认配置
  if (!fs.existsSync(CONFIG_FILE)) {
    writeJSON(CONFIG_FILE, {
      provider: 'deepseek',
      apiKey: '',
      model: 'deepseek-chat',
      baseUrl: '',
      temperature: 0.3,
      systemPrompt: '你是 LifeOS 的个人 AI 助手，语气亲切、简洁、有用。可以调用技能（工具）来帮用户完成任务。',
      knowledgeEnabled: true,
      knowledgeInternalData: true,
      knowledgeMaxChunks: 5,
    });
  }
  if (!fs.existsSync(DOCS_FILE)) writeJSON(DOCS_FILE, []);
  if (!fs.existsSync(CHUNKS_FILE)) writeJSON(CHUNKS_FILE, []);
  if (!fs.existsSync(ENTRIES_FILE)) writeJSON(ENTRIES_FILE, []);
  if (!fs.existsSync(WORKFLOWS_FILE)) writeJSON(WORKFLOWS_FILE, []);
  if (!fs.existsSync(WORKFLOW_LOGS_FILE)) writeJSON(WORKFLOW_LOGS_FILE, []);
  if (!fs.existsSync(SKILLS_FILE)) writeJSON(SKILLS_FILE, []);

  initBuiltinSkills();
}

// ============ 配置 ============
function getConfig() {
  return readJSON(CONFIG_FILE, {});
}

function setConfig(key, value) {
  const cfg = getConfig();
  cfg[key] = value;
  writeJSON(CONFIG_FILE, cfg);
  return cfg;
}

function setConfigBatch(entries) {
  const cfg = { ...getConfig(), ...Object.fromEntries(entries) };
  writeJSON(CONFIG_FILE, cfg);
  return cfg;
}

// ============ 知识库文档 ============
function listDocuments() {
  return readJSON(DOCS_FILE, []).sort((a, b) => b.createdAt - a.createdAt);
}

function getDocument(id) {
  return listDocuments().find((d) => d.id === id);
}

function insertDocument(doc) {
  const docs = readJSON(DOCS_FILE, []);
  const newDoc = {
    id: genId('doc'),
    createdAt: Date.now(),
    chunkCount: 0,
    status: 'pending',
    ...doc,
  };
  docs.push(newDoc);
  writeJSON(DOCS_FILE, docs);
  return newDoc;
}

function updateDocument(id, patch) {
  const docs = readJSON(DOCS_FILE, []);
  const idx = docs.findIndex((d) => d.id === id);
  if (idx >= 0) {
    docs[idx] = { ...docs[idx], ...patch };
    writeJSON(DOCS_FILE, docs);
    return docs[idx];
  }
  return null;
}

function deleteDocument(id) {
  const docs = readJSON(DOCS_FILE, []).filter((d) => d.id !== id);
  writeJSON(DOCS_FILE, docs);
  // 同时删除 chunks
  const chunks = readJSON(CHUNKS_FILE, []).filter((c) => c.docId !== id);
  writeJSON(CHUNKS_FILE, chunks);
}

// ============ 知识库 Chunks ============
function listChunks(docId) {
  const chunks = readJSON(CHUNKS_FILE, []);
  return docId ? chunks.filter((c) => c.docId === docId) : chunks;
}

function insertChunks(newChunks) {
  const chunks = readJSON(CHUNKS_FILE, []);
  const withIds = newChunks.map((c) => ({ id: genId('chk'), ...c }));
  chunks.push(...withIds);
  writeJSON(CHUNKS_FILE, chunks);
  return withIds;
}

function updateChunk(id, patch) {
  const chunks = readJSON(CHUNKS_FILE, []);
  const idx = chunks.findIndex((c) => c.id === id);
  if (idx >= 0) {
    chunks[idx] = { ...chunks[idx], ...patch };
    writeJSON(CHUNKS_FILE, chunks);
    return chunks[idx];
  }
  return null;
}

function deleteChunksByDocId(docId) {
  const chunks = readJSON(CHUNKS_FILE, []).filter((c) => c.docId !== docId);
  writeJSON(CHUNKS_FILE, chunks);
}

function allChunksWithEmbedding() {
  return readJSON(CHUNKS_FILE, []).filter((c) => c.embedding && c.embedding.length);
}

// ============ 手动条目 ============
function listEntries() {
  return readJSON(ENTRIES_FILE, []).sort((a, b) => b.createdAt - a.createdAt);
}

function insertEntry(entry) {
  const entries = readJSON(ENTRIES_FILE, []);
  const newEntry = {
    id: genId('ent'),
    createdAt: Date.now(),
    tags: '',
    ...entry,
  };
  entries.push(newEntry);
  writeJSON(ENTRIES_FILE, entries);
  return newEntry;
}

function deleteEntry(id) {
  const entries = readJSON(ENTRIES_FILE, []).filter((e) => e.id !== id);
  writeJSON(ENTRIES_FILE, entries);
}

// ============ 工作流 ============
function listWorkflows() {
  return readJSON(WORKFLOWS_FILE, []).sort((a, b) => b.createdAt - a.createdAt);
}

function getWorkflow(id) {
  return listWorkflows().find((w) => w.id === id);
}

function insertWorkflow(wf) {
  const wfs = readJSON(WORKFLOWS_FILE, []);
  const newWf = {
    id: genId('wf'),
    createdAt: Date.now(),
    enabled: 1,
    lastRunAt: null,
    ...wf,
  };
  wfs.push(newWf);
  writeJSON(WORKFLOWS_FILE, wfs);
  return newWf;
}

function updateWorkflow(id, patch) {
  const wfs = readJSON(WORKFLOWS_FILE, []);
  const idx = wfs.findIndex((w) => w.id === id);
  if (idx >= 0) {
    wfs[idx] = { ...wfs[idx], ...patch };
    writeJSON(WORKFLOWS_FILE, wfs);
    return wfs[idx];
  }
  return null;
}

function deleteWorkflow(id) {
  const wfs = readJSON(WORKFLOWS_FILE, []).filter((w) => w.id !== id);
  writeJSON(WORKFLOWS_FILE, wfs);
}

function addWorkflowLog(log) {
  const logs = readJSON(WORKFLOW_LOGS_FILE, []);
  const newLog = { id: genId('log'), createdAt: Date.now(), ...log };
  logs.unshift(newLog);
  // 只保留最近 200 条
  writeJSON(WORKFLOW_LOGS_FILE, logs.slice(0, 200));
  return newLog;
}

function getWorkflowLogs(workflowId, limit = 50) {
  const logs = readJSON(WORKFLOW_LOGS_FILE, []);
  const filtered = workflowId ? logs.filter((l) => l.workflowId === workflowId) : logs;
  return filtered.slice(0, limit);
}

// ============ 技能 ============
const BUILTIN_SKILLS = [
  {
    name: 'web_search',
    displayName: '联网搜索',
    description: '当用户询问实时信息或你不知道的内容时，使用搜索引擎查询。',
    icon: '🔍',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '搜索关键词' } },
      required: ['query'],
    },
  },
  {
    name: 'create_reminder',
    displayName: '创建提醒',
    description: '为用户创建一个未来的提醒事项。',
    icon: '⏰',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '提醒内容' },
        time: { type: 'string', description: '提醒时间，格式 YYYY-MM-DD HH:mm' },
      },
      required: ['content', 'time'],
    },
  },
  {
    name: 'create_todo',
    displayName: '添加待办',
    description: '向用户的待办清单添加一个任务。',
    icon: '✅',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '任务标题' },
        dueDate: { type: 'string', description: '截止日期（可选）YYYY-MM-DD' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'], description: '优先级' },
      },
      required: ['title'],
    },
  },
  {
    name: 'query_calendar',
    displayName: '查询日程',
    description: '查询用户指定日期的日程安排。',
    icon: '📅',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '查询日期 YYYY-MM-DD，默认今天' },
      },
    },
  },
];

function initBuiltinSkills() {
  let skills = readJSON(SKILLS_FILE, []);
  let changed = false;
  for (const bs of BUILTIN_SKILLS) {
    if (!skills.find((s) => s.name === bs.name)) {
      skills.push({
        id: genId('sk'),
        name: bs.name,
        displayName: bs.displayName,
        description: bs.description,
        icon: bs.icon,
        parameters: bs.parameters,
        enabled: 0,
        config: '{}',
        isBuiltin: 1,
        installedAt: Date.now(),
      });
      changed = true;
    }
  }
  if (changed) writeJSON(SKILLS_FILE, skills);
}

function listSkills() {
  initBuiltinSkills(); // 惰性播种内置技能，避免技能列表/工具集为空
  return readJSON(SKILLS_FILE, []).sort((a, b) => b.installedAt - a.installedAt);
}

function getSkillByName(name) {
  return listSkills().find((s) => s.name === name);
}

function updateSkill(id, patch) {
  const skills = readJSON(SKILLS_FILE, []);
  const idx = skills.findIndex((s) => s.id === id);
  if (idx >= 0) {
    skills[idx] = { ...skills[idx], ...patch };
    writeJSON(SKILLS_FILE, skills);
    return skills[idx];
  }
  return null;
}

module.exports = {
  initDB,
  getConfig,
  setConfig,
  setConfigBatch,
  // docs
  listDocuments,
  getDocument,
  insertDocument,
  updateDocument,
  deleteDocument,
  // chunks
  listChunks,
  insertChunks,
  updateChunk,
  deleteChunksByDocId,
  allChunksWithEmbedding,
  // entries
  listEntries,
  insertEntry,
  deleteEntry,
  // workflows
  listWorkflows,
  getWorkflow,
  insertWorkflow,
  updateWorkflow,
  deleteWorkflow,
  addWorkflowLog,
  getWorkflowLogs,
  // skills
  initBuiltinSkills,
  listSkills,
  getSkillByName,
  updateSkill,
  // paths
  configureDataDir,
  get UPLOADS_DIR() { return UPLOADS_DIR; },
  get DATA_DIR() { return DATA_DIR; },
  genId,
};
