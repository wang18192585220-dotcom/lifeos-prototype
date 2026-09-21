'use strict';

/**
 * SkillService —— Skills 安装/版本/绑定（S4 T40，README 9）。
 *
 * - 包至少含 name/description（manifest）；平台权限由 LifeOS 决定，不把包声明当授权。
 * - 真实工具被调用时需满足：已安装、已启用、已绑定当前 Agent（宿主检查）。
 */
const { Repository } = require('../core/repository');

function isoNow() {
  return new Date().toISOString();
}

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

const SKILL_COLS = {
  name: 'name',
  description: 'description',
  manifest: 'manifest',
  contentHash: 'content_hash',
  source: 'source',
  installStatus: 'install_status',
  enabled: 'enabled',
};

class SkillService {
  constructor(adapter) {
    this.adapter = adapter;
    this.skills = new Repository(adapter, 'skills', SKILL_COLS);
    this.versions = new Repository(adapter, 'skill_versions', {
      skillId: 'skill_id',
      version: 'version',
      contentHash: 'content_hash',
    });
  }

  _hydrate(s) {
    if (!s) return null;
    let manifest = {};
    try {
      manifest = s.manifest ? JSON.parse(s.manifest) : {};
    } catch (_) {}
    return { ...s, manifest, enabled: !!s.enabled };
  }

  list() {
    return this.skills.list().map((s) => this._hydrate(s));
  }

  get(id) {
    return this._hydrate(this.skills.get(id));
  }

  /** 聊天制作草稿：draft 状态，安装后才可启用。 */
  createDraft({ name, description = '', manifest = {}, source = null }) {
    if (!name) throw err('VALIDATION', 'name 必填');
    return this._hydrate(
      this.skills.create({
        name,
        description,
        manifest: JSON.stringify(manifest),
        source,
        installStatus: 'draft',
        enabled: 0,
      })
    );
  }

  install(id) {
    const s = this.skills.get(id);
    if (!s) throw err('NOT_FOUND', 'Skill 不存在');
    return this._hydrate(this.skills.update(id, s.revision, { installStatus: 'installed' }));
  }

  enable(id) {
    const s = this.skills.get(id);
    if (!s) throw err('NOT_FOUND', 'Skill 不存在');
    return this._hydrate(this.skills.update(id, s.revision, { enabled: 1 }));
  }

  disable(id) {
    const s = this.skills.get(id);
    if (!s) throw err('NOT_FOUND', 'Skill 不存在');
    return this._hydrate(this.skills.update(id, s.revision, { enabled: 0 }));
  }

  addVersion(skillId, version, contentHash) {
    return this.versions.create({ skillId, version, contentHash });
  }

  bind(agentId, skillId, version = null) {
    this.adapter
      .prepare('INSERT OR REPLACE INTO agent_skill_bindings (agent_id, skill_id, version, created_at) VALUES (?, ?, ?, ?)')
      .run(agentId, skillId, version, isoNow());
  }

  unbind(agentId, skillId) {
    this.adapter
      .prepare('DELETE FROM agent_skill_bindings WHERE agent_id = ? AND skill_id = ?')
      .run(agentId, skillId);
  }

  listBindings(agentId) {
    return this.adapter.prepare('SELECT * FROM agent_skill_bindings WHERE agent_id = ?').all(agentId);
  }

  /** 宿主检查：已安装、已启用、已绑定当前 Agent。 */
  isAvailable(agentId, skillId) {
    const s = this.skills.get(skillId);
    if (!s || s.installStatus !== 'installed' || !s.enabled) return false;
    const b = this.adapter
      .prepare('SELECT 1 AS x FROM agent_skill_bindings WHERE agent_id = ? AND skill_id = ?')
      .get(agentId, skillId);
    return !!b;
  }
}

module.exports = { SkillService };
