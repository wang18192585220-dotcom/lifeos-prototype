'use strict';

/**
 * test:skills —— Skills 安装/版本/绑定（S4 T40）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { SkillService } = require('../server/modules/skills');

function withSkills(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  const s = new SkillService(v.adapter);
  try {
    fn(s);
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('草稿 → 安装 → 启用 → 绑定 → 可用', () =>
  withSkills((s) => {
    const draft = s.createDraft({ name: 'study-review', description: '复盘', manifest: { tools: [] } });
    assert.strictEqual(draft.installStatus, 'draft');
    assert.strictEqual(s.isAvailable('agent-a', draft.id), false);

    s.install(draft.id);
    s.enable(draft.id);
    s.bind('agent-a', draft.id, '1.0');
    assert.strictEqual(s.isAvailable('agent-a', draft.id), true);
  }));

test('未绑定 Agent 不可用', () =>
  withSkills((s) => {
    const d = s.createDraft({ name: 'x' });
    s.install(d.id);
    s.enable(d.id);
    // 未绑定任何 Agent
    assert.strictEqual(s.isAvailable('agent-a', d.id), false);
    s.bind('agent-b', d.id);
    assert.strictEqual(s.isAvailable('agent-a', d.id), false, '绑定 B 不影响 A');
  }));

test('停用/解绑后即时失效', () =>
  withSkills((s) => {
    const d = s.createDraft({ name: 'y' });
    s.install(d.id);
    s.enable(d.id);
    s.bind('agent-a', d.id);
    assert.strictEqual(s.isAvailable('agent-a', d.id), true);
    s.disable(d.id);
    assert.strictEqual(s.isAvailable('agent-a', d.id), false);
    s.enable(d.id);
    s.unbind('agent-a', d.id);
    assert.strictEqual(s.isAvailable('agent-a', d.id), false);
  }));

test('版本记录与绑定列表', () =>
  withSkills((s) => {
    const d = s.createDraft({ name: 'z' });
    s.addVersion(d.id, '1.0.0', 'hash-1');
    s.addVersion(d.id, '1.1.0', 'hash-2');
    s.bind('agent-a', d.id, '1.1.0');
    const bindings = s.listBindings('agent-a');
    assert.strictEqual(bindings.length, 1);
    assert.strictEqual(bindings[0].version, '1.1.0');
  }));
