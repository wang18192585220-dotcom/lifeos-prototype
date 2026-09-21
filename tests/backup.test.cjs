'use strict';

/**
 * test:backup —— 快照备份 / 校验 / 恢复（S5 T50）。
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openVault } = require('../server/storage/vault');
const { CoreService } = require('../server/modules/core');
const { BackupService } = require('../server/modules/backup');
const { writeContent } = require('../server/storage/content');

test('备份 → 校验 → 恢复到新目录，数据完整', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  const core = new CoreService(v.adapter);
  const backup = new BackupService(v.adapter, dir);
  try {
    // 写入业务数据 + 内容文件
    core.createTask({ title: '听力练习', scheduledDate: '2027-03-10' });
    writeContent(dir, 'La práctica es importante.');

    const id = await backup.create();
    assert.strictEqual(backup.list().length, 1);
    assert.strictEqual(backup.verify(id).ok, true);

    // 恢复到新目录
    const restored = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-restored-'));
    backup.restore(id, restored);

    // 打开恢复的库，数据仍在
    const v2 = openVault(restored);
    const core2 = new CoreService(v2.adapter);
    try {
      assert.strictEqual(core2.tasks.list().length, 1);
      assert.strictEqual(core2.tasks.list()[0].title, '听力练习');
    } finally {
      v2.close();
    }
    fs.rmSync(restored, { recursive: true, force: true });
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('校验：篡改文件后 verify 报 mismatch', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeos-test-'));
  const v = openVault(dir);
  const backup = new BackupService(v.adapter, dir);
  try {
    writeContent(dir, 'content');
    const id = await backup.create();
    assert.strictEqual(backup.verify(id).ok, true);

    // 篡改快照里的 content 文件
    const contentDir = path.join(dir, 'LifeOS', 'Backups', id, 'content');
    const file = fs.readdirSync(contentDir)[0];
    fs.writeFileSync(path.join(contentDir, file), 'tampered');

    const res = backup.verify(id);
    assert.strictEqual(res.ok, false);
    assert.ok(res.mismatch.length >= 1);
  } finally {
    v.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
