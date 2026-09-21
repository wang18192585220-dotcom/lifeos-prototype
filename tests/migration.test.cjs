'use strict';

/**
 * test:migration —— 旧数据幂等迁移（S5 T50）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { CoreService } = require('../server/modules/core');
const { MigrationService } = require('../server/modules/migration');

function withMigration(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  const core = new CoreService(v.adapter);
  const m = new MigrationService(v.adapter, core);
  try {
    fn({ m, core });
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const BATCH = {
  sourceSystem: 'lifeos-localstorage',
  entities: {
    goals: [{ sourceId: 'g1', title: '学西语', status: '进行中', area: '学习' }],
    tasks: [
      { sourceId: 't1', title: '听力', status: '已完成', scheduledDate: '2027-03-10' },
      { sourceId: 't2', title: '词汇', status: '待办' },
      { sourceId: 't3', title: '未知状态任务', status: '古早状态' },
    ],
  },
};

test('预览：统计 + 未知状态进入报告', () =>
  withMigration(({ m }) => {
    const report = m.preview(BATCH);
    assert.strictEqual(report.goals, 1);
    assert.strictEqual(report.tasks, 3);
    assert.deepStrictEqual(report.unknownStatuses, ['古早状态']);
  }));

test('中文状态映射', () => {
  const { MigrationService, STATUS_MAP } = require('../server/modules/migration');
  assert.strictEqual(STATUS_MAP['已完成'], 'done');
  assert.strictEqual(STATUS_MAP['待办'], 'todo');
  assert.strictEqual(new MigrationService({}, {}).mapStatus('进行中'), 'in_progress');
  assert.strictEqual(new MigrationService({}, {}).mapStatus('未知'), null);
});

test('提交：导入业务，未知状态回退 todo，幂等去重', () =>
  withMigration(({ m, core }) => {
    const r1 = m.commit(BATCH);
    assert.strictEqual(r1.imported, true);
    assert.strictEqual(core.goals.list().length, 1);
    assert.strictEqual(core.tasks.list().length, 3);
    // 未知状态回退 todo
    const unknown = core.tasks.list().find((t) => t.title === '未知状态任务');
    assert.strictEqual(unknown.status, 'todo');
    // 已映射状态
    const done = core.tasks.list().find((t) => t.title === '听力');
    assert.strictEqual(done.status, 'done');

    // 再次导入同一批次 → 跳过，不复制
    const r2 = m.commit(BATCH);
    assert.strictEqual(r2.skipped, true);
    assert.strictEqual(core.tasks.list().length, 3);
  }));
