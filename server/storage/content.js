'use strict';

/**
 * 内容文件写入协议与 file_outbox 发布（README 5.2）。
 *
 * - 正文先写 staging、fsync、再原子重命名为 content/<sha256>.md；不可变文件不覆盖。
 * - 数据库提交成功后，通过 file_outbox 排队生成面向阅读的 Markdown 投影；
 *   发布失败保持 pending，可重试，不重复提交业务操作。
 *
 * 注意：假定单一写入队列（README 4.2），同内容并发写入经 exists 复查避免覆盖。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const paths = require('../platform/paths');

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * 写入不可变正文文件（staging → 原子重命名）。
 * @param {string} vaultRoot
 * @param {string} text
 * @returns {{hash:string, path:string, created:boolean}}
 */
function writeContent(vaultRoot, text) {
  const contentDir = paths.contentDir(vaultRoot);
  const stagingDir = paths.stagingDir(vaultRoot);
  const hash = sha256(text);
  const target = path.join(contentDir, `${hash}.md`);
  if (fs.existsSync(target)) return { hash, path: target, created: false };

  fs.mkdirSync(contentDir, { recursive: true });
  fs.mkdirSync(stagingDir, { recursive: true });
  const tmp = path.join(stagingDir, `${hash}-${crypto.randomUUID()}.tmp`);
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, text, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  // 并发同内容复查：目标已存在则复用，不覆盖
  if (fs.existsSync(target)) {
    fs.rmSync(tmp, { force: true });
    return { hash, path: target, created: false };
  }
  fs.renameSync(tmp, target);
  return { hash, path: target, created: true };
}

/**
 * 入队一个文件投影任务。
 * @param {import('./adapter.js').StorageAdapter} adapter
 * @param {{kind:string, payload:object}} item
 * @returns {string} outbox id
 */
function enqueue(adapter, { kind, payload }) {
  const id = crypto.randomUUID();
  adapter
    .prepare(
      `INSERT INTO file_outbox (id, kind, payload, status, attempts, createdAt)
       VALUES (?, ?, ?, 'pending', 0, ?)`
    )
    .run(id, kind, JSON.stringify(payload), new Date().toISOString());
  return id;
}

function pendingItems(adapter) {
  return adapter
    .prepare("SELECT * FROM file_outbox WHERE status='pending' ORDER BY createdAt")
    .all();
}

/**
 * 处理 pending 投影项；单项失败不阻塞其余，保持 pending 可重试。
 * @param {import('./adapter.js').StorageAdapter} adapter
 * @param {(payload:object)=>void} projector 生成 Markdown 投影；抛错即视为发布失败
 * @returns {{published:number, failed:number}}
 */
function publishPending(adapter, projector) {
  const result = { published: 0, failed: 0 };
  for (const row of pendingItems(adapter)) {
    try {
      projector(JSON.parse(row.payload));
      adapter
        .prepare("UPDATE file_outbox SET status='published', publishedAt=?, error=NULL WHERE id=?")
        .run(new Date().toISOString(), row.id);
      result.published++;
    } catch (e) {
      adapter
        .prepare('UPDATE file_outbox SET attempts=attempts+1, error=? WHERE id=?')
        .run(String((e && e.message) || e).slice(0, 500), row.id);
      result.failed++;
    }
  }
  return result;
}

module.exports = { sha256, writeContent, enqueue, publishPending, pendingItems };
