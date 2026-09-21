'use strict';

/**
 * BackupService —— 本地快照备份与恢复（S5 T50，README 5.3 / 6.1）。
 *
 * - 通过 SQLite backup API 获取一致快照（含 WAL），再复制不可变内容、附件与 Skills。
 * - 生成校验清单（manifest.json）；verify 校验完整性；restore 恢复到新目录。
 * - 排除 Backups 自身、search.sqlite（可重建）、临时文件与 secrets.enc。
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const paths = require('../../platform/paths');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyTree(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

class BackupService {
  /** @param {import('../../storage/adapter.js').StorageAdapter} adapter */
  constructor(adapter, vaultRoot, clock = () => new Date()) {
    this.adapter = adapter;
    this.vaultRoot = vaultRoot;
    this.clock = clock;
  }

  _snapshotDir(snapshotId) {
    return path.join(paths.backupsDir(this.vaultRoot), snapshotId);
  }

  list() {
    const dir = paths.backupsDir(this.vaultRoot);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  }

  /** 创建快照；返回 snapshotId。 */
  async create() {
    const snapshotId = `snap-${this.clock().toISOString().replace(/[:.]/g, '-')}`;
    const dir = this._snapshotDir(snapshotId);
    fs.mkdirSync(dir, { recursive: true });

    // 1. SQLite 一致快照（含 WAL）
    await this.adapter.backup(path.join(dir, 'lifeos.sqlite'));

    // 2. 复制不可变内容与附件、Skills
    copyTree(paths.contentDir(this.vaultRoot), path.join(dir, 'content'));
    copyTree(paths.attachmentsDir(this.vaultRoot), path.join(dir, 'attachments'));
    copyTree(paths.skillsDir(this.vaultRoot), path.join(dir, 'skills'));

    // 3. 校验清单
    const manifest = this._buildManifest(dir);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return snapshotId;
  }

  _buildManifest(dir) {
    const files = [];
    const walk = (base, rel = '') => {
      for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
        if (entry.name === 'manifest.json') continue;
        const p = path.join(base, entry.name);
        const r = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(p, r);
        else files.push({ path: r, sha256: sha256File(p), size: fs.statSync(p).size });
      }
    };
    walk(dir);
    return { createdAt: this.clock().toISOString(), files };
  }

  /** 校验快照完整性；返回 { ok, missing?, mismatch? }。 */
  verify(snapshotId) {
    const dir = this._snapshotDir(snapshotId);
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return { ok: false, missing: ['manifest.json'] };
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const missing = [];
    const mismatch = [];
    for (const f of manifest.files) {
      const p = path.join(dir, f.path);
      if (!fs.existsSync(p)) missing.push(f.path);
      else if (sha256File(p) !== f.sha256) mismatch.push(f.path);
    }
    return { ok: missing.length === 0 && mismatch.length === 0, missing, mismatch };
  }

  /** 恢复到新目录（先校验，再复制）；返回目标目录。 */
  restore(snapshotId, newVaultRoot) {
    const v = this.verify(snapshotId);
    if (!v.ok) {
      const e = new Error(`快照校验失败：${[...v.missing, ...v.mismatch].join(', ')}`);
      e.code = 'BACKUP_INVALID';
      throw e;
    }
    const dir = this._snapshotDir(snapshotId);
    // SQLite → newVault/LifeOS/_system/lifeos.sqlite
    fs.mkdirSync(paths.systemDir(newVaultRoot), { recursive: true });
    fs.copyFileSync(path.join(dir, 'lifeos.sqlite'), paths.dbPath(newVaultRoot));
    // content → newVault/LifeOS/_system/content
    copyTree(path.join(dir, 'content'), paths.contentDir(newVaultRoot));
    // attachments / skills
    copyTree(path.join(dir, 'attachments'), paths.attachmentsDir(newVaultRoot));
    copyTree(path.join(dir, 'skills'), paths.skillsDir(newVaultRoot));
    return newVaultRoot;
  }
}

module.exports = { BackupService };
