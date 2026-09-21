/**
 * 目标页（S2 T21）：列表、新增（标题 + 领域）、编辑标题（PATCH expectedRevision）、归档（DELETE）。
 */
import { post, patch, del } from '../api/client.js';
import * as store from '../state/store.js';
import { el, clear, errorMessage } from '../components/ui.js';

export async function render(container) {
  clear(container);

  const titleInput = el('input', { type: 'text', placeholder: '目标标题', class: 'input grow' });
  const areaInput = el('input', { type: 'text', placeholder: '领域（如 学习 / 健康）', class: 'input' });
  const addBtn = el('button', { type: 'submit', class: 'btn', text: '新增目标' });
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const listBox = el('div', { class: 'item-list' });

  const form = el('form', { class: 'add-form' }, [titleInput, areaInput, addBtn]);

  function showError(msg) {
    errorBox.textContent = msg || '';
    errorBox.classList.toggle('visible', !!msg);
  }

  function renderList() {
    clear(listBox);
    const goals = store
      .getGoals()
      .slice()
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    if (goals.length === 0) {
      listBox.append(el('p', { class: 'empty', text: '尚无目标' }));
      return;
    }
    for (const g of goals) {
      listBox.append(goalItem(g, showError, renderList));
    }
  }

  async function refresh() {
    try {
      await store.invalidateGoals();
      showError('');
    } catch (err) {
      showError(errorMessage(err));
    }
    renderList();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const area = areaInput.value.trim();
    if (!title) {
      showError('请输入目标标题');
      return;
    }
    if (!area) {
      showError('请输入领域');
      return;
    }
    showError('');
    try {
      await post('/api/v1/goals', { title, area });
      titleInput.value = '';
      areaInput.value = '';
      await refresh();
    } catch (err) {
      showError(errorMessage(err));
    }
  });

  container.append(
    el('div', { class: 'page-head' }, [el('h2', { text: '目标' })]),
    form,
    errorBox,
    listBox,
  );

  await refresh();
}

function goalItem(g, showError, onAfterSave) {
  const root = el('div', { class: 'item' });
  renderView();
  return root;

  function renderView() {
    clear(root);
    const title = el('span', { class: 'item-title', text: g.title });
    const meta = el('span', { class: 'muted', text: [g.area, g.status].filter(Boolean).join(' · ') });
    const editBtn = el('button', { type: 'button', class: 'btn-sm', text: '编辑' });
    const archiveBtn = el('button', { type: 'button', class: 'btn-sm danger', text: '归档' });
    editBtn.addEventListener('click', renderEdit);
    archiveBtn.addEventListener('click', doArchive);
    root.append(title, meta, editBtn, archiveBtn);
  }

  function renderEdit() {
    clear(root);
    const input = el('input', { type: 'text', class: 'input grow', value: g.title });
    const saveBtn = el('button', { type: 'button', class: 'btn-sm', text: '保存' });
    const cancelBtn = el('button', { type: 'button', class: 'btn-sm', text: '取消' });
    const errBox = el('span', { class: 'form-error visible', role: 'alert' });

    saveBtn.addEventListener('click', async () => {
      const title = input.value.trim();
      if (!title) {
        errBox.textContent = '标题不能为空';
        return;
      }
      saveBtn.disabled = true;
      try {
        await patch(`/api/v1/goals/${g.id}`, {
          expectedRevision: g.revision,
          changes: { title },
        });
        showError('');
        await store.invalidateGoals();
        onAfterSave();
      } catch (err) {
        saveBtn.disabled = false;
        errBox.textContent = errorMessage(err);
      }
    });
    cancelBtn.addEventListener('click', renderView);
    root.append(input, saveBtn, cancelBtn, errBox);
  }

  async function doArchive() {
    try {
      await del(`/api/v1/goals/${g.id}`);
      showError('');
      await store.invalidateGoals();
      onAfterSave();
    } catch (err) {
      showError(errorMessage(err));
    }
  }
}
