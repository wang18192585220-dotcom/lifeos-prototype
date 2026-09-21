/**
 * 公共 UI 构建工具（S2 T21）。
 * 全部用 DOM API + textContent 组装，不把用户数据放进 innerHTML（安全约定）。
 */

const BOOL_ATTRS = new Set(['disabled', 'checked', 'selected', 'required', 'readonly']);

/**
 * 构建元素。attrs 支持：class / text / value / on* 事件 / 其余普通 attribute。
 * children 可为数组、单个节点、字符串或数字（转文本节点）。
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'value') node.value = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (BOOL_ATTRS.has(k)) {
      node.setAttribute(k, '');
    } else {
      node.setAttribute(k, String(v));
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false || c === '') continue;
    if (typeof c === 'string' || typeof c === 'number') {
      node.append(document.createTextNode(String(c)));
    } else {
      node.append(c);
    }
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** 把后端错误映射为面向用户的简短文案。 */
export function errorMessage(err) {
  if (!err) return '发生未知错误';
  if (err.code === 'vault_not_open') return 'Vault 未打开（请先选择 Vault）';
  if (err.code === 'revision_conflict') return '保存失败：内容已被其他操作修改，请刷新后重试';
  if (err.code === 'validation') return `校验失败：${err.message || '输入不合法'}`;
  if (err.code === 'not_found') return '对象不存在（可能已被删除）';
  if (err.code === 'unauthorized') return '本地访问凭据无效';
  return err.message || '请求失败';
}

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
