/**
 * LifeOS API 客户端（S1）。
 *
 * 只通过受限 bridge（window.lifeos.request）访问本地服务：
 * - 不直接使用 fetch / XMLHttpRequest；
 * - 不接触令牌（令牌由 preload 注入 Authorization: Bearer）；
 * - 不写 localStorage。
 */

export function get(path) {
  return window.lifeos.request('GET', path);
}

export function post(path, body) {
  return window.lifeos.request('POST', path, body);
}

export function put(path, body) {
  return window.lifeos.request('PUT', path, body);
}

export function patch(path, body) {
  return window.lifeos.request('PATCH', path, body);
}

export function del(path) {
  return window.lifeos.request('DELETE', path);
}
