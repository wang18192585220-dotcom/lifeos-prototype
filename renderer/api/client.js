/**
 * LifeOS API 客户端（S1）。
 *
 * 只通过受限 bridge（window.lifeos.request）访问本地服务：
 * - 不直接使用 fetch / XMLHttpRequest；
 * - 不接触令牌（令牌由 preload 注入 Authorization: Bearer）；
 * - 不写 localStorage。
 *
 * request() 统一把失败归一化为带 status 与后端 error.code 的 Error，
 * 供页面区分「版本冲突(409) / 校验失败(422) / Vault 未打开(503)」等。
 */

/** 把 bridge 抛出的原始错误归一化为带 status / code / requestId 的 Error。 */
function toError(err) {
  const body = err && err.body ? err.body : null;
  const backend = body && body.error ? body.error : null;
  const wrapped = new Error(
    (backend && backend.message) || (err && err.message) || '请求失败'
  );
  wrapped.status = err && typeof err.status === 'number' ? err.status : undefined;
  wrapped.code = backend && backend.code ? backend.code : undefined;
  wrapped.requestId = backend && backend.requestId ? backend.requestId : undefined;
  return wrapped;
}

/** 统一请求入口：仅经 window.lifeos.request（受限 bridge）访问本地服务。 */
function request(method, path, body) {
  return Promise.resolve()
    .then(() => window.lifeos.request(method, path, body))
    .catch((err) => {
      throw toError(err);
    });
}

export function get(path) {
  return request('GET', path);
}

export function post(path, body) {
  return request('POST', path, body);
}

export function put(path, body) {
  return request('PUT', path, body);
}

export function patch(path, body) {
  return request('PATCH', path, body);
}

export function del(path) {
  return request('DELETE', path);
}
