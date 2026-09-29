/**
 * API 设置服务：校验、保存与恢复自定义连接配置，并执行连接测试。
 * 非敏感字段写入 local，密钥仅写入 session；全部清空后恢复托管。
 */
import { API_KEY_SESSION_KEY, SETTINGS_KEY } from "../../shared/config/constants.js";
import { qs } from "../../shared/ui/dom.js";
import { getLocal, getSession, setLocal, setSession } from "../../shared/storage/chrome-storage.js";
import { postResponses, validateModelSettings } from "../../shared/ai/client.js";
import { extractResponseContent } from "../../shared/ai/response.js";
import { MODEL_TOKEN_LIMITS } from "../../shared/ai/token-limits.js";

export const defaultSettings = Object.freeze({ provider: "hosted", baseUrl: "", model: "", apiKey: "" });

export async function getSavedSettings() {
  const data = await getLocal({ [SETTINGS_KEY]: defaultSettings });
  const settings = await migratePlaintextApiKey(data[SETTINGS_KEY] || defaultSettings);
  const session = await getSession({ [API_KEY_SESSION_KEY]: "" });
  return { ...settings, apiKey: session[API_KEY_SESSION_KEY] || "" };
}

// 入口开关只控制界面；用户已保存的自定义配置始终优先。
export async function getSettings() {
  const settings = await getSavedSettings();
  return settings.provider === "hosted" ? { ...defaultSettings } : { ...settings, provider: "custom" };
}

export async function loadSettings() {
  const settings = await getSettings();
  qs("#baseUrl").value = settings.baseUrl;
  qs("#modelName").value = settings.model;
  qs("#apiKey").value = settings.apiKey;
}

function readFormSettings() {
  const settings = {
    provider: "custom",
    baseUrl: qs("#baseUrl").value.trim(),
    model: qs("#modelName").value.trim(),
    apiKey: qs("#apiKey").value.trim()
  };
  if (!settings.baseUrl && !settings.model && !settings.apiKey) return { ...defaultSettings };
  validateModelSettings(settings);
  if (/\/chat\/completions\/?$/i.test(settings.baseUrl)) throw new Error("仅支持 Responses API，请填写 Base URL 或 /responses 地址。");
  return settings;
}

export async function saveSettings() {
  const settings = readFormSettings();
  const { apiKey, ...publicSettings } = settings;
  await setSession({ [API_KEY_SESSION_KEY]: apiKey });
  await setLocal({ [SETTINGS_KEY]: publicSettings });
  return settings;
}

export async function testApiKey() {
  const status = qs("#apiStatus");
  const button = qs("#testApiBtn");
  status.className = "api-status";
  status.textContent = "正在连接模型服务...";
  button.disabled = true;
  try {
    const settings = readFormSettings();
    const result = await postResponses({
      label: "settings-test", settings,
      body: {
        model: settings.model,
        messages: [{ role: "user", content: 'Return {"ok":true}' }],
        max_tokens: MODEL_TOKEN_LIMITS.settingsTest.outputTokens,
        json_schema_format: { name: "settings_connection_test", strict: true,
          schema: { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean" } } } }
      },
      errorPrefix: "连接失败"
    });
    if (JSON.parse(extractResponseContent(result)).ok !== true) throw new Error("服务未返回有效的 Responses API 测试结果。");
    status.classList.add("ok");
    status.textContent = settings.provider === "hosted" ? "RoleMI 服务连接成功。" : "Responses API 连接测试通过。";
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message || "连接测试失败。";
  } finally {
    button.disabled = false;
  }
}

async function migratePlaintextApiKey(settings) {
  if (!settings || !settings.apiKey) return withoutApiKey(settings || {});

  // 旧版本曾把 API Key 写入 chrome.storage.local；加载设置时迁移到 session 并覆盖清理长期明文。
  await setSession({ [API_KEY_SESSION_KEY]: settings.apiKey });
  const migrated = withoutApiKey(settings);
  await setLocal({ [SETTINGS_KEY]: migrated });
  return migrated;
}

function withoutApiKey(settings) {
  const { apiKey: _apiKey, ...publicSettings } = settings || {};
  return {
    ...defaultSettings,
    ...publicSettings,
    provider: publicSettings.provider || "hosted"
  };
}
