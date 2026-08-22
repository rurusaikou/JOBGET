import { API_KEY_SESSION_KEY, SETTINGS_KEY } from "./constants.js";
import { apiProviderPresets } from "./data/api-providers.js";
import { qs } from "./dom.js";
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

export function testApiKey() {
  const key = qs("#apiKey").value.trim();
  const baseUrl = qs("#baseUrl").value.trim();
  const status = qs("#apiStatus");
  status.className = "api-status";
  status.textContent = "正在测试连接...";
  setTimeout(() => {
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
    status.classList.add("ok");
    status.textContent = "格式校验通过：API Key 仅保存到当前浏览器会话。";
  }, 500);
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
