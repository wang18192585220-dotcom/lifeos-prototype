'use strict';

/**
 * 0009 —— 生活域表：财富（账户/流水/目标）、人脉（联系人/关系/图谱状态）、健康（记录）。
 * 沿用 UUID + revision 乐观锁 + created_at/updated_at/deleted_at 约定（README 6.2）。
 * 对应前端 demo（index.html）的财富中心、人脉关系图谱、健康管理三块交互数据。
 */
module.exports = {
  version: 9,
  name: 'lifestyle_tables',
  up(adapter) {
    adapter.exec(`
      CREATE TABLE finance_accounts (
        id              TEXT PRIMARY KEY,
        revision        INTEGER NOT NULL DEFAULT 1,
        name            TEXT NOT NULL,
        classification  TEXT NOT NULL DEFAULT 'asset',
        type            TEXT NOT NULL DEFAULT 'cash',
        currency        TEXT NOT NULL DEFAULT 'CNY',
        current_balance REAL NOT NULL DEFAULT 0,
        note            TEXT NOT NULL DEFAULT '',
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT
      );

      CREATE TABLE finance_transactions (
        id                 TEXT PRIMARY KEY,
        revision           INTEGER NOT NULL DEFAULT 1,
        account_id         TEXT,
        transfer_account_id TEXT,
        type               TEXT NOT NULL DEFAULT 'expense',
        amount             REAL NOT NULL DEFAULT 0,
        currency           TEXT NOT NULL DEFAULT 'CNY',
        category           TEXT NOT NULL DEFAULT '',
        merchant           TEXT NOT NULL DEFAULT '',
        transaction_date   TEXT,
        note               TEXT NOT NULL DEFAULT '',
        created_at         TEXT NOT NULL,
        updated_at         TEXT NOT NULL,
        deleted_at         TEXT,
        FOREIGN KEY (account_id) REFERENCES finance_accounts(id),
        FOREIGN KEY (transfer_account_id) REFERENCES finance_accounts(id)
      );

      CREATE TABLE finance_goals (
        id             TEXT PRIMARY KEY,
        revision       INTEGER NOT NULL DEFAULT 1,
        name           TEXT NOT NULL,
        description    TEXT NOT NULL DEFAULT '',
        target_amount  REAL NOT NULL DEFAULT 0,
        current_amount REAL NOT NULL DEFAULT 0,
        currency       TEXT NOT NULL DEFAULT 'CNY',
        deadline       TEXT,
        status         TEXT NOT NULL DEFAULT 'active',
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL,
        deleted_at     TEXT
      );

      CREATE TABLE contacts (
        id                   TEXT PRIMARY KEY,
        revision             INTEGER NOT NULL DEFAULT 1,
        name                 TEXT NOT NULL,
        title                TEXT NOT NULL DEFAULT '',
        category             TEXT NOT NULL DEFAULT '其他',
        company              TEXT NOT NULL DEFAULT '',
        position             TEXT NOT NULL DEFAULT '',
        location             TEXT NOT NULL DEFAULT '',
        relationship_strength INTEGER NOT NULL DEFAULT 50,
        importance           INTEGER NOT NULL DEFAULT 3,
        phone                TEXT NOT NULL DEFAULT '',
        email                TEXT NOT NULL DEFAULT '',
        wechat               TEXT NOT NULL DEFAULT '',
        whatsapp             TEXT NOT NULL DEFAULT '',
        linkedin             TEXT NOT NULL DEFAULT '',
        tags                 TEXT NOT NULL DEFAULT '[]',
        summary              TEXT NOT NULL DEFAULT '',
        notes                TEXT NOT NULL DEFAULT '',
        fixed                INTEGER NOT NULL DEFAULT 0,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL,
        deleted_at           TEXT
      );

      CREATE TABLE relationships (
        id         TEXT PRIMARY KEY,
        revision   INTEGER NOT NULL DEFAULT 1,
        source_id  TEXT NOT NULL,
        target_id  TEXT NOT NULL,
        type       TEXT NOT NULL DEFAULT '认识',
        label      TEXT NOT NULL DEFAULT '',
        strength   INTEGER NOT NULL DEFAULT 50,
        note       TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      -- 图谱布局状态（节点坐标 / 固定），键值 JSON 文档
      CREATE TABLE network_state (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE health_records (
        id          TEXT PRIMARY KEY,
        revision    INTEGER NOT NULL DEFAULT 1,
        section     TEXT NOT NULL,
        payload     TEXT NOT NULL DEFAULT '{}',
        recorded_at TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT
      );

      CREATE INDEX idx_finance_tx_account ON finance_transactions(account_id);
      CREATE INDEX idx_relationships_source ON relationships(source_id);
      CREATE INDEX idx_relationships_target ON relationships(target_id);
      CREATE INDEX idx_health_records_section ON health_records(section);
    `);
  },
};
