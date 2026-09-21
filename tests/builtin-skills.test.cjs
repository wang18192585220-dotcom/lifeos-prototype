'use strict';

/**
 * test:builtin-skills —— 内置 Skill 加载与幂等种子（S4 T40）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { SkillService } = require('../server/modules/skills');
const { listBuiltinSkills, seedBuiltinSkills } = require('../skills/builtin');

test('内置 Skill 源文件齐全（至少 4 个）', () => {
  const list = listBuiltinSkills();
  assert.ok(list.length >= 4, '至少 4 个内置 Skill');
  const names = list.map((s) => s.name);
  for (const n of ['planning-interview', 'small-step-learning', 'study-review', 'memory-summary']) {
    assert.ok(names.includes(n), `应包含 ${n}`);
  }
  // 每个都有描述与正文
  for (const s of list) {
    assert.ok(s.description, `${s.name} 应有描述`);
    assert.ok(s.content.length > 0, `${s.name} 应有正文`);
  }
});

test('种子幂等：重复种子不重复创建', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  const skills = new SkillService(v.adapter);
  try {
    const a = seedBuiltinSkills(skills);
    const b = seedBuiltinSkills(skills);
    assert.strictEqual(a.length, b.length);
    assert.strictEqual(skills.list().filter((s) => s.source === 'builtin').length, a.length);
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
