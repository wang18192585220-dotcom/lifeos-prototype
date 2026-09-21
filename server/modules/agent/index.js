'use strict';

/**
 * agent 模块入口（S3 T30）：模型适配、会话、提案。
 */
const { ChatClient, modelError } = require('./model');
const { SessionService } = require('./session');
const { ProposalService } = require('./proposal');

module.exports = { ChatClient, modelError, SessionService, ProposalService };
