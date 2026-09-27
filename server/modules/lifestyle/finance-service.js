'use strict';

/**
 * FinanceService —— 财富域（账户/流水/目标，README 6.2 补充）。
 * 对应前端 demo「财富中心」的资产、负债、流水与财务目标。
 */
const { Repository } = require('../core/repository');

const ACCOUNT_COLS = {
  name: 'name',
  classification: 'classification',
  type: 'type',
  currency: 'currency',
  currentBalance: 'current_balance',
  note: 'note',
};

const TRANSACTION_COLS = {
  accountId: 'account_id',
  transferAccountId: 'transfer_account_id',
  type: 'type',
  amount: 'amount',
  currency: 'currency',
  category: 'category',
  merchant: 'merchant',
  transactionDate: 'transaction_date',
  note: 'note',
};

const GOAL_COLS = {
  name: 'name',
  description: 'description',
  targetAmount: 'target_amount',
  currentAmount: 'current_amount',
  currency: 'currency',
  deadline: 'deadline',
  status: 'status',
};

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

class FinanceService {
  constructor(adapter) {
    this.accounts = new Repository(adapter, 'finance_accounts', ACCOUNT_COLS);
    this.transactions = new Repository(adapter, 'finance_transactions', TRANSACTION_COLS);
    this.goals = new Repository(adapter, 'finance_goals', GOAL_COLS);
  }

  /**
   * 创建流水并同步调整账户余额（转账 = 转出账户扣减 + 转入账户增加）。
   * 与前端 demo 的 submitFinanceTransaction 语义一致。
   */
  createTransaction(fields) {
    const from = fields.accountId ? this.accounts.get(fields.accountId) : null;
    if (!from) throw err('VALIDATION', '转出账户不存在');
    const amount = Number(fields.amount) || 0;
    if (amount <= 0) throw err('VALIDATION', '金额必须大于 0');

    let tx = this.transactions.create({
      ...fields,
      amount,
      currency: from.currency,
    });

    if (fields.type === 'income') {
      this.accounts.update(from.id, from.revision, { currentBalance: from.currentBalance + amount });
    } else if (fields.type === 'expense') {
      this.accounts.update(from.id, from.revision, { currentBalance: from.currentBalance - amount });
    } else if (fields.type === 'transfer') {
      const to = fields.transferAccountId ? this.accounts.get(fields.transferAccountId) : null;
      if (!to) {
        // 回滚已创建的流水，保持一致性
        this.transactions.archive(tx.id);
        throw err('VALIDATION', '转入账户不存在');
      }
      this.accounts.update(from.id, from.revision, { currentBalance: from.currentBalance - amount });
      this.accounts.update(to.id, to.revision, { currentBalance: to.currentBalance + amount });
    }

    return this.transactions.get(tx.id);
  }

  /** 净资产 = 资产合计 - 负债合计（按币种汇率由调用方处理，这里仅返回原始余额合计）。 */
  totals() {
    const accounts = this.accounts.list();
    const assets = accounts.filter((a) => a.classification === 'asset');
    const liabilities = accounts.filter((a) => a.classification === 'liability');
    const sum = (list) => list.reduce((s, a) => s + (Number(a.currentBalance) || 0), 0);
    return { assets: sum(assets), liabilities: sum(liabilities), net: sum(assets) - sum(liabilities) };
  }
}

module.exports = { FinanceService };
