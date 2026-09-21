'use strict';

/**
 * LifeOS 在用户 Obsidian Vault 内的目录布局（README 5.1）。
 * 所有业务数据都位于 <vaultRoot>/LifeOS/ 下，SQLite 为权威数据。
 */
const path = require('node:path');

function lifeosDir(vaultRoot) {
  return path.join(vaultRoot, 'LifeOS');
}
function systemDir(vaultRoot) {
  return path.join(lifeosDir(vaultRoot), '_system');
}
function dbPath(vaultRoot) {
  return path.join(systemDir(vaultRoot), 'lifeos.sqlite');
}
function searchDbPath(vaultRoot) {
  return path.join(systemDir(vaultRoot), 'search.sqlite');
}
function contentDir(vaultRoot) {
  return path.join(systemDir(vaultRoot), 'content');
}
function stagingDir(vaultRoot) {
  return path.join(systemDir(vaultRoot), 'staging');
}
function importsDir(vaultRoot) {
  return path.join(systemDir(vaultRoot), 'imports');
}
function logsDir(vaultRoot) {
  return path.join(systemDir(vaultRoot), 'logs');
}
function secretsPath(vaultRoot) {
  return path.join(systemDir(vaultRoot), 'secrets.enc');
}
function lockPath(vaultRoot) {
  return path.join(systemDir(vaultRoot), 'lifeos.lock');
}

function knowledgeDir(vaultRoot) {
  return path.join(lifeosDir(vaultRoot), 'Knowledge');
}
function memoryDir(vaultRoot) {
  return path.join(lifeosDir(vaultRoot), 'Memory');
}
function learningDir(vaultRoot) {
  return path.join(lifeosDir(vaultRoot), 'Learning');
}
function attachmentsDir(vaultRoot) {
  return path.join(lifeosDir(vaultRoot), 'Attachments');
}
function skillsDir(vaultRoot) {
  return path.join(lifeosDir(vaultRoot), 'Skills');
}
function exportsDir(vaultRoot) {
  return path.join(lifeosDir(vaultRoot), 'Exports');
}
function backupsDir(vaultRoot) {
  return path.join(lifeosDir(vaultRoot), 'Backups');
}

/**
 * 打开 Vault 时需要确保存在的目录（不含 Backups/Exports，按需创建）。
 */
function requiredDirs(vaultRoot) {
  return [
    systemDir,
    contentDir,
    stagingDir,
    importsDir,
    logsDir,
    knowledgeDir,
    memoryDir,
    learningDir,
    attachmentsDir,
    skillsDir,
  ].map((fn) => fn(vaultRoot));
}

module.exports = {
  lifeosDir,
  systemDir,
  dbPath,
  searchDbPath,
  contentDir,
  stagingDir,
  importsDir,
  logsDir,
  secretsPath,
  lockPath,
  knowledgeDir,
  memoryDir,
  learningDir,
  attachmentsDir,
  skillsDir,
  exportsDir,
  backupsDir,
  requiredDirs,
};
