import { logApiError, logApiRequest, logApiResponse } from "./api-debug.js";

export function validateModelSettings(settings) {
  if (!settings.apiKey || settings.apiKey.trim().length < 12) throw new Error(`请先在 API 设置中填写有效的 API Key。`);
  if (!settings.baseUrl || !/^https:\/\//i.test(settings.baseUrl)) throw new Error("请先在 API 设置中填写 https:// 开头的 Base URL。");
  if (!settings.model || !settings.model.trim()) throw new Error("请先在 API 设置中填写模型名称。");
}

export async function postChatCompletions({ label, settings, body, errorPrefix }) {
  const url = chatCompletionsUrl(settings.baseUrl);
  logApiRequest(label, { url, body });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    logApiError(label, { status: response.status, body: message });
    throw new Error(message ? `${errorPrefix}：${message.slice(0, 120)}` : `${errorPrefix}：API 调用失败。`);
  }

  const payload = await response.json();
  logApiResponse(label, payload);
  return payload;
}

export function chatCompletionsUrl(baseUrl) {
  // 用户可能填服务商根地址，也可能直接填 /chat/completions；这里统一成最终请求地址。
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return /\/chat\/completions$/i.test(trimmed) ? trimmed : `${trimmed}/chat/completions`;
}

export function supportsJsonResponseFormat(settings) {
  const provider = String(settings.provider || "").toLowerCase();
  const baseUrl = String(settings.baseUrl || "").toLowerCase();
  // 只对白名单服务启用 response_format，避免兼容 API 因不支持该字段而直接失败。
  return provider === "openai" || baseUrl.includes("api.openai.com");
}
