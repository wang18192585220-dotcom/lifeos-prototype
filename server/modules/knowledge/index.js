'use strict';

const { KnowledgeService } = require('./service');
const { chunkText, bigramCJK } = require('./chunk');

module.exports = { KnowledgeService, chunkText, bigramCJK };
