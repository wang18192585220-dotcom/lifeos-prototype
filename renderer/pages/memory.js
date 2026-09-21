/**
 * 记忆页（S4 T44）：查看/删除长期记忆。
 */
import { get, del } from '../api/client.js';
import { el, clear, errorMessage } from '../components/ui.js';

export async function render(container) {
  clear(container);
  container.append(el('div', { class: 'page-head' }, [el('h2', { text: '个人记忆' })]));

  const agentSelect = el('select', { class: 'input' });
  const listBox = el('div', { class: 'item-list' });
  const errBox = el('div', { class: 'form-error', role: 'alert' });

  async function renderMemories() {
    clear(listBox);
    const agentId = agentSelect.value;
    if (!agentId) {
      listBox.append(el('p', { class: 'empty', text: '选择角色后查看其记忆' }));
      return;
    }
    try {
      const res = await get(`/api/v1/memories?agentId=${agentId}`);
      const list = res.data || [];
      if (list.length === 0) {
        listBox.append(el('p', { class: 'empty', text: '暂无记忆' }));
        return;
      }
      for (const m of list) {
        const row = el('div', { class: 'item' });
        row.append(el('span', { class: 'item-title', text: `${m.kind} · ${m.factStatus}` }));
        const delBtn = el('button', { type: 'button', class: 'btn-sm danger', text: '删除' });
        delBtn.addEventListener('click', async () => {
          try {
            await del(`/api/v1/memories/${m.id}`);
            await renderMemories();
          } catch (err) {
            errBox.textContent = errorMessage(err);
            errBox.classList.add('visible');
          }
        });
        row.append(delBtn);
        listBox.append(row);
      }
    } catch (err) {
      errBox.textContent = errorMessage(err);
      errBox.classList.add('visible');
    }
  }

  async function loadAgents() {
    const res = await get('/api/v1/agents');
    clear(agentSelect);
    agentSelect.append(el('option', { value: '', text: '选择角色' }));
    for (const a of (res.data || []).filter((x) => x.enabled)) {
      agentSelect.append(el('option', { value: a.id, text: a.name }));
    }
  }
  agentSelect.addEventListener('change', renderMemories);

  container.append(agentSelect, errBox, listBox);
  await loadAgents();
}
