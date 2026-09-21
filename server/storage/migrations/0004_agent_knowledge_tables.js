'use strict';

/**
 * 0004 —— AI 与资料相关表（README 6.2）：角色、模型配置、资料库/文档、授权、
 * 会话/消息、运行、提案。
 * 注：proposal actions 以 JSON 数组存于 proposals.actions（见 7.3 契约）。
 */
module.exports = {
  version: 4,
  name: 'agent_knowledge_tables',
  up(adapter) {
    adapter.exec(`
      CREATE TABLE agents (
        id              TEXT PRIMARY KEY,
        revision        INTEGER NOT NULL DEFAULT 1,
        name            TEXT NOT NULL,
        role_prompt     TEXT NOT NULL DEFAULT '',
        model_profile_id TEXT,
        enabled         INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT
      );

      CREATE TABLE model_profiles (
        id             TEXT PRIMARY KEY,
        revision       INTEGER NOT NULL DEFAULT 1,
        provider_type  TEXT NOT NULL DEFAULT 'openai_compatible',
        base_url       TEXT NOT NULL,
        model          TEXT NOT NULL,
        capabilities   TEXT NOT NULL DEFAULT '{}',
        temperature    REAL NOT NULL DEFAULT 0,
        credential_ref TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        deleted_at     TEXT
      );

      CREATE TABLE libraries (
        id         TEXT PRIMARY KEY,
        revision   INTEGER NOT NULL DEFAULT 1,
        title      TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE documents (
        id             TEXT PRIMARY KEY,
        revision       INTEGER NOT NULL DEFAULT 1,
        library_id     TEXT NOT NULL,
        title          TEXT NOT NULL,
        original_ref   TEXT,
        content_ref    TEXT,
        hash           TEXT,
        status         TEXT NOT NULL DEFAULT 'uploaded',
        source         TEXT,
        parser_version TEXT,
        error_reason   TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        deleted_at     TEXT,
        FOREIGN KEY (library_id) REFERENCES libraries(id)
      );

      CREATE TABLE agent_library_grants (
        agent_id   TEXT NOT NULL,
        library_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (agent_id, library_id)
      );

      CREATE TABLE agent_document_grants (
        agent_id    TEXT NOT NULL,
        document_id TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        PRIMARY KEY (agent_id, document_id)
      );

      CREATE TABLE sessions (
        id         TEXT PRIMARY KEY,
        revision   INTEGER NOT NULL DEFAULT 1,
        agent_id   TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE messages (
        id         TEXT PRIMARY KEY,
        revision   INTEGER NOT NULL DEFAULT 1,
        session_id TEXT NOT NULL,
        role       TEXT NOT NULL,
        content    TEXT NOT NULL DEFAULT '',
        seq        INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE agent_runs (
        id         TEXT PRIMARY KEY,
        revision   INTEGER NOT NULL DEFAULT 1,
        session_id TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'running',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE tool_runs (
        id         TEXT PRIMARY KEY,
        revision   INTEGER NOT NULL DEFAULT 1,
        run_id     TEXT NOT NULL,
        name       TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'pending',
        input      TEXT,
        output     TEXT,
        error      TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE proposals (
        id             TEXT PRIMARY KEY,
        revision       INTEGER NOT NULL DEFAULT 1,
        session_id     TEXT NOT NULL,
        agent_id       TEXT NOT NULL,
        summary        TEXT NOT NULL DEFAULT '',
        actions        TEXT NOT NULL DEFAULT '[]',
        base_revisions TEXT NOT NULL DEFAULT '{}',
        status         TEXT NOT NULL DEFAULT 'pending',
        expires_at     TEXT,
        payload_hash   TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        deleted_at     TEXT
      );

      CREATE INDEX idx_messages_session ON messages(session_id, seq);
      CREATE INDEX idx_documents_library ON documents(library_id);
      CREATE INDEX idx_proposals_status ON proposals(status);
      CREATE INDEX idx_sessions_agent ON sessions(agent_id);
    `);
  },
};
