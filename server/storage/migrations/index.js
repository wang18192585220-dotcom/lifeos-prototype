'use strict';

/**
 * 迁移注册表：按 version 升序追加。不要改动已发布的迁移文件。
 */
module.exports = [
  require('./0001_init.js'),
  require('./0002_file_outbox.js'),
  require('./0003_core_tables.js'),
  require('./0004_agent_knowledge_tables.js'),
  require('./0005_knowledge_chunks.js'),
  require('./0006_skills_memory_learning_workflows.js'),
  require('./0007_memory_dedup_key.js'),
  require('./0008_import_batches.js'),
];
