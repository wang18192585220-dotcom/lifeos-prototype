/**
 * 聊天页（S3 T32）：选角色 → 开/找会话 → 发消息 → 显示答复与提案（可确认/拒绝）。
 */
import { get, post } from '../api/client.js';
import * as store from '../state/store.js';
import { el, clear, errorMessage } from '../components/ui.js';
import { proposalCard } from '../components/proposal.js';

export async function render(container) {
  clear(container);
  const state = { sessionId: null, agentId: null };

  const agentSelect = el('select', { class: 'input' });
  const msgList = el('div', { class: 'chat-list' });
  const input = el('input', { type: 'text', placeholder: '输入消息…', class: 'input grow' });
  const sendBtn = el('button', { type: 'submit', class: 'btn', text: '发送' });
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const form = el('form', { class: 'chat-form' }, [input, sendBtn]);

  function showError(msg) {
    errorBox.textContent = msg || '';
    errorBox.classList.toggle('visible', !!msg);
  }

  async function ensureSession(agentId) {
    const sessions = await store.loadSessions();
    const latest = sessions
      .filter((s) => s.agentId === agentId)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      .pop();
    if (latest) return latest;
    const created = await post('/api/v1/sessions', { agentId });
    await store.invalidateSessions();
    return created.data;
  }

  async function refreshMessages() {
    clear(msgList);
    if (!state.sessionId) {
      msgList.append(el('p', { class: 'empty', text: '选择角色后开始对话' }));
      return;
    }
    const res = await get(`/api/v1/sessions/${state.sessionId}/messages`);
    for (const m of res.data || []) {
      const cls = 'chat-msg ' + (m.role === 'user' ? 'user' : 'assistant');
      msgList.append(el('div', { class: cls, text: m.content }));
    }
  }

  async function refreshProposals() {
    const props = await store.loadProposals();
    for (const p of props.filter((p) => p.status === 'pending' && p.sessionId === state.sessionId)) {
      msgList.append(
        proposalCard(p, {
          onChanged: async () => {
            await store.invalidateProposals();
            await refreshMessages();
            await refreshProposals();
          },
        })
      );
    }
  }

  async function renderAll() {
    await refreshMessages();
    await refreshProposals();
  }

  agentSelect.addEventListener('change', async () => {
    state.agentId = agentSelect.value;
    if (!state.agentId) {
      state.sessionId = null;
      clear(msgList);
      return;
    }
    try {
      const session = await ensureSession(state.agentId);
      state.sessionId = session.id;
      showError('');
      await renderAll();
    } catch (err) {
      showError(errorMessage(err));
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || !state.sessionId) return;
    showError('');
    sendBtn.disabled = true;
    try {
      await post(`/api/v1/sessions/${state.sessionId}/turns`, { message: text });
      input.value = '';
      await renderAll();
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      sendBtn.disabled = false;
    }
  });

  container.append(
    el('div', { class: 'page-head' }, [el('h2', { text: '聊天' }), agentSelect]),
    errorBox,
    msgList,
    form
  );

  await store.loadAgents();
  clear(agentSelect);
  agentSelect.append(el('option', { value: '', text: '选择角色' }));
  for (const a of store.getAgents().filter((x) => x.enabled)) {
    agentSelect.append(el('option', { value: a.id, text: a.name }));
  }
}
