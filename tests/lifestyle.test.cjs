'use strict';

/**
 * test:lifestyle —— 生活域（财富/人脉/健康）：CRUD、转账余额联动、JSON 字段序列化、图谱状态。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { FinanceService, NetworkService, HealthService } = require('../server/modules/lifestyle');

function withVault(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  try {
    fn(v);
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('财富：账户 CRUD 与资产/负债合计', () =>
  withVault((v) => {
    const f = new FinanceService(v.adapter);
    const cash = f.accounts.create({ name: '现金', classification: 'asset', type: 'cash', currency: 'CNY', currentBalance: 1000 });
    const card = f.accounts.create({ name: '信用卡', classification: 'liability', type: 'credit_card', currency: 'CNY', currentBalance: 300 });
    assert.strictEqual(cash.currentBalance, 1000);
    assert.deepStrictEqual(f.totals(), { assets: 1000, liabilities: 300, net: 700 });
    assert.strictEqual(f.accounts.list().length, 2);
  }));

test('财富：收入/支出/转账联动余额', () =>
  withVault((v) => {
    const f = new FinanceService(v.adapter);
    const a = f.accounts.create({ name: 'A', classification: 'asset', type: 'cash', currency: 'CNY', currentBalance: 500 });
    const b = f.accounts.create({ name: 'B', classification: 'asset', type: 'cash', currency: 'CNY', currentBalance: 100 });

    f.createTransaction({ accountId: a.id, type: 'income', amount: 200, category: '工资', merchant: '公司' });
    assert.strictEqual(f.accounts.get(a.id).currentBalance, 700);

    f.createTransaction({ accountId: a.id, type: 'expense', amount: 50, category: '餐饮', merchant: '餐厅' });
    assert.strictEqual(f.accounts.get(a.id).currentBalance, 650);

    f.createTransaction({ accountId: a.id, transferAccountId: b.id, type: 'transfer', amount: 100 });
    assert.strictEqual(f.accounts.get(a.id).currentBalance, 550);
    assert.strictEqual(f.accounts.get(b.id).currentBalance, 200);
  }));

test('人脉：联系人 tags 序列化与关系', () =>
  withVault((v) => {
    const n = new NetworkService(v.adapter);
    const c = n.createContact({ name: 'Alex', category: '事业人脉', tags: ['增长', '营销'], relationshipStrength: 80, importance: 4 });
    assert.deepStrictEqual(c.tags, ['增长', '营销']);
    assert.strictEqual(c.fixed, false);

    const c2 = n.createContact({ name: 'Beta', category: '朋友' });
    const rel = n.relationships.create({ sourceId: 'user', targetId: c2.id, type: '朋友', strength: 70 });
    assert.strictEqual(rel.strength, 70);
    assert.strictEqual(n.relationships.list().length, 1);
  }));

test('人脉：图谱状态 JSON 文档读写', () =>
  withVault((v) => {
    const n = new NetworkService(v.adapter);
    assert.deepStrictEqual(n.getState(), { positions: {}, fixed: {} });
    const state = n.setState({ positions: { c1: { x: 10, y: 20 } }, fixed: { c1: true } });
    assert.deepStrictEqual(state.positions.c1, { x: 10, y: 20 });
    assert.strictEqual(state.fixed.c1, true);
  }));

test('健康：记录 payload 序列化与分节查询', () =>
  withVault((v) => {
    const h = new HealthService(v.adapter);
    const rec = h.create({ section: 'sleep', payload: { hours: 7.5, quality: 'good' }, recordedAt: '2026-09-11T08:00' });
    assert.deepStrictEqual(rec.payload, { hours: 7.5, quality: 'good' });
    assert.strictEqual(h.list('sleep').length, 1);
    assert.strictEqual(h.list('nutrition').length, 0);

    const updated = h.update(rec.id, rec.revision, { payload: { hours: 8, quality: 'great' } });
    assert.deepStrictEqual(updated.payload, { hours: 8, quality: 'great' });
  }));
