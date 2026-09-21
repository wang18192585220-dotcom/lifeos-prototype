'use strict';

/**
 * test:content —— 内容写入协议与 file_outbox 发布（S1「文件发布失败可修复」）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { writeContent, enqueue, publishPending } = require('../server/storage/content');
const paths = require('../server/platform/paths');

function tmpVault() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
}

test('内容写入：同内容不可变，不覆盖', () => {
  const dir = tmpVault();
  const v = openVault(dir);
  try {
    const a = writeContent(dir, 'hola');
    const b = writeContent(dir, 'hola');
    assert.strictEqual(a.hash, b.hash, '同内容 hash 一致');
    assert.strictEqual(b.created, false, '已存在则复用不覆盖');
    const read = fs.readFileSync(path.join(paths.contentDir(dir), `${a.hash}.md`), 'utf8');
    assert.strictEqual(read, 'hola');
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('outbox：发布成功后标记 published', () => {
  const dir = tmpVault();
  const v = openVault(dir);
  try {
    const id = enqueue(v.adapter, { kind: 'note', payload: { title: 't', body: 'b' } });
    const written = [];
    publishPending(v.adapter, (payload) => written.push(payload.title));
    assert.deepStrictEqual(written, ['t']);
    const row = v.adapter.prepare('SELECT status FROM file_outbox WHERE id=?').get(id);
    assert.strictEqual(row.status, 'published');
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('outbox：发布失败保持 pending，可重试', () => {
  const dir = tmpVault();
  const v = openVault(dir);
  try {
    const id = enqueue(v.adapter, { kind: 'note', payload: { title: 'x' } });
    let fail = true;
    publishPending(v.adapter, () => {
      if (fail) throw new Error('disk full');
    });
    let row = v.adapter.prepare('SELECT status, attempts, error FROM file_outbox WHERE id=?').get(id);
    assert.strictEqual(row.status, 'pending', '失败后保持 pending');
    assert.strictEqual(row.attempts, 1, '记录失败次数');
    assert.ok(row.error.includes('disk full'), '记录失败原因');

    fail = false;
    publishPending(v.adapter, () => {});
    row = v.adapter.prepare('SELECT status FROM file_outbox WHERE id=?').get(id);
    assert.strictEqual(row.status, 'published', '重试后成功');
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('outbox：单项失败不阻塞其它项', () => {
  const dir = tmpVault();
  const v = openVault(dir);
  try {
    const id1 = enqueue(v.adapter, { kind: 'note', payload: { title: 'good' } });
    const id2 = enqueue(v.adapter, { kind: 'note', payload: { title: 'bad' } });
    publishPending(v.adapter, (payload) => {
      if (payload.title === 'bad') throw new Error('boom');
    });
    const r1 = v.adapter.prepare('SELECT status FROM file_outbox WHERE id=?').get(id1);
    const r2 = v.adapter.prepare('SELECT status FROM file_outbox WHERE id=?').get(id2);
    assert.strictEqual(r1.status, 'published');
    assert.strictEqual(r2.status, 'pending');
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
