/**
 * 学习页（S4 T44）：学习档案、学习记录、待确认能力评估（确认/拒绝）。
 */
import { get, post, patch } from '../api/client.js';
import { el, clear, errorMessage } from '../components/ui.js';

function errBox() {
  return el('div', { class: 'form-error', role: 'alert' });
}
function showError(box, msg) {
  box.textContent = msg || '';
  box.classList.toggle('visible', !!msg);
}
function section(title) {
  return el('section', { class: 'settings-section' }, [el('h3', { text: title })]);
}

export async function render(container) {
  clear(container);

  // ---- 学习档案 ----
  const profileSection = section('学习档案');
  const profileBox = el('div', { class: 'item-list' });
  const pfErr = errBox();
  const pfLang = el('input', { type: 'text', placeholder: '语言（如 es）', class: 'input' });
  const pfMin = el('input', { type: 'text', placeholder: '期望下限（如 B1）', class: 'input' });
  const pfMax = el('input', { type: 'text', placeholder: '期望上限（如 B2）', class: 'input' });
  const pfForm = el('form', { class: 'add-form' }, [pfLang, pfMin, pfMax, el('button', { type: 'submit', class: 'btn', text: '创建档案' })]);

  async function renderProfile() {
    const res = await get('/api/v1/learning-profiles');
    const profiles = res.data || [];
    clear(profileBox);
    if (profiles.length === 0) {
      profileBox.append(el('p', { class: 'empty', text: '尚无学习档案' }));
      return null;
    }
    const p = profiles[0];
    profileBox.append(el('p', { text: `语言 ${p.language} · 目标 ${p.targetLevelMin || '?'}–${p.targetLevelMax || '?'}` }));
    return p;
  }
  pfForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pfLang.value.trim()) return showError(pfErr, '语言必填');
    try {
      await post('/api/v1/learning-profiles', {
        language: pfLang.value.trim(),
        purpose: 'exam_preparation',
        targetLevelMin: pfMin.value.trim() || undefined,
        targetLevelMax: pfMax.value.trim() || undefined,
      });
      pfLang.value = pfMin.value = pfMax.value = '';
      showError(pfErr, '');
      await renderProfile();
      await renderRecords();
    } catch (err) {
      showError(pfErr, errorMessage(err));
    }
  });
  profileSection.append(pfForm, pfErr, profileBox);

  // ---- 学习记录 ----
  const recSection = section('学习记录');
  const recBox = el('div', { class: 'item-list' });
  const recErr = errBox();
  const recResult = el('input', { type: 'text', placeholder: '练习结果（如 听写 8/10）', class: 'input grow' });
  const recForm = el('form', { class: 'add-form' }, [recResult, el('button', { type: 'submit', class: 'btn', text: '记录' })]);

  async function renderRecords() {
    clear(recBox);
    const profiles = (await get('/api/v1/learning-profiles')).data || [];
    if (profiles.length === 0) {
      recBox.append(el('p', { class: 'empty', text: '先创建学习档案' }));
      return;
    }
    const recs = (await get(`/api/v1/learning-records?profileId=${profiles[0].id}`)).data || [];
    for (const r of recs) {
      const dur = r.durationMinutes != null ? ` · ${r.durationMinutes} 分钟` : '';
      recBox.append(el('div', { class: 'item', text: `${r.result || '(无结果)'}${dur}` }));
    }
  }
  recForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const profiles = (await get('/api/v1/learning-profiles')).data || [];
    if (profiles.length === 0) return showError(recErr, '先创建学习档案');
    if (!recResult.value.trim()) return showError(recErr, '请输入结果');
    try {
      await post('/api/v1/learning-records', { profileId: profiles[0].id, result: recResult.value.trim() });
      recResult.value = '';
      showError(recErr, '');
      await renderRecords();
    } catch (err) {
      showError(recErr, errorMessage(err));
    }
  });
  recSection.append(recForm, recErr, recBox);

  // ---- 待确认能力评估 ----
  const assessSection = section('待确认能力评估');
  const assessBox = el('div', { class: 'item-list' });

  async function renderAssessments() {
    clear(assessBox);
    const list = (await get('/api/v1/assessments')).data || [];
    const pending = list.filter((a) => a.status === 'pending');
    if (pending.length === 0) {
      assessBox.append(el('p', { class: 'empty', text: '暂无待确认能力结论' }));
      return;
    }
    for (const a of pending) {
      const row = el('div', { class: 'item' });
      row.append(el('span', { class: 'item-title', text: `${a.capability}：${a.judgment}` }));
      const confirmBtn = el('button', { type: 'button', class: 'btn-sm', text: '确认' });
      const rejectBtn = el('button', { type: 'button', class: 'btn-sm danger', text: '拒绝' });
      confirmBtn.addEventListener('click', async () => {
        try {
          await post(`/api/v1/assessments/${a.id}/confirm`, {});
          await renderAssessments();
        } catch (err) {
          alert(errorMessage(err));
        }
      });
      rejectBtn.addEventListener('click', async () => {
        try {
          await post(`/api/v1/assessments/${a.id}/reject`, {});
          await renderAssessments();
        } catch (err) {
          alert(errorMessage(err));
        }
      });
      row.append(confirmBtn, rejectBtn);
      assessBox.append(row);
    }
  }
  assessSection.append(assessBox);

  container.append(profileSection, recSection, assessSection);
  await renderProfile();
  await renderRecords();
  await renderAssessments();
}
