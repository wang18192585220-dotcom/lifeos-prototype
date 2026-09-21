'use strict';

/**
 * 迁移注册表：按 version 升序追加。不要改动已发布的迁移文件。
 */
module.exports = [
  require('./0001_init.js'),
  require('./0002_file_outbox.js'),
  require('./0003_core_tables.js'),
  require('./0004_agent_knowledge_tables.js'),
];
