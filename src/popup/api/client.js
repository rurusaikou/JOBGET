import { logApiError, logApiRequest, logApiResponse } from "./debug.js";

export function validateModelSettings(settings) {
  if (!settings.apiKey || settings.apiKey.trim().length < 12) throw new Error(`请先在 API 设置中填写有效的 API Key。`);
  if (!settings.baseUrl || !/^https:\/\//i.test(settings.baseUrl)) throw new Error("请先在 API 设置中填写 https:// 开头的 Base URL。");
  if (!settings.model || !settings.model.trim()) throw new Error("请先在 API 设置中填写模型名称。");
}

export async function postResponses({ label, settings, body, errorPrefix }) {
  const request = buildResponsesRequest(settings, body);
  logApiRequest(label, request);

  const response = await fetch(request.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`
    },
    body: JSON.stringify(request.body)
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    logApiError(label, { status: response.status, body: message });
    throw new Error(message ? `${errorPrefix}：${message.slice(0, 120)}` : `${errorPrefix}：API 调用失败。`);
  }

  const payload = await response.json();
  logApiResponse(label, payload);
  if (payload && payload.status === "incomplete") {
    const reason = payload.incomplete_details && payload.incomplete_details.reason;
    throw new Error(reason === "max_output_tokens"
      ? `${errorPrefix}：模型输出被截断，请缩短输入或稍后重试。`
      : `${errorPrefix}：模型返回未完成。`);
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
