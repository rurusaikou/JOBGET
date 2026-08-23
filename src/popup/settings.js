import { API_KEY_SESSION_KEY, SETTINGS_KEY } from "./constants.js";
import { apiProviderPresets } from "./data/api-providers.js";
import { qs } from "./dom.js";
import { logApiError, logApiRequest, logApiResponse } from "./api-debug.js";
import { chatCompletionsUrl } from "./llm.js";
import { getLocal, getSession, setLocal, setSession } from "./storage.js";

export const defaultSettings = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4.1-mini"
};

export async function loadSettings() {
  const data = await getLocal({ [SETTINGS_KEY]: defaultSettings });
  const settings = await migratePlaintextApiKey(data[SETTINGS_KEY] || defaultSettings);
  const session = await getSession({ [API_KEY_SESSION_KEY]: "" });
  qs("#apiProvider").value = settings.provider || "openai";
  qs("#baseUrl").value = settings.baseUrl || apiProviderPresets.openai.baseUrl;
  qs("#modelName").value = settings.model || apiProviderPresets.openai.model;
  qs("#apiKey").value = session[API_KEY_SESSION_KEY] || "";
}

export async function getSettings() {
  const data = await getLocal({ [SETTINGS_KEY]: defaultSettings });
  const settings = await migratePlaintextApiKey(data[SETTINGS_KEY] || defaultSettings);
  const session = await getSession({ [API_KEY_SESSION_KEY]: "" });
  return {
    ...defaultSettings,
    ...settings,
    apiKey: session[API_KEY_SESSION_KEY] || ""
  };
}

export async function saveSettings() {
  await setLocal({
    [SETTINGS_KEY]: {
      provider: qs("#apiProvider").value,
      baseUrl: qs("#baseUrl").value.trim(),
      model: qs("#modelName").value.trim()
    }
  });
  await setSession({ [API_KEY_SESSION_KEY]: qs("#apiKey").value.trim() });
}

export function applyProviderPreset(provider) {
  const preset = apiProviderPresets[provider];
  qs("#baseUrl").value = preset.baseUrl;
  qs("#modelName").value = preset.model;
}

export async function testApiKey() {
  const key = qs("#apiKey").value.trim();
  const baseUrl = qs("#baseUrl").value.trim();
  const model = qs("#modelName").value.trim();
  const status = qs("#apiStatus");
  const button = qs("#testApiBtn");
  status.className = "api-status";
  status.textContent = "正在连接模型服务...";

  if (!key || key.length < 12) {
    status.classList.add("error");
    status.textContent = "测试失败：请输入有效的 API Key。";
    return;
  }
  if (!baseUrl.startsWith("https://")) {
    status.classList.add("error");
    status.textContent = "测试失败：Base URL 需要使用 https://。";
    return;
  }
  if (!model) {
    status.classList.add("error");
    status.textContent = "测试失败：请填写模型名称。";
    return;
  }

  button.disabled = true;
  try {
    await testChatCompletionsConnection({ baseUrl, key, model });
    status.classList.add("ok");
    status.textContent = "连接测试通过：API Key、Base URL 和模型可用。";
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message || "测试失败：模型服务连接失败。";
  } finally {
    button.disabled = false;
  }
}

async function testChatCompletionsConnection({ baseUrl, key, model }) {
  const url = chatCompletionsUrl(baseUrl);
  const body = {
    model,
    temperature: 0,
    max_tokens: 1,
    messages: [
      { role: "user", content: "ping" }
    ]
  };
  logApiRequest("settings-test", { url, body });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    logApiError("settings-test", { status: response.status, body: text });
    throw new Error(testConnectionErrorMessage(response.status, text));
  }

  const payload = parseJsonText(text);
  logApiResponse("settings-test", payload);
}

function testConnectionErrorMessage(status, body) {
  const detail = extractErrorMessage(body);
  if (status === 401 || status === 403) return `测试失败：API Key 无效或无权限。${detail}`;
  if (status === 404) return `测试失败：Base URL 或模型名称不正确。${detail}`;
  if (status === 429) return `测试失败：请求频率受限或额度不足。${detail}`;
  return `测试失败：模型服务返回 ${status}。${detail}`;
}

function extractErrorMessage(body) {
  const data = parseJsonText(body);
  const message = data && data.error && data.error.message || data && data.message || "";
  return message ? ` ${String(message).slice(0, 80)}` : "";
}

function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

async function migratePlaintextApiKey(settings) {
  if (!settings || !settings.apiKey) return withoutApiKey(settings || {});

  // 旧版本曾把 API Key 写入 chrome.storage.local；加载设置时迁移到 session 并覆盖清理。
  await setSession({ [API_KEY_SESSION_KEY]: settings.apiKey });
  const migrated = withoutApiKey(settings);
  await setLocal({ [SETTINGS_KEY]: migrated });
  return migrated;
}

function withoutApiKey(settings) {
  const { apiKey: _apiKey, ...publicSettings } = settings || {};
  return { ...defaultSettings, ...publicSettings };
}
