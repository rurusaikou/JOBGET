/**
 * 服务设置：校验、保存与恢复自定义 Responses API 配置，并执行连接测试。
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
  qs("#currentServiceStatus").textContent = settings.provider === "hosted"
    ? "当前使用默认服务"
    : "当前使用自定义服务";
  return settings;
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
  if (/\/chat\/completions\/?$/i.test(settings.baseUrl)) throw new Error("仅支持 Responses API，请填写 API 基础地址或 /responses 地址。");
  return settings;
}

export async function saveSettings() {
  const settings = readFormSettings();
  await persistSettings(settings);
  return settings;
}

export async function restoreDefaultSettings() {
  const settings = { ...defaultSettings };
  await persistSettings(settings);
  qs("#baseUrl").value = "";
  qs("#modelName").value = "";
  qs("#apiKey").value = "";
  qs("#currentServiceStatus").textContent = "当前使用默认服务";
  return settings;
}

async function persistSettings(settings) {
  const previous = await getSavedSettings();
  const { apiKey, ...publicSettings } = settings;
  try {
    await setSession({ [API_KEY_SESSION_KEY]: apiKey });
    await setLocal({ [SETTINGS_KEY]: publicSettings });
  } catch (error) {
    // 两个 Chrome Storage 区域无法原子提交；失败时尽力恢复二者的旧值。
    const { apiKey: previousApiKey, ...previousPublicSettings } = previous;
    await Promise.allSettled([
      setSession({ [API_KEY_SESSION_KEY]: previousApiKey || "" }),
      setLocal({ [SETTINGS_KEY]: previousPublicSettings })
    ]);
    throw error;
  }
}

export async function testApiKey() {
  const status = qs("#apiStatus");
  status.className = "api-status";
  status.textContent = "正在连接模型服务...";
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
