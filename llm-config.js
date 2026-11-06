const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'llm-config.json');

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-flash';
const ENV_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const ENV_BASE_URL = process.env.LLM_BASE_URL || DEFAULT_BASE_URL;
const ENV_PROVIDER = process.env.LLM_PROVIDER === 'custom' ? 'custom' : 'deepseek';

let runtimeConfig = null;

function readStoredConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (err) {
    console.warn('[LLM Config] 读取本地配置失败，将回退到环境变量:', err.message);
    return null;
  }
}

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_BASE_URL;
  let url = raw;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString().replace(/\/+$/, '');
  } catch (e) {
    return null;
  }
}

function sanitizeModel(value) {
  return String(value || '').trim().slice(0, 120);
}

function buildStoredConfig(body = {}) {
  const provider = body.provider === 'custom' ? 'custom' : 'deepseek';
  const rawBaseUrl = body.customBaseUrl || body.baseUrl || (provider === 'custom' ? '' : DEFAULT_BASE_URL);
  const baseUrl = rawBaseUrl ? normalizeBaseUrl(rawBaseUrl) : DEFAULT_BASE_URL;
  if (!baseUrl) return { error: 'Base URL 格式无效，请输入完整的 http(s) 地址。' };

  return {
    provider,
    baseUrl: provider === 'custom' ? baseUrl : DEFAULT_BASE_URL,
    model: sanitizeModel(body.model || body.customModel) || (provider === 'custom' ? '' : DEFAULT_MODEL),
    apiKey: typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : undefined,
    customApiKey: typeof body.customApiKey === 'string' && body.customApiKey.trim() ? body.customApiKey.trim() : undefined,
    customBaseUrl: normalizeBaseUrl(rawBaseUrl) || '',
    customModel: sanitizeModel(body.customModel || body.model),
    customModels: Array.isArray(body.customModels)
      ? body.customModels.map(sanitizeModel).filter(Boolean).slice(0, 50)
      : undefined,
    updatedAt: new Date().toISOString()
  };
}

function saveStoredConfig(config) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(config, null, 2), 'utf-8');
  fs.renameSync(tmpFile, CONFIG_FILE);
  runtimeConfig = config;
}

function getStoredConfig() {
  if (!runtimeConfig) runtimeConfig = readStoredConfig();
  return runtimeConfig;
}

function getEffectiveConfig() {
  const stored = getStoredConfig() || {};
  const provider = stored.provider === 'custom' ? 'custom' : ENV_PROVIDER;

  if (provider === 'custom') {
    const customBaseUrl = normalizeBaseUrl(stored.customBaseUrl || stored.baseUrl);
    const customApiKey = (stored.customApiKey || stored.apiKey || '').trim();
    const customModel = sanitizeModel(stored.customModel || stored.model);
    return {
      provider: 'custom',
      baseUrl: customBaseUrl || normalizeBaseUrl(ENV_BASE_URL) || DEFAULT_BASE_URL,
      apiKey: customApiKey,
      model: customModel,
      envFallback: false,
      source: stored.customApiKey ? 'local' : (stored.apiKey ? 'local' : (customApiKey ? 'env' : 'none'))
    };
  }

  const baseUrl = normalizeBaseUrl(stored.baseUrl || ENV_BASE_URL) || DEFAULT_BASE_URL;
  const model = sanitizeModel(stored.model) || DEFAULT_MODEL;
  const apiKey = (stored.apiKey || ENV_API_KEY).trim();
  return {
    provider: 'deepseek',
    baseUrl,
    apiKey,
    model,
    envFallback: !stored.apiKey && !!ENV_API_KEY,
    source: stored.apiKey ? 'local' : (ENV_API_KEY ? 'env' : 'none')
  };
}

function getPublicConfig() {
  const stored = getStoredConfig() || {};
  const effective = getEffectiveConfig();
  const customModels = Array.isArray(stored.customModels) ? stored.customModels.filter(Boolean) : [];
  const selectedCustomModel = stored.customModel || stored.model || effective.model || '';
  const models = effective.provider === 'custom'
    ? [...new Set([selectedCustomModel, effective.model, ...customModels].filter(Boolean))]
    : [...new Set([effective.model, ...(stored.models || []).filter(Boolean)])];

  return {
    provider: effective.provider,
    baseUrl: effective.baseUrl,
    model: effective.model,
    configured: !!effective.apiKey,
    apiKeyHint: effective.source === 'env'
      ? '环境变量已配置（前端不可见）'
      : effective.source === 'local'
        ? '已在本地保存（前端不可见）'
        : '未配置',
    envFallback: effective.envFallback,
    models,
    customModels,
    customBaseUrl: stored.customBaseUrl || (effective.provider === 'custom' ? effective.baseUrl : ''),
    customModel: selectedCustomModel,
    hasCustomApiKey: !!(stored.customApiKey || (effective.provider === 'custom' && effective.apiKey)),
    defaultBaseUrl: DEFAULT_BASE_URL,
    defaultModel: DEFAULT_MODEL
  };
}

function getChatCompletionsUrl() {
  const { baseUrl } = getEffectiveConfig();
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

function ensureConfigured() {
  const config = getEffectiveConfig();
  if (config.apiKey) return null;
  return config.provider === 'custom'
    ? '自定义模型未配置：请在「模型设置」中填写 API Key。'
    : 'DeepSeek 未配置：请在「模型设置」或 .env 中填写 API Key。';
}

function buildChatPayload({ messages, responseFormat, temperature, maxTokens }) {
  const config = getEffectiveConfig();
  if (!config.model) {
    return { error: '模型未选择：请在「模型设置」中选择或填写模型名称。' };
  }
  const payload = {
    model: config.model,
    messages
  };
  if (responseFormat) payload.response_format = { type: 'json_object' };
  if (typeof temperature === 'number') payload.temperature = temperature;
  if (typeof maxTokens === 'number') payload.max_tokens = maxTokens;
  return { payload, config };
}

async function callChatCompletions(options) {
  const configurationError = ensureConfigured();
  if (configurationError) {
    return { ok: false, status: 503, error: configurationError };
  }
  const built = buildChatPayload(options);
  if (built.error) return { ok: false, status: 400, error: built.error };

  const { config, payload } = built;
  try {
    const response = await fetch(getChatCompletionsUrl(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const raw = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, error: raw || `HTTP ${response.status}` };
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return { ok: false, status: 502, error: '模型服务返回了非 JSON 响应。' };
    }
    return { ok: true, data, model: config.model, provider: config.provider };
  } catch (err) {
    return { ok: false, status: 502, error: err.message || '模型服务连接失败' };
  }
}

async function listRemoteModels() {
  const configurationError = ensureConfigured();
  if (configurationError) return { ok: false, error: configurationError };
  const { baseUrl, apiKey } = getEffectiveConfig();
  const candidates = [`${baseUrl}/models`, `${baseUrl}/v1/models`];
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) continue;
      const raw = await response.text();
      const data = JSON.parse(raw);
      if (!Array.isArray(data.data)) continue;
      const models = data.data
        .map(item => (typeof item === 'string' ? item : item.id))
        .filter(Boolean)
        .map(sanitizeModel)
        .filter(Boolean);
      if (models.length > 0) return { ok: true, models: [...new Set(models)].slice(0, 100), url };
    } catch (e) {}
  }
  return { ok: false, error: '该服务未提供可读取的 /models 接口，请手动填写模型名称。' };
}

async function testConnection() {
  const result = await callChatCompletions({
    messages: [
      { role: 'system', content: 'You are a connectivity test. Reply with the single word OK.' },
      { role: 'user', content: 'OK' }
    ],
    maxTokens: 16,
    temperature: 0
  });
  if (!result.ok) return { ok: false, error: result.error };
  const content = result.data.choices?.[0]?.message?.content?.trim() || '';
  return { ok: true, model: result.model, provider: result.provider, sample: content.slice(0, 60) };
}

function saveConfig(body) {
  const stored = getStoredConfig() || {};
  const built = buildStoredConfig({ ...stored, ...body });
  if (built.error) return { ok: false, error: built.error };

  const provider = built.provider;
  const finalConfig = { ...stored, ...built };
  Object.keys(finalConfig).forEach((key) => {
    if (finalConfig[key] === undefined) delete finalConfig[key];
  });
  if (provider === 'custom') {
    finalConfig.customBaseUrl = built.customBaseUrl || built.baseUrl || stored.customBaseUrl || '';
    finalConfig.customModel = built.customModel || built.model;
    const selected = finalConfig.customModel;
    finalConfig.customModels = [...new Set([selected, ...(finalConfig.customModels || [])].filter(Boolean))].slice(0, 50);
    if (!finalConfig.customApiKey && stored.customApiKey) finalConfig.customApiKey = stored.customApiKey;
  } else {
    finalConfig.baseUrl = DEFAULT_BASE_URL;
    finalConfig.model = built.model;
    if (!finalConfig.apiKey && stored.apiKey) finalConfig.apiKey = stored.apiKey;
  }
  saveStoredConfig(finalConfig);
  return { ok: true, config: getPublicConfig() };
}

function clearCustomConfig() {
  const stored = getStoredConfig() || {};
  const next = {
    provider: 'deepseek',
    baseUrl: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    apiKey: stored.apiKey || '',
    customApiKey: '',
    customBaseUrl: '',
    customModel: '',
    customModels: [],
    updatedAt: new Date().toISOString()
  };
  saveStoredConfig(next);
  return { ok: true, config: getPublicConfig() };
}

module.exports = {
  getPublicConfig,
  getEffectiveConfig,
  ensureConfigured,
  callChatCompletions,
  listRemoteModels,
  testConnection,
  saveConfig,
  clearCustomConfig
};
