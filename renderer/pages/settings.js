/**
 * 设置页（S3 T32）：模型配置、角色（含资料库授权）、资料库（含文本导入）。
 */
import { get, post, put } from '../api/client.js';
import * as store from '../state/store.js';
import { el, clear, errorMessage } from '../components/ui.js';

function section(title) {
  return el('section', { class: 'settings-section' }, [el('h3', { text: title })]);
}

function errBox() {
  return el('div', { class: 'form-error', role: 'alert' });
}

function showError(box, msg) {
  box.textContent = msg || '';
  box.classList.toggle('visible', !!msg);
}

export async function render(container) {
  clear(container);

  // ---- 模型配置 ----
  const mpSection = section('模型配置');
  const mpList = el('div', { class: 'item-list' });
  const mpErr = errBox();
  const mpBaseUrl = el('input', { type: 'text', placeholder: 'baseUrl（如 https://api.openai.com/v1）', class: 'input grow' });
  const mpModel = el('input', { type: 'text', placeholder: 'model', class: 'input' });
  const mpRef = el('input', { type: 'text', placeholder: 'credentialRef（凭据引用）', class: 'input' });
  const mpForm = el('form', { class: 'add-form' }, [mpBaseUrl, mpModel, mpRef, el('button', { type: 'submit', class: 'btn', text: '新增模型' })]);

  async function renderProfiles() {
    await store.loadModelProfiles();
    clear(mpList);
    for (const p of store.getModelProfiles()) {
      mpList.append(el('div', { class: 'item', text: `${p.model} · ${p.baseUrl} · 凭据${p.credentialSet ? '已设' : '未设'}` }));
    }
  }
  mpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!mpBaseUrl.value.trim() || !mpModel.value.trim()) return showError(mpErr, 'baseUrl 与 model 必填');
    try {
      await post('/api/v1/model-profiles', { baseUrl: mpBaseUrl.value.trim(), model: mpModel.value.trim(), credentialRef: mpRef.value.trim() || undefined });
      mpBaseUrl.value = mpModel.value = mpRef.value = '';
      showError(mpErr, '');
      await renderProfiles();
    } catch (err) {
      showError(mpErr, errorMessage(err));
    }
  });
  mpSection.append(mpForm, mpErr, mpList);

  // ---- 角色 ----
  const agSection = section('角色（Agent）');
  const agList = el('div', { class: 'item-list' });
  const agErr = errBox();
  const agName = el('input', { type: 'text', placeholder: '名称', class: 'input' });
  const agPrompt = el('input', { type: 'text', placeholder: '角色提示词', class: 'input grow' });
  const agModel = el('select', { class: 'input' });
  const agForm = el('form', { class: 'add-form' }, [agName, agPrompt, agModel, el('button', { type: 'submit', class: 'btn', text: '新增角色' })]);

  async function renderAgents() {
    await store.loadAgents();
    await store.loadLibraries();
    clear(agList);
    clear(agModel);
    agModel.append(el('option', { value: '', text: '（无模型）' }));
    for (const p of store.getModelProfiles()) {
      agModel.append(el('option', { value: p.id, text: p.model }));
    }
    const libs = store.getLibraries();
    for (const a of store.getAgents()) {
      const box = el('div', { class: 'item' });
      box.append(el('span', { class: 'item-title', text: `${a.name}${a.enabled ? '' : '（停用）'}` }));

      // 资料库授权（多选 + 保存）
      const grants = el('div', { class: 'grants' });
      const selected = new Set();
      for (const lib of libs) {
        const cb = el('input', { type: 'checkbox' });
        const label = el('label', {}, [cb, el('span', { text: lib.title })]);
        cb.addEventListener('change', () => (cb.checked ? selected.add(lib.id) : selected.delete(lib.id)));
        grants.append(label);
      }
      const saveBtn = el('button', { type: 'button', class: 'btn-sm', text: '保存授权' });
      saveBtn.addEventListener('click', async () => {
        try {
          await put(`/api/v1/agents/${a.id}/grants`, { libraryIds: [...selected] });
          showError(agErr, '');
        } catch (err) {
          showError(agErr, errorMessage(err));
        }
      });
      grants.append(saveBtn);
      box.append(grants);
      agList.append(box);
    }
  }
  agForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!agName.value.trim()) return showError(agErr, '名称必填');
    try {
      await post('/api/v1/agents', { name: agName.value.trim(), rolePrompt: agPrompt.value.trim(), modelProfileId: agModel.value || undefined, enabled: true });
      agName.value = agPrompt.value = '';
      showError(agErr, '');
      await renderAgents();
    } catch (err) {
      showError(agErr, errorMessage(err));
    }
  });
  agSection.append(agForm, agErr, agList);

  // ---- 资料库 ----
  const libSection = section('资料库');
  const libList = el('div', { class: 'item-list' });
  const libErr = errBox();
  const libTitle = el('input', { type: 'text', placeholder: '资料库标题', class: 'input grow' });
  const libForm = el('form', { class: 'add-form' }, [libTitle, el('button', { type: 'submit', class: 'btn', text: '新增资料库' })]);

  async function renderLibraries() {
    await store.loadLibraries();
    clear(libList);
    for (const lib of store.getLibraries()) {
      const box = el('div', { class: 'item' });
      box.append(el('span', { class: 'item-title', text: lib.title }));
      const ta = el('textarea', { placeholder: '粘贴文本资料内容后点击导入', rows: 3, class: 'input' });
      const importBtn = el('button', { type: 'button', class: 'btn-sm', text: '导入文本' });
      importBtn.addEventListener('click', async () => {
        const text = ta.value.trim();
        if (!text) return showError(libErr, '内容不能为空');
        try {
          await post(`/api/v1/libraries/${lib.id}/documents`, { title: '导入资料', text });
          ta.value = '';
          showError(libErr, '');
        } catch (err) {
          showError(libErr, errorMessage(err));
        }
      });
      box.append(ta, importBtn);
      libList.append(box);
    }
  }
  libForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!libTitle.value.trim()) return showError(libErr, '标题必填');
    try {
      await post('/api/v1/libraries', { title: libTitle.value.trim() });
      libTitle.value = '';
      showError(libErr, '');
      await renderLibraries();
      await renderAgents();
    } catch (err) {
      showError(libErr, errorMessage(err));
    }
  });
  libSection.append(libForm, libErr, libList);

  // ---- Skills ----
  const skSection = section('Skills');
  const skList = el('div', { class: 'item-list' });
  async function renderSkills() {
    clear(skList);
    const res = await get('/api/v1/skills');
    for (const s of res.data || []) {
      const row = el('div', { class: 'item' });
      row.append(el('span', { class: 'item-title', text: `${s.name} · ${s.installStatus}${s.enabled ? ' · 启用' : ''}` }));
      const toggleBtn = el('button', { type: 'button', class: 'btn-sm', text: s.enabled ? '停用' : '启用' });
      toggleBtn.addEventListener('click', async () => {
        try {
          await post(`/api/v1/skills/${s.id}/${s.enabled ? 'disable' : 'enable'}`, {});
          await renderSkills();
        } catch (err) {
          showError(skErr, errorMessage(err));
        }
      });
      row.append(toggleBtn);
      skList.append(row);
    }
  }
  const skErr = errBox();
  skSection.append(skErr, skList);

  // ---- 工作流 ----
  const wfSection = section('工作流');
  const wfList = el('div', { class: 'item-list' });
  async function renderWorkflows() {
    clear(wfList);
    const res = await get('/api/v1/workflows');
    for (const w of res.data || []) {
      const row = el('div', { class: 'item' });
      row.append(el('span', { class: 'item-title', text: `工作流（${w.enabled ? '启用' : '停用'}）` }));
      const runBtn = el('button', { type: 'button', class: 'btn-sm', text: '执行一次' });
      runBtn.addEventListener('click', async () => {
        try {
          await post(`/api/v1/workflows/${w.id}/run`, {});
        } catch (err) {
          showError(skErr, errorMessage(err));
        }
      });
      row.append(runBtn);
      wfList.append(row);
    }
  }
  wfSection.append(wfList);

  container.append(mpSection, agSection, libSection, skSection, wfSection);
  await renderProfiles();
  await renderAgents();
  await renderLibraries();
  await renderSkills();
  await renderWorkflows();
}
