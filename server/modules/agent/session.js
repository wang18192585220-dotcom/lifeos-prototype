'use strict';

/**
 * SessionService —— 会话与消息（S3 T30）。
 */
const { Repository } = require('../core/repository');

class SessionService {
  constructor(adapter) {
    this.adapter = adapter;
    this.sessions = new Repository(adapter, 'sessions', { agentId: 'agent_id' });
    this.messages = new Repository(adapter, 'messages', {
      sessionId: 'session_id',
      role: 'role',
      content: 'content',
      seq: 'seq',
    });
  }

  createSession(agentId) {
    return this.sessions.create({ agentId });
  }

  getSession(id) {
    return this.sessions.get(id);
  }

  /** 追加消息，seq 单调递增（同会话内有序）。 */
  addMessage(sessionId, { role, content }) {
    const seq = this.nextSeq(sessionId);
    return this.messages.create({ sessionId, role, content, seq });
  }

  nextSeq(sessionId) {
    const row = this.adapter
      .prepare('SELECT MAX(seq) AS m FROM messages WHERE session_id = ? AND deleted_at IS NULL')
      .get(sessionId);
    return (row && row.m ? row.m : 0) + 1;
  }

  listMessages(sessionId) {
    return this.messages.list({ sessionId }).sort((a, b) => a.seq - b.seq);
  }
}

module.exports = { SessionService };
