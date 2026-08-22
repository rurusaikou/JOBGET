import { deepAnalysisMessages } from "../prompts/deep-analysis.js";
import { parseAnalysisResponse } from "./response.js";
import { validateJobForAnalysis } from "./result.js";

export async function analyzeJobWithAi(job, settings) {
  const validation = validateJobForAnalysis(job);
  if (!validation.ok) throw new Error(validation.message);
  if (!settings.apiKey || settings.apiKey.trim().length < 12) throw new Error("请先在 API 设置中填写有效的 API Key。");
  if (!settings.baseUrl || !/^https:\/\//i.test(settings.baseUrl)) throw new Error("请先在 API 设置中填写 https:// 开头的 Base URL。");
  if (!settings.model || !settings.model.trim()) throw new Error("请先在 API 设置中填写模型名称。");

  const requestBody = {
    model: settings.model.trim(),
    temperature: 0.2,
    max_tokens: 2000,
    messages: deepAnalysisMessages(job)
  };

  // OpenAI 官方接口支持强约束 JSON；其他兼容服务有的会拒绝该参数，所以只对白名单启用。
  if (supportsJsonResponseFormat(settings)) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch(chatCompletionsUrl(settings.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message ? `分析失败：${message.slice(0, 120)}` : "分析失败：API 调用失败。");
  }

  return parseAnalysisResponse(await response.json());
}

function chatCompletionsUrl(baseUrl) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return /\/chat\/completions$/i.test(trimmed) ? trimmed : `${trimmed}/chat/completions`;
}

function supportsJsonResponseFormat(settings) {
  const provider = String(settings.provider || "").toLowerCase();
  const baseUrl = String(settings.baseUrl || "").toLowerCase();
  return provider === "openai" || baseUrl.includes("api.openai.com");
}
