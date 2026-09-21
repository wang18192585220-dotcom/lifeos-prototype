/**
 * 提案确认组件（S3 T32）。显示 summary + 各 action 可读文本，pending 时提供确认/拒绝。
 */
import { post } from '../api/client.js';
import { el, errorMessage } from './ui.js';

function actionText(a) {
  const op = a.operation || '';
  const verb = { create: '创建', update: '修改', archive: '归档', complete: '完成', cancel: '取消' };
  const v = verb[op.split('.').pop()] || op;
  const changes = a.changes ? Object.entries(a.changes).map(([k, val]) => `${k}=${val}`).join(', ') : '';
  return `${v}${changes ? `（${changes}）` : ''}`;
}

/**
 * @param {object} proposal
 * @param {{onChanged?:Function}} opts 确认/拒绝后的回调
 */
export function proposalCard(proposal, opts = {}) {
  const root = el('div', { class: 'proposal' });
  root.append(el('div', { class: 'proposal-summary', text: proposal.summary || '（无摘要）' }));

  const list = el('ul', { class: 'proposal-actions' });
  for (const a of proposal.actions || []) {
    list.append(el('li', { text: actionText(a) }));
  }
  root.append(list);

  const statusText = {
    pending: '待确认',
    applied: '已应用',
    rejected: '已拒绝',
    expired: '已过期',
    conflict: '冲突',
  };
  root.append(el('span', { class: 'proposal-status', text: statusText[proposal.status] || proposal.status }));

  if (proposal.status === 'pending') {
    const btnBox = el('div', { class: 'proposal-btns' });
    const confirmBtn = el('button', { type: 'button', class: 'btn-sm', text: '确认' });
    const rejectBtn = el('button', { type: 'button', class: 'btn-sm danger', text: '拒绝' });

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      rejectBtn.disabled = true;
      try {
        await post(`/api/v1/proposals/${proposal.id}/confirm`, { payloadHash: proposal.payloadHash });
        if (opts.onChanged) await opts.onChanged();
      } catch (err) {
        confirmBtn.disabled = false;
        rejectBtn.disabled = false;
        alert(errorMessage(err));
      }
    });
    rejectBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      rejectBtn.disabled = true;
      try {
        await post(`/api/v1/proposals/${proposal.id}/reject`, {});
        if (opts.onChanged) await opts.onChanged();
      } catch (err) {
        confirmBtn.disabled = false;
        rejectBtn.disabled = false;
        alert(errorMessage(err));
      }
    });
    btnBox.append(confirmBtn, rejectBtn);
    root.append(btnBox);
  }

  return root;
}
