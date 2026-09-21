'use strict';

/**
 * test:knowledge —— 资料导入 / 切片 / FTS5 检索 / 授权（S3 T31）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { KnowledgeService } = require('../server/modules/knowledge');
const { chunkText, bigramCJK } = require('../server/modules/knowledge/chunk');

function withKnowledge(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  const k = new KnowledgeService(v.adapter, dir);
  try {
    fn(k);
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('切片：按大小与重叠切分', () => {
  const text = 'a'.repeat(2500);
  const chunks = chunkText(text, { size: 1000, overlap: 150 });
  assert.ok(chunks.length >= 3);
  assert.strictEqual(chunks[0].length, 1000);
  // 重叠：第二段开头与前一段末尾重叠
  assert.strictEqual(chunks[1].slice(0, 150), chunks[0].slice(850));
});

test('中文 bigram 展开', () => {
  assert.strictEqual(bigramCJK('你好世界'), '你好 好世 世界');
  assert.strictEqual(bigramCJK('学'), '学');
});

test('导入后可按西班牙语（重音不敏感）检索', () =>
  withKnowledge((k) => {
    const lib = k.createLibrary('西语');
    k.grantLibrary('agent-a', lib.id);
    k.importDocument(lib.id, { title: '教材', text: 'Hola, estoy aprendiendo español para el examen.' });
    const hits = k.search('agent-a', 'espanol');
    assert.ok(hits.length >= 1);
    assert.strictEqual(hits[0].documentTitle, '教材');
  }));

test('导入后可按中文检索', () =>
  withKnowledge((k) => {
    const lib = k.createLibrary('中文');
    k.grantLibrary('agent-a', lib.id);
    k.importDocument(lib.id, { title: '笔记', text: '西班牙语动词变位需要反复练习。' });
    const hits = k.search('agent-a', '动词变位');
    assert.ok(hits.length >= 1);
  }));

test('授权隔离：未授权 Agent 检索不到，撤权后立即失效', () =>
  withKnowledge((k) => {
    const lib = k.createLibrary('私密');
    k.grantLibrary('agent-a', lib.id);
    k.importDocument(lib.id, { title: '秘密', text: '这是一段只有 agent-a 能看的内容。' });

    // agent-b 未授权 → 空
    assert.deepStrictEqual(k.search('agent-b', '内容'), []);

    // 撤权后 agent-a 也检索不到
    k.revokeLibrary('agent-a', lib.id);
    assert.deepStrictEqual(k.search('agent-a', '内容'), []);
  }));

test('单篇授权：只授权某篇文档', () =>
  withKnowledge((k) => {
    const lib = k.createLibrary('库');
    const d1 = k.importDocument(lib.id, { title: 'A', text: '文档A的独特内容甲' });
    k.importDocument(lib.id, { title: 'B', text: '文档B的独特内容乙' });

    k.grantDocument('agent-x', d1.id);
    const hits = k.search('agent-x', '内容甲');
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].documentTitle, 'A');
    // 未授权的 B 检索不到
    assert.deepStrictEqual(k.search('agent-x', '内容乙'), []);
  }));

test('空内容导入抛 VALIDATION', () =>
  withKnowledge((k) => {
    const lib = k.createLibrary('库');
    assert.throws(() => k.importDocument(lib.id, { title: '空', text: '   ' }), (e) => e.code === 'VALIDATION');
  }));
