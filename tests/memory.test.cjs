'use strict';

/**
 * test:memory —— 长期记忆（S4 T41）：去重、来源依赖、撤权/删除失效。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { MemoryService } = require('../server/modules/memory');

function withMemory(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  const m = new MemoryService(v.adapter);
  try {
    fn(m);
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('保存记忆并带来源', () =>
  withMemory((m) => {
    const mem = m.saveMemory({
      kind: 'summary',
      contentRef: 'c1',
      factStatus: 'inferred',
      agentId: 'agent-a',
      sources: [{ sourceId: 'doc-1', sourceType: 'document' }],
    });
    const srcs = m.listSources(mem.id);
    assert.strictEqual(srcs.length, 1);
    assert.strictEqual(srcs[0].source_id, 'doc-1');
  }));

test('去重：同 dedupKey 不重复创建（含已删除）', () =>
  withMemory((m) => {
    const a = m.saveMemory({ kind: 'summary', agentId: 'x', dedupKey: 'k1' });
    const b = m.saveMemory({ kind: 'summary', agentId: 'x', dedupKey: 'k1' });
    assert.strictEqual(a.id, b.id);
    assert.strictEqual(m.listValid('x').length, 1);

    // 删除后同 dedupKey 不复活
    m.deleteMemory(a.id, '用户删除');
    const c = m.saveMemory({ kind: 'summary', agentId: 'x', dedupKey: 'k1' });
    assert.strictEqual(c.id, a.id);
    assert.strictEqual(m.listValid('x').length, 0, '删除后不得复活');
  }));

test('撤销来源：依赖该来源的记忆失效', () =>
  withMemory((m) => {
    m.saveMemory({
      kind: 'summary',
      agentId: 'agent-a',
      contentRef: 'c1',
      sources: [{ sourceId: 'doc-1', sourceType: 'document' }],
    });
    assert.strictEqual(m.listValid('agent-a').length, 1);
    m.invalidateBySource('doc-1', '来源已删除');
    assert.strictEqual(m.listValid('agent-a').length, 0, '来源撤销后记忆失效');
  }));

test('用户删除：软删除并从有效列表移除', () =>
  withMemory((m) => {
    const mem = m.saveMemory({ kind: 'summary', agentId: 'x' });
    m.deleteMemory(mem.id, '用户删除');
    assert.deepStrictEqual(m.listValid('x'), []);
    assert.strictEqual(m.memories.get(mem.id), null);
  }));
