/**
 * 今日页（S2 T21）：显示某日期（默认今天，可切换）的非取消任务；
 * 新增任务（标题 + 可填日期）、勾选完成/重开、删除。
 */
import { post, patch, del } from '../api/client.js';
import * as store from '../state/store.js';
import { el, clear, errorMessage } from '../components/ui.js';

const PRIORITY_TEXT = { high: '高优先', low: '低优先' };

function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export async function render(container) {
  clear(container);

  const state = { date: localDate() };

  const dateInput = el('input', { type: 'date', value: state.date, class: 'input' });
  const titleInput = el('input', { type: 'text', placeholder: '任务标题', class: 'input grow' });
  const newDateInput = el('input', { type: 'date', value: state.date, class: 'input' });
  const addBtn = el('button', { type: 'submit', class: 'btn', text: '新增任务' });
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const listBox = el('div', { class: 'task-list' });

  const form = el('form', { class: 'add-form' }, [titleInput, newDateInput, addBtn]);

  function showError(msg) {
    errorBox.textContent = msg || '';
    errorBox.classList.toggle('visible', !!msg);
  }

  function renderList() {
    clear(listBox);
    const items = store
      .getTasks()
      .filter((t) => t.scheduledDate === state.date && t.status !== 'cancelled')
      .sort((a, b) => {
        const rank = { high: 2, normal: 1, low: 0 };
        const pa = rank[a.priority] ?? 1;
        const pb = rank[b.priority] ?? 1;
        return pb - pa || (a.title || '').localeCompare(b.title || '');
      });
    if (items.length === 0) {
      listBox.append(el('p', { class: 'empty', text: '该日期没有任务' }));
      return;
    }
    for (const t of items) {
      listBox.append(taskItem(t, showError, renderList));
    }
  }

  async function refresh() {
    try {
      await store.invalidateTasks();
      showError('');
    } catch (err) {
      showError(errorMessage(err));
    }
    renderList();
  }

  dateInput.addEventListener('change', () => {
    state.date = dateInput.value || localDate();
    newDateInput.value = state.date;
    renderList();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      showError('请输入任务标题');
      titleInput.focus();
      return;
    }
    showError('');
    try {
      await post('/api/v1/tasks', {
        title,
        scheduledDate: newDateInput.value || undefined,
      });
      titleInput.value = '';
      await refresh();
    } catch (err) {
      showError(errorMessage(err));
    }
  });

  container.append(
    el('div', { class: 'page-head' }, [
      el('h2', { text: '今日任务' }),
      el('label', { class: 'inline-label' }, [
        el('span', { class: 'muted', text: '日期' }),
        dateInput,
      ]),
    ]),
    form,
    errorBox,
    listBox,
  );

  await refresh();
}

function taskItem(t, showError, onAfterSave) {
  const isDone = t.status === 'done';
  const toggle = el('input', { type: 'checkbox', class: 'task-toggle' });
  toggle.checked = isDone;

  toggle.addEventListener('change', async () => {
    const before = isDone;
    toggle.disabled = true;
    try {
      if (before) {
        await patch(`/api/v1/tasks/${t.id}`, {
          expectedRevision: t.revision,
          changes: { status: 'todo', completedAt: null },
        });
      } else {
        await patch(`/api/v1/tasks/${t.id}`, {
          expectedRevision: t.revision,
          changes: { status: 'done', completedAt: new Date().toISOString() },
        });
      }
      showError('');
      await store.invalidateTasks();
      onAfterSave();
    } catch (err) {
      toggle.checked = before;
      toggle.disabled = false;
      showError(errorMessage(err));
    }
  });

  const title = el('span', { class: 'task-title' + (isDone ? ' done' : ''), text: t.title });
  const chip = PRIORITY_TEXT[t.priority]
    ? el('span', { class: 'chip', text: PRIORITY_TEXT[t.priority] })
    : null;

  const delBtn = el('button', { type: 'button', class: 'btn-sm danger', text: '删除' });
  delBtn.addEventListener('click', async () => {
    delBtn.disabled = true;
    try {
      await del(`/api/v1/tasks/${t.id}`);
      showError('');
      await store.invalidateTasks();
      onAfterSave();
    } catch (err) {
      delBtn.disabled = false;
      showError(errorMessage(err));
    }
  });

  return el('div', { class: 'task-item' }, [toggle, title, chip, delBtn]);
}
