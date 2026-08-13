import { SETTINGS_KEY } from "./constants.js";
import { apiProviderPresets } from "./data/api-providers.js";
import { qs } from "./dom.js";
import { getLocal, setLocal } from "./storage.js";

export async function loadSettings() {
  const data = await getLocal({
    [SETTINGS_KEY]: {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
      apiKey: ""
    }
  });
  const settings = data[SETTINGS_KEY];
  qs("#apiProvider").value = settings.provider || "openai";
  qs("#baseUrl").value = settings.baseUrl || apiProviderPresets.openai.baseUrl;
  qs("#modelName").value = settings.model || apiProviderPresets.openai.model;
  qs("#apiKey").value = settings.apiKey || "";
}

export async function saveSettings() {
  await setLocal({
    [SETTINGS_KEY]: {
      provider: qs("#apiProvider").value,
      baseUrl: qs("#baseUrl").value.trim(),
      model: qs("#modelName").value.trim(),
      apiKey: qs("#apiKey").value.trim()
    }
  });
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
    status.textContent = "格式校验通过：当前版本尚未发送真实模型请求。";
  }, 500);
}
