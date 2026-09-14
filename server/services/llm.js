const { getConfig } = require('./db');

const PROVIDER_DEFAULTS = {
  openai: { baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  claude: { baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-20250514' },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: '' },
  custom: { baseUrl: '', defaultModel: '' }
};

function getProviderConfig() {
  const cfg = getConfig();
  const provider = cfg.provider || 'deepseek';
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.deepseek;
  return {
    provider,
    apiKey: cfg.apiKey || '',
    model: cfg.model || defaults.defaultModel,
    baseUrl: cfg.baseUrl || defaults.baseUrl,
    temperature: parseFloat(cfg.temperature) || 0.3,
    systemPrompt: cfg.systemPrompt || ''
  };
}

async function callLLM(messages, tools = [], stream = false) {
  const cfg = getProviderConfig();
  if (!cfg.apiKey) {
    throw new Error('NO_API_KEY');
  }

  if (cfg.provider === 'claude') {
    return callClaude(cfg, messages, tools, stream);
  }
  // OpenAI-compatible: openai, deepseek, doubao, custom
  return callOpenAICompatible(cfg, messages, tools, stream);
}

async function callOpenAICompatible(cfg, messages, tools, stream) {
  const openaiTools = tools.length ? tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  })) : undefined;

  const body = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature,
    stream
  };
  if (openaiTools) {
    body.tools = openaiTools;
    body.tool_choice = 'auto';
  }

  const resp = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API 错误 (${resp.status}): ${errText.slice(0, 300)}`);
  }

  if (stream) return resp; // Return response for SSE streaming

  const data = await resp.json();
  return {
    message: data.choices[0].message,
    usage: data.usage
  };
}

async function callClaude(cfg, messages, tools, stream) {
  const sysMsg = messages.find(m => m.role === 'system');
  const claudeMsgs = messages.filter(m => m.role !== 'system').map(m => {
    if (m.role === 'assistant' && m.tool_calls) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function',
          name: tc.function.name,
          input: safeJSONParse(tc.function.arguments, {})
        }))
      };
    }
    if (m.role === 'tool') {
      return {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }]
      };
    }
    return { role: m.role, content: m.content };
  });

  const claudeTools = tools.length ? tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object',
      properties: t.parameters.properties,
      required: t.parameters.required || []
    }
  })) : undefined;

  const body = {
    model: cfg.model,
    system: sysMsg?.content || '',
    messages: claudeMsgs,
    max_tokens: 2048,
    temperature: cfg.temperature,
    stream
  };
  if (claudeTools) body.tools = claudeTools;

  const resp = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API 错误 (${resp.status}): ${errText.slice(0, 300)}`);
  }

  if (stream) return resp;

  const data = await resp.json();
  let content = '';
  let toolCalls = [];
  for (const block of data.content) {
    if (block.type === 'text') content += block.text;
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: { name: block.name, arguments: JSON.stringify(block.input) }
      });
    }
  }
  return {
    message: { role: 'assistant', content: content || null, tool_calls: toolCalls.length ? toolCalls : undefined },
    usage: data.usage
  };
}

async function getEmbedding(text) {
  const cfg = getProviderConfig();
  // Use OpenAI-compatible embedding endpoint
  const embeddingBase = cfg.provider === 'deepseek'
    ? 'https://api.deepseek.com/v1'
    : cfg.baseUrl;

  try {
    const resp = await fetch(`${embeddingBase.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.provider === 'deepseek' ? 'deepseek-embedding' : 'text-embedding-ada-002',
        input: text.slice(0, 8000)
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.warn('Embedding failed, will use keyword fallback:', e.message);
    return null;
  }
}

function safeJSONParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = { callLLM, getEmbedding, getProviderConfig };
