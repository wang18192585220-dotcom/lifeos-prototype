'use strict';

/**
 * 0003 —— 核心业务表（README 6.2）：目标/项目/阶段/里程碑/计划/任务。
 * 所有可修改实体含 UUID、revision、created_at、updated_at、deleted_at。
 * 外键开启；金额等其他领域暂不建表。
 */
module.exports = {
  version: 3,
  name: 'core_tables',
  up(adapter) {
    adapter.exec(`
      CREATE TABLE goals (
        id              TEXT PRIMARY KEY,
        revision        INTEGER NOT NULL DEFAULT 1,
        title           TEXT NOT NULL,
        description     TEXT NOT NULL DEFAULT '',
        area            TEXT NOT NULL,
        target_date     TEXT,
        status          TEXT NOT NULL DEFAULT 'active',
        progress_mode   TEXT NOT NULL DEFAULT 'manual',
        manual_progress INTEGER,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT
      );

      CREATE TABLE projects (
        id          TEXT PRIMARY KEY,
        revision    INTEGER NOT NULL DEFAULT 1,
        title       TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        area        TEXT NOT NULL,
        goal_id     TEXT,
        status      TEXT NOT NULL DEFAULT 'active',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT,
        FOREIGN KEY (goal_id) REFERENCES goals(id)
      );

      CREATE TABLE stages (
        id          TEXT PRIMARY KEY,
        revision    INTEGER NOT NULL DEFAULT 1,
        project_id  TEXT NOT NULL,
        ord         INTEGER NOT NULL,
        title       TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        target_date TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE milestones (
        id           TEXT PRIMARY KEY,
        revision     INTEGER NOT NULL DEFAULT 1,
        project_id   TEXT NOT NULL,
        ord          INTEGER NOT NULL,
        title        TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        target_date  TEXT,
        completed_at TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        deleted_at   TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE plans (
        id                 TEXT PRIMARY KEY,
        revision           INTEGER NOT NULL DEFAULT 1,
        project_id         TEXT NOT NULL,
        current_version_id TEXT,
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL,
        deleted_at         TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE plan_versions (
        id          TEXT PRIMARY KEY,
        revision    INTEGER NOT NULL DEFAULT 1,
        plan_id     TEXT NOT NULL,
        constraints TEXT NOT NULL DEFAULT '{}',
        stages      TEXT NOT NULL DEFAULT '[]',
        source      TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT,
        FOREIGN KEY (plan_id) REFERENCES plans(id)
      );

      CREATE TABLE tasks (
        id                TEXT PRIMARY KEY,
        revision          INTEGER NOT NULL DEFAULT 1,
        project_id        TEXT,
        milestone_id      TEXT,
        title             TEXT NOT NULL,
        description       TEXT NOT NULL DEFAULT '',
        status            TEXT NOT NULL DEFAULT 'todo',
        priority          TEXT NOT NULL DEFAULT 'normal',
        estimated_minutes INTEGER,
        scheduled_date    TEXT,
        start_time        TEXT,
        timezone          TEXT NOT NULL DEFAULT 'Asia/Shanghai',
        due_at            TEXT,
        completed_at      TEXT,
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL,
        deleted_at        TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (milestone_id) REFERENCES milestones(id)
      );

      CREATE INDEX idx_tasks_project   ON tasks(project_id);
      CREATE INDEX idx_tasks_scheduled ON tasks(scheduled_date);
      CREATE INDEX idx_tasks_status    ON tasks(status);
      CREATE INDEX idx_projects_goal   ON projects(goal_id);
      CREATE INDEX idx_milestones_proj ON milestones(project_id);
    `);
  },
};
