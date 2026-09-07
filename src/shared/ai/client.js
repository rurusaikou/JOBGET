/**
 * Responses API 适配层。
 *
 * Feature 使用统一、易读的 messages/max_tokens 结构；这里负责转换成 Responses API
 * 请求格式，并集中处理 JSON Schema、reasoning 兼容和 incomplete 错误。
 */
import { logApiError, logApiRequest, logApiResponse, logApiTiming } from "./debug.js";
import { AiApiError, AiNetworkError, AiResponseIncompleteError } from "./errors.js";

export function validateModelSettings(settings) {
  if (!settings.apiKey || settings.apiKey.trim().length < 12) throw new Error(`请先在 API 设置中填写有效的 API Key。`);
  if (!settings.baseUrl || !/^https:\/\//i.test(settings.baseUrl)) throw new Error("请先在 API 设置中填写 https:// 开头的 Base URL。");
  if (!settings.model || !settings.model.trim()) throw new Error("请先在 API 设置中填写模型名称。");
}

export async function postResponses({ label, settings, body, errorPrefix }) {
  const startedAt = performance.now();
  let request = buildResponsesRequest(settings, body);
  logApiRequest(label, request);

  let response;
  try {
    response = await sendRequest(request, settings);
  } catch (error) {
    logApiTiming(label, performance.now() - startedAt);
    logApiError(label, { type: "network", message: error?.message || String(error) });
    throw new AiNetworkError(`${errorPrefix}：网络请求失败。`, { details: { cause: error?.message || String(error) } });
  }

  if (!response.ok) {
    let message = await response.text().catch(() => "");
    // 兼容拒绝 reasoning 参数的服务：只去掉该参数重试一次，不循环重试业务请求。
    if (request.body.reasoning && shouldRetryWithoutReasoning(response.status, message)) {
      request = { ...request, body: withoutReasoning(request.body) };
      logApiRequest(`${label}-without-reasoning`, request);
      const compatibilityStartedAt = performance.now();
      try {
        response = await sendRequest(request, settings);
      } catch (error) {
        logApiTiming(`${label}-without-reasoning`, performance.now() - compatibilityStartedAt);
        logApiError(`${label}-without-reasoning`, { type: "network", message: error?.message || String(error) });
        throw new AiNetworkError(`${errorPrefix}：网络请求失败。`, { details: { cause: error?.message || String(error) } });
      }
      logApiTiming(`${label}-without-reasoning`, performance.now() - compatibilityStartedAt);
      if (response.ok) {
        const payload = await response.json();
        logApiResponse(`${label}-without-reasoning`, payload);
        return handleResponsesPayload(payload, errorPrefix, `${label}-without-reasoning`);
      }
      message = await response.text().catch(() => "");
    }
    logApiTiming(label, performance.now() - startedAt);
    logApiError(label, { status: response.status, body: message });
    throw new AiApiError(message ? `${errorPrefix}：${message.slice(0, 120)}` : `${errorPrefix}：API 调用失败。`, {
      status: response.status,
      details: { body: message.slice(0, 500) }
    });
  }

  const payload = await response.json();
  logApiResponse(label, payload);
  logApiTiming(label, performance.now() - startedAt);
  return handleResponsesPayload(payload, errorPrefix, label);
}

async function sendRequest(request, settings) {
  return fetch(request.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`
    },
    body: JSON.stringify(request.body)
  });
}

function handleResponsesPayload(payload, errorPrefix, label) {
  if (payload && payload.status === "incomplete") {
    const reason = payload.incomplete_details && payload.incomplete_details.reason || "unknown";
    const details = {
      label,
      status: payload.status,
      incompleteDetails: payload.incomplete_details || null,
      usage: payload.usage || null,
      hasReasoningOnlyOutput: hasReasoningOnlyOutput(payload)
    };
    logApiError(label, { type: "incomplete", reason, ...details });
    throw new AiResponseIncompleteError(`${errorPrefix}：模型返回未完成。`, { reason, details });
  }
  return payload;
}

export function responsesUrl(baseUrl) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  const withoutChatSuffix = trimmed.replace(/\/chat\/completions$/i, "");
  return /\/responses$/i.test(withoutChatSuffix) ? withoutChatSuffix : `${withoutChatSuffix}/responses`;
}

function buildResponsesRequest(settings, body) {
  return {
    url: responsesUrl(settings.baseUrl),
    body: normalizeResponsesBody(body)
  };
}

function normalizeResponsesBody(body) {
  const schemaFormat = body.json_schema_format;
  // 业务模块仍用 messages/max_tokens 这种易读结构；真正发请求前在 API 层统一转成 Responses 字段。
  const nextBody = {
    model: body.model,
    input: messagesToResponsesInput(body.messages),
    temperature: body.temperature,
    max_output_tokens: body.max_tokens
  };

  if (schemaFormat) {
    nextBody.text = {
      format: {
        type: "json_schema",
        name: schemaFormat.name,
        strict: true,
        schema: schemaFormat.schema
      }
    };
  }

  if (body.reasoning_effort) {
    nextBody.reasoning = { effort: body.reasoning_effort };
  }

  return nextBody;
}

function messagesToResponsesInput(messages) {
  // Responses API 接受 input 数组；这里保留 system/user 分层，避免把系统约束揉进用户 prompt。
  return (messages || []).map((message) => ({
    role: message.role === "developer" ? "system" : message.role,
    content: message.content
  }));
}

export function attachJsonSchemaFormat(body, schema, name) {
  // 先挂内部字段，避免业务层知道 text.format 的具体 API 形状。
  body.json_schema_format = { name, schema };
  return body;
}

function hasReasoningOnlyOutput(payload) {
  const output = Array.isArray(payload.output) ? payload.output : [];
  const hasReasoning = output.some((item) => item && item.type === "reasoning");
  const hasMessage = output.some((item) => item && item.type === "message");
  return hasReasoning && !hasMessage;
}

function shouldRetryWithoutReasoning(status, message) {
  return (status === 400 || status === 422) && /reasoning|effort|unsupported|unknown|invalid|extra/i.test(String(message || ""));
}

function withoutReasoning(body) {
  const { reasoning: _reasoning, ...rest } = body;
  return rest;
}
