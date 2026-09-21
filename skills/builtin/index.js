'use strict';

/**
 * 内置 Skill 源文件加载（README 9.3）。
 * 随应用分发；由 seedBuiltinSkills 在首次启动时写入数据库。
 */
const fs = require('node:fs');
const path = require('node:path');

const BUILTIN_DIR = __dirname;

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const fm = {};
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) fm[kv[1]] = kv[2].trim();
    }
    return { fm, body: text.slice(m[0].length) };
  }
  return { fm, body: text };
}

/** 列出内置 Skill 目录。 */
function listBuiltinSkills() {
  const out = [];
  for (const entry of fs.readdirSync(BUILTIN_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(BUILTIN_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const text = fs.readFileSync(skillFile, 'utf8');
    const { fm, body } = parseFrontmatter(text);
    out.push({
      name: fm.name || entry.name,
      description: fm.description || '',
      content: body.trim(),
      source: 'builtin',
      dir: entry.name,
    });
  }
  return out;
}

/**
 * 幂等写入内置 Skill 草稿（按 name 去重）。
 * @param {import('../../server/modules/skills/service').SkillService} skillService
 */
function seedBuiltinSkills(skillService) {
  const seeded = [];
  for (const s of listBuiltinSkills()) {
    const existing = skillService.list().find((x) => x.name === s.name && x.source === 'builtin');
    if (existing) {
      seeded.push(existing);
      continue;
    }
    const draft = skillService.createDraft({
      name: s.name,
      description: s.description,
      manifest: { instructions: s.content, tools: [] },
      source: 'builtin',
    });
    seeded.push(draft);
  }
  return seeded;
}

module.exports = { listBuiltinSkills, seedBuiltinSkills };
