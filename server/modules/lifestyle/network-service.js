'use strict';

/**
 * NetworkService —— 人脉域（联系人/关系/图谱状态，README 6.2 补充）。
 * 对应前端 demo「人脉关系图谱」的联系人、关系与节点布局（坐标/固定）。
 */
const { Repository } = require('../core/repository');

const CONTACT_COLS = {
  name: 'name',
  title: 'title',
  category: 'category',
  company: 'company',
  position: 'position',
  location: 'location',
  relationshipStrength: 'relationship_strength',
  importance: 'importance',
  phone: 'phone',
  email: 'email',
  wechat: 'wechat',
  whatsapp: 'whatsapp',
  linkedin: 'linkedin',
  tags: 'tags',
  summary: 'summary',
  notes: 'notes',
  fixed: 'fixed',
};

const RELATIONSHIP_COLS = {
  sourceId: 'source_id',
  targetId: 'target_id',
  type: 'type',
  label: 'label',
  strength: 'strength',
  note: 'note',
};

const STATE_KEY = 'default';

function parseJSON(text, fallback) {
  if (text == null) return fallback;
  try {
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

function serializeContact(c) {
  if (!c) return c;
  return { ...c, tags: parseJSON(c.tags, []), fixed: !!c.fixed };
}

function contactChanges(changes) {
  const out = { ...changes };
  if (out.tags !== undefined) out.tags = JSON.stringify(out.tags || []);
  if (out.fixed !== undefined) out.fixed = out.fixed ? 1 : 0;
  return out;
}

class NetworkService {
  constructor(adapter) {
    this.adapter = adapter;
    this.contacts = new Repository(adapter, 'contacts', CONTACT_COLS);
    this.relationships = new Repository(adapter, 'relationships', RELATIONSHIP_COLS);
  }

  listContacts() {
    return this.contacts.list().map(serializeContact);
  }

  getContact(id) {
    return serializeContact(this.contacts.get(id));
  }

  createContact(fields) {
    return serializeContact(this.contacts.create(contactChanges(fields)));
  }

  updateContact(id, expectedRevision, changes) {
    return serializeContact(this.contacts.update(id, expectedRevision, contactChanges(changes)));
  }

  /** 图谱布局状态：{ positions, fixed }（JSON 文档）。 */
  getState() {
    const row = this.adapter.prepare('SELECT value FROM network_state WHERE key = ?').get(STATE_KEY);
    return parseJSON(row ? row.value : null, { positions: {}, fixed: {} });
  }

  setState(state) {
    const value = JSON.stringify(state || { positions: {}, fixed: {} });
    this.adapter
      .prepare(
        `INSERT INTO network_state (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(STATE_KEY, value, new Date().toISOString());
    return this.getState();
  }
}

module.exports = { NetworkService };
