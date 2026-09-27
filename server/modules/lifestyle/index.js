'use strict';

/**
 * lifestyle 模块入口：财富 / 人脉 / 健康（README 6.2 补充）。
 */
const { FinanceService } = require('./finance-service');
const { NetworkService } = require('./network-service');
const { HealthService } = require('./health-service');

module.exports = { FinanceService, NetworkService, HealthService };
