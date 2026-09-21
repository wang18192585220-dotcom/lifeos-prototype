/**
 * 项目页（S2 T21）：列表、新增（标题 + 领域）、编辑标题、归档；
 * 显示项目下任务完成率（用 tasks 数据本地计算，与后端 completionRate 规则一致）。
 */
import { post, patch, del } from '../api/client.js';
import * as store from '../state/store.js';
import { el, clear, errorMessage } from '../components/ui.js';

/** 完成率：只统计未取消任务；无任务返回 null（「尚无任务」，不是 100%）。 */
function completion(tasks, projectId) {
  const active = tasks.filter((t) => t.projectId === projectId && t.status !== 'cancelled');
  if (active.length === 0) return null;
  const done = active.filter((t) => t.status === 'done').length;
  return { done, total: active.length, ratio: done / active.length };
}

export async function render(container) {
  clear(container);

  const titleInput = el('input', { type: 'text', placeholder: '项目标题', class: 'input grow' });
  const areaInput = el('input', { type: 'text', placeholder: '领域（如 学习 / 健康）', class: 'input' });
  const addBtn = el('button', { type: 'submit', class: 'btn', text: '新增项目' });
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const listBox = el('div', { class: 'item-list' });

  const form = el('form', { class: 'add-form' }, [titleInput, areaInput, addBtn]);

  function showError(msg) {
    errorBox.textContent = msg || '';
    errorBox.classList.toggle('visible', !!msg);
  }

  function renderList() {
    clear(listBox);
    const projects = store
      .getProjects()
      .slice()
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const tasks = store.getTasks();
    if (projects.length === 0) {
      listBox.append(el('p', { class: 'empty', text: '尚无项目' }));
      return;
    }
    for (const p of projects) {
      listBox.append(projectItem(p, completion(tasks, p.id), showError, renderList));
    }
  }

  async function refresh() {
    try {
      await Promise.all([store.invalidateProjects(), store.invalidateTasks()]);
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
      showError('请输入项目标题');
      return;
    }
    if (!area) {
      showError('请输入领域');
      return;
    }
    showError('');
    try {
      await post('/api/v1/projects', { title, area });
      titleInput.value = '';
      areaInput.value = '';
      await refresh();
    } catch (err) {
      showError(errorMessage(err));
    }
  });

  container.append(
    el('div', { class: 'page-head' }, [el('h2', { text: '项目' })]),
    form,
    errorBox,
    listBox,
  );

  await refresh();
}

function projectItem(p, rate, showError, onAfterSave) {
  const root = el('div', { class: 'item' });
  renderView();
  return root;

  function renderView() {
    clear(root);
    const title = el('span', { class: 'item-title', text: p.title });
    const meta = el('span', { class: 'muted', text: [p.area, p.status].filter(Boolean).join(' · ') });
    const progress = rate
      ? el('span', { class: 'muted', text: `完成 ${rate.done}/${rate.total}（${Math.round(rate.ratio * 100)}%）` })
      : el('span', { class: 'muted', text: '尚无任务' });
    const editBtn = el('button', { type: 'button', class: 'btn-sm', text: '编辑' });
    const archiveBtn = el('button', { type: 'button', class: 'btn-sm danger', text: '归档' });
    editBtn.addEventListener('click', renderEdit);
    archiveBtn.addEventListener('click', doArchive);
    root.append(title, meta, progress, editBtn, archiveBtn);
  }

  function renderEdit() {
    clear(root);
    const input = el('input', { type: 'text', class: 'input grow', value: p.title });
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
        await patch(`/api/v1/projects/${p.id}`, {
          expectedRevision: p.revision,
          changes: { title },
        });
        showError('');
        await store.invalidateProjects();
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
      await del(`/api/v1/projects/${p.id}`);
      showError('');
      await store.invalidateProjects();
      onAfterSave();
    } catch (err) {
      showError(errorMessage(err));
    }
  }
}
