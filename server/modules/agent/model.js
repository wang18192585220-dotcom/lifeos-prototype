'use strict';

/**
 * OpenAI 兼容聊天适配器（README 7.4）。
 *
 * - 支持普通回复、流式（SSE）、工具调用（原生 function calling）。
 * - 不支持流式可退为完整回复；不支持原生工具调用可用结构化文本提案（编排层处理）。
 * - 错误分类：AUTH_ERROR / RATE_LIMIT / MODEL_NOT_FOUND / FORMAT_ERROR / NETWORK_ERROR / PROVIDER_ERROR。
 */

function modelError(code, message, status) {
  const e = new Error(message);
  e.code = code;
  if (status) e.status = status;
  return e;
}

function classifyStatus(status) {
  if (status === 401 || status === 403) return modelError('AUTH_ERROR', '认证失败，请检查 API Key', status);
  if (status === 429) return modelError('RATE_LIMIT', '请求频率超限', status);
  if (status === 404) return modelError('MODEL_NOT_FOUND', '模型或端点不存在', status);
  if (status >= 500) return modelError('PROVIDER_ERROR', '模型服务错误', status);
  return modelError('FORMAT_ERROR', `请求格式错误（HTTP ${status}）`, status);
}

class ChatClient {
  /**
   * @param {object} opts
   * @param {string} opts.baseUrl OpenAI 兼容 base URL
   * @param {string} opts.apiKey
   * @param {string} opts.model
   * @param {number} [opts.temperature]
   * @param {number} [opts.timeoutMs]
   * @param {Function} [opts.fetchFn] 测试注入
   */
  constructor({ baseUrl, apiKey, model, temperature = 0, timeoutMs = 60000, fetchFn }) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.model = model;
    this.temperature = temperature;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetchFn || globalThis.fetch;
  }

  _headers() {
    return { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` };
  }

  async _post(path, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        await res.text().catch(() => '');
        throw classifyStatus(res.status);
      }
      return res;
    } catch (e) {
      if (e && e.code) throw e;
      if (e && e.name === 'AbortError') throw modelError('NETWORK_ERROR', '请求超时');
      throw modelError('NETWORK_ERROR', `网络错误: ${e && e.message ? e.message : e}`);
    } finally {
      clearTimeout(timer);
    }
  }

  _payload(messages, { tools, stream } = {}) {
    const p = { model: this.model, temperature: this.temperature, messages };
    if (tools && tools.length) p.tools = tools;
    if (stream) p.stream = true;
    return p;
  }

  /**
   * 非流式调用。
   * @returns {Promise<{content:string, toolCalls:Array<{id:string,name:string,arguments:string}>, finishReason:string}>}
   */
  async chat(messages, opts = {}) {
    const res = await this._post('/chat/completions', this._payload(messages, opts));
    const json = await res.json();
    return this._fromCompletion(json);
  }

  _fromCompletion(json) {
    const choice = json && json.choices && json.choices[0];
    if (!choice) throw modelError('FORMAT_ERROR', '模型响应缺少 choices');
    const msg = choice.message || {};
    const toolCalls = (msg.tool_calls || []).map((tc) => ({
      id: tc.id || '',
      name: (tc.function && tc.function.name) || '',
      arguments: (tc.function && tc.function.arguments) || '{}',
    }));
    return {
      content: typeof msg.content === 'string' ? msg.content : '',
      toolCalls,
      finishReason: choice.finish_reason,
    };
  }

  /**
   * 流式调用（SSE）。
   * @returns {AsyncGenerator<{delta:string, toolCalls?:Array, finishReason?:string}>}
   */
  async *stream(messages, opts = {}) {
    const res = await this._post('/chat/completions', this._payload(messages, { ...opts, stream: true }));
    if (!res.body || typeof res.body.getReader !== 'function') {
      // 部分实现不支持流式：退为完整回复
      const json = await res.json();
      const c = this._fromCompletion(json);
      yield { delta: c.content, toolCalls: c.toolCalls, finishReason: c.finishReason };
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const toolCalls = new Map();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') return;
          let json;
          try {
            json = JSON.parse(data);
          } catch (_) {
            continue;
          }
          const choice = json.choices && json.choices[0];
          if (!choice) continue;
          const delta = choice.delta || {};
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index || 0;
              const cur = toolCalls.get(idx) || { id: '', name: '', arguments: '' };
              if (tc.id) cur.id = tc.id;
              if (tc.function && tc.function.name) cur.name = tc.function.name;
              if (tc.function && tc.function.arguments) cur.arguments += tc.function.arguments;
              toolCalls.set(idx, cur);
            }
          }
          const event = { delta: typeof delta.content === 'string' ? delta.content : '' };
          if (choice.finish_reason) event.finishReason = choice.finish_reason;
          if (toolCalls.size) event.toolCalls = [...toolCalls.values()];
          yield event;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

module.exports = { ChatClient, modelError };
