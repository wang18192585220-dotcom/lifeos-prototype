const db = require('./db');

function listSkills() {
  return db.listSkills().map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    enabled: !!r.enabled,
    builtin: !!r.isBuiltin,
    config: safeJSONParse(r.config, {}),
    displayName: r.displayName || r.name,
    icon: r.icon || 'spark',
    installedAt: r.installedAt,
  }));
}

function getEnabledToolDefs() {
  const enabled = db.listSkills().filter((s) => s.enabled);
  return enabled
    .map((s) => {
      const params = s.parameters && typeof s.parameters === 'object' ? s.parameters : { type: 'object', properties: {} };
      return {
        type: 'function',
        function: {
          name: s.name,
          description: s.description,
          parameters: params,
        },
      };
    })
    .filter(Boolean);
}

function toggleSkill(skillId, enabled) {
  db.updateSkill(skillId, { enabled: enabled ? 1 : 0 });
}

function updateSkillConfig(skillId, config) {
  db.updateSkill(skillId, { config: JSON.stringify(config) });
}

async function executeSkill(name, args) {
  switch (name) {
    case 'web_search':
      return { result: '联网搜索暂未接入搜索引擎 API，后续版本可配置 Serper/DuckDuckGo。', query: args.query };
    case 'create_reminder':
      return { result: `已创建提醒：${args.message || args.content}（${args.when || args.time}）`, note: '提醒将在指定时间推送' };
    case 'create_todo':
      return { result: `已创建待办：${args.title}`, priority: args.priority || '中', dueDate: args.dueDate || '' };
    case 'query_calendar':
      return { result: '日历查询将在接入完整日程数据后开放。', date: args.date || '今天' };
    default:
      return { error: `未知技能：${name}` };
  }
}

function safeJSONParse(str, fallback) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch {
    return fallback;
  }
}

module.exports = { listSkills, getEnabledToolDefs, toggleSkill, updateSkillConfig, executeSkill, initBuiltinSkills: db.initBuiltinSkills };
