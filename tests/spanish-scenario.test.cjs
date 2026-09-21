'use strict';

/**
 * test:spanish-scenario —— 完整西班牙语备考场景（S4 T45 验收）。
 * 串联：内置 Skills 种子 → 角色+绑定 → 学习档案 → 资料导入+授权 →
 * AI 提案确认生成任务 → 学习记录 → 能力评估 pending → 撤权无泄漏。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { VaultService } = require('../server/storage/vault-service');

function tmpVault() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
}

test('完整西语场景端到端', () => {
  const dir = tmpVault();
  const svc = new VaultService();
  svc.open(dir);
  try {
    const s = svc.services;

    // 1. 内置 Skills 已种子
    const builtins = s.skills.list().filter((x) => x.source === 'builtin');
    assert.ok(builtins.length >= 4, '内置 Skills 已种子');

    // 2. 建角色「西语老师」并绑定教学 Skills
    const agent = s.agents.create({ name: '西语老师', rolePrompt: '你是西班牙语备考老师', enabled: 1 });
    for (const sk of builtins.filter((x) => x.name !== 'memory-summary')) {
      s.skills.install(sk.id);
      s.skills.enable(sk.id);
      s.skills.bind(agent.id, sk.id, '1.0');
    }
    assert.ok(
      s.skills.isAvailable(agent.id, builtins.find((x) => x.name === 'planning-interview').id),
      '绑定后 Skill 可用'
    );

    // 3. 学习档案
    const profile = s.learning.createProfile({
      language: 'es',
      purpose: 'exam_preparation',
      targetLevelMin: 'B1',
      targetLevelMax: 'B2',
      targetMonths: 12,
    });
    assert.strictEqual(profile.targetLevelMax, 'B2');

    // 4. 资料导入 + 授权
    const lib = s.knowledge.createLibrary('西语教材');
    s.knowledge.grantLibrary(agent.id, lib.id);
    s.knowledge.importDocument(lib.id, { title: '教材', text: 'La conjugación de verbos requiere práctica constante.' });
    assert.ok(s.knowledge.search(agent.id, 'conjugacion').length >= 1, '授权后可检索');

    // 5. AI 提案 → 确认生成任务
    const prop = s.proposals.create({
      sessionId: 's1',
      agentId: agent.id,
      summary: '本周听力+词汇练习计划',
      actions: [
        { operation: 'task.create', changes: { title: '听指定音频前 2 分钟', scheduledDate: '2027-03-10' } },
        { operation: 'task.create', changes: { title: '动词变位练习', scheduledDate: '2027-03-11' } },
      ],
    });
    s.proposals.confirm(prop.id, prop.payloadHash);
    assert.strictEqual(s.core.tasks.list().length, 2, '确认后生成 2 个任务');

    // 6. 学习记录
    const rec = s.learning.addRecord(profile.id, {
      startedAt: '2027-03-10T09:00:00Z',
      endedAt: '2027-03-10T09:25:00Z',
      result: '听写 8/10',
    });
    assert.strictEqual(rec.durationMinutes, 25);

    // 7. 能力评估 → pending（不自动当事实）
    const a = s.learning.proposeAssessment({ capability: '听力', judgment: '接近 B1 听力', evidence: '8/10' });
    assert.strictEqual(a.status, 'pending', '能力判断待确认');

    // 8. 撤权无泄漏
    s.knowledge.revokeLibrary(agent.id, lib.id);
    assert.deepStrictEqual(s.knowledge.search(agent.id, 'conjugacion'), [], '撤权后检索不到');
  } finally {
    svc.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
