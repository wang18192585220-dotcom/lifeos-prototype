/**
 * 日历页（S2 T21）：显示当前周（周一为一周起点）按日期分组的任务；
 * 可前后翻周；点击任务可勾选完成/重开。
 */
import { patch } from '../api/client.js';
import * as store from '../state/store.js';
import { el, clear, errorMessage, WEEKDAYS } from '../components/ui.js';

function localDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=周日
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export async function render(container) {
  clear(container);

  const state = { weekStart: startOfWeek(new Date()) };

  const label = el('span', { class: 'week-label' });
  const prevBtn = el('button', { type: 'button', class: 'btn-sm', text: '上一周' });
  const nextBtn = el('button', { type: 'button', class: 'btn-sm', text: '下一周' });
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const grid = el('div', { class: 'calendar-grid' });

  function showError(msg) {
    errorBox.textContent = msg || '';
    errorBox.classList.toggle('visible', !!msg);
  }

  function weekDays() {
    return Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i));
  }

  function renderLabel() {
    label.textContent = `${localDate(state.weekStart)} ~ ${localDate(addDays(state.weekStart, 6))}`;
  }

  function renderGrid() {
    clear(grid);
    const tasks = store.getTasks();
    const today = localDate(new Date());
    for (const day of weekDays()) {
      const ds = localDate(day);
      const dayTasks = tasks
        .filter((t) => t.scheduledDate === ds && t.status !== 'cancelled')
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

      const cell = el('div', { class: 'cal-cell' + (ds === today ? ' today' : '') }, [
        el('div', { class: 'cal-head' }, [
          el('span', { class: 'cal-date', text: ds.slice(5) }),
          el('span', { class: 'cal-weekday', text: `周${WEEKDAYS[day.getDay()]}` }),
        ]),
      ]);

      if (dayTasks.length === 0) {
        cell.append(el('p', { class: 'empty', text: '—' }));
      } else {
        for (const t of dayTasks) {
          cell.append(calTaskItem(t, showError, refresh));
        }
      }
      grid.append(cell);
    }
  }

  async function refresh() {
    try {
      await store.invalidateTasks();
      showError('');
    } catch (err) {
      showError(errorMessage(err));
    }
    renderGrid();
  }

  prevBtn.addEventListener('click', () => {
    state.weekStart = addDays(state.weekStart, -7);
    renderLabel();
    renderGrid();
  });
  nextBtn.addEventListener('click', () => {
    state.weekStart = addDays(state.weekStart, 7);
    renderLabel();
    renderGrid();
  });

  container.append(
    el('div', { class: 'page-head' }, [
      el('h2', { text: '日历' }),
      el('div', { class: 'week-nav' }, [prevBtn, label, nextBtn]),
    ]),
    errorBox,
    grid,
  );

  renderLabel();
  await refresh();
}

function calTaskItem(t, showError, onAfterSave) {
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

  return el('div', { class: 'cal-task' }, [toggle, title]);
}
