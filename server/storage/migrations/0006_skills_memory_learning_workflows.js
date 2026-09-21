'use strict';

/**
 * 0006 —— S4 表：Skills、记忆、能力评估、学习档案/记录、工作流、作业与通知（README 6.2）。
 */
module.exports = {
  version: 6,
  name: 'skills_memory_learning_workflows',
  up(adapter) {
    adapter.exec(`
      CREATE TABLE skills (
        id             TEXT PRIMARY KEY,
        revision       INTEGER NOT NULL DEFAULT 1,
        name           TEXT NOT NULL,
        description    TEXT NOT NULL DEFAULT '',
        manifest       TEXT NOT NULL DEFAULT '{}',
        content_hash   TEXT,
        source         TEXT,
        install_status TEXT NOT NULL DEFAULT 'draft',
        enabled        INTEGER NOT NULL DEFAULT 0,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        deleted_at     TEXT
      );

      CREATE TABLE skill_versions (
        id           TEXT PRIMARY KEY,
        revision     INTEGER NOT NULL DEFAULT 1,
        skill_id     TEXT NOT NULL,
        version      TEXT NOT NULL,
        content_hash TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        deleted_at   TEXT,
        FOREIGN KEY (skill_id) REFERENCES skills(id)
      );

      CREATE TABLE agent_skill_bindings (
        agent_id   TEXT NOT NULL,
        skill_id   TEXT NOT NULL,
        version    TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (agent_id, skill_id)
      );

      CREATE TABLE memories (
        id             TEXT PRIMARY KEY,
        revision       INTEGER NOT NULL DEFAULT 1,
        kind           TEXT NOT NULL,
        content_ref    TEXT,
        fact_status    TEXT NOT NULL DEFAULT 'inferred',
        agent_id       TEXT NOT NULL,
        source_version TEXT,
        derived_scope  TEXT,
        invalid_reason TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        deleted_at     TEXT
      );

      CREATE TABLE memory_sources (
        memory_id   TEXT NOT NULL,
        source_id   TEXT NOT NULL,
        source_type TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        PRIMARY KEY (memory_id, source_id)
      );

      CREATE TABLE assessments (
        id           TEXT PRIMARY KEY,
        revision     INTEGER NOT NULL DEFAULT 1,
        capability   TEXT NOT NULL,
        judgment     TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'pending',
        evidence     TEXT,
        confirmed_by TEXT,
        confirmed_at TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        deleted_at   TEXT
      );

      CREATE TABLE learning_profiles (
        id               TEXT PRIMARY KEY,
        revision         INTEGER NOT NULL DEFAULT 1,
        language         TEXT NOT NULL,
        purpose          TEXT NOT NULL DEFAULT 'exam_preparation',
        target_level_min TEXT,
        target_level_max TEXT,
        target_months    INTEGER,
        current_level    TEXT,
        exam_type        TEXT,
        weekly_minutes   INTEGER,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL,
        deleted_at       TEXT
      );

      CREATE TABLE learning_records (
        id              TEXT PRIMARY KEY,
        revision        INTEGER NOT NULL DEFAULT 1,
        profile_id      TEXT NOT NULL,
        task_id         TEXT,
        started_at      TEXT,
        ended_at        TEXT,
        duration_source TEXT,
        result          TEXT,
        user_feedback   TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT,
        FOREIGN KEY (profile_id) REFERENCES learning_profiles(id)
      );

      CREATE TABLE evidence (
        id          TEXT PRIMARY KEY,
        revision    INTEGER NOT NULL DEFAULT 1,
        record_id   TEXT NOT NULL,
        kind        TEXT,
        content_ref TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT
      );

      CREATE TABLE workflows (
        id         TEXT PRIMARY KEY,
        revision   INTEGER NOT NULL DEFAULT 1,
        trigger    TEXT NOT NULL DEFAULT '{}',
        timezone   TEXT NOT NULL DEFAULT 'Asia/Shanghai',
        action     TEXT NOT NULL DEFAULT '{}',
        enabled    INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE workflow_runs (
        id              TEXT PRIMARY KEY,
        revision        INTEGER NOT NULL DEFAULT 1,
        workflow_id     TEXT NOT NULL,
        scheduled_for   TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'scheduled',
        idempotency_key TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT
      );

      CREATE TABLE jobs (
        id             TEXT PRIMARY KEY,
        revision       INTEGER NOT NULL DEFAULT 1,
        kind           TEXT NOT NULL,
        status         TEXT NOT NULL DEFAULT 'pending',
        progress       REAL,
        failure_reason TEXT,
        retryable      INTEGER NOT NULL DEFAULT 1,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        deleted_at     TEXT
      );

      CREATE TABLE notifications (
        id         TEXT PRIMARY KEY,
        revision   INTEGER NOT NULL DEFAULT 1,
        kind       TEXT NOT NULL,
        read       INTEGER NOT NULL DEFAULT 0,
        target     TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE INDEX idx_memories_agent ON memories(agent_id);
      CREATE INDEX idx_workflow_runs_scheduled ON workflow_runs(scheduled_for);
      CREATE INDEX idx_learning_records_profile ON learning_records(profile_id);
    `);
  },
};
