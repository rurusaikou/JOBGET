import { normalizeAiAnalysis } from "./result.js";

export function parseAnalysisResponse(payload) {
  const content = extractResponseContent(payload);
  return normalizeAiAnalysis(parseAnalysisContent(content));
}

function extractResponseContent(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.output_text === "string") return payload.output_text;

  // OpenAI-compatible 服务并不总是复用同一个字段；集中兼容可降低供应商切换成本。
  const choice = payload.choices && payload.choices[0] ? payload.choices[0] : null;
  const message = choice && choice.message ? choice.message : null;
  const candidates = [
    message && message.content,
    message && message.reasoning_content,
    choice && choice.text
  ];

  for (const candidate of candidates) {
    const text = contentToText(candidate);
    if (text) return text;
  }

  if (Array.isArray(payload.output)) {
    const text = payload.output.map((item) => contentToText(item && item.content)).filter(Boolean).join("\n");
    if (text) return text;
  }

  return "";
}

function contentToText(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content.map((item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    return item.text || item.output_text || "";
  }).filter(Boolean).join("\n").trim();
}

function parseAnalysisContent(content) {
  try {
    return parseJsonContent(content);
  } catch (error) {
    // 有些模型会忽略 JSON 要求输出 Markdown 小节；保留兜底而不是把用户卡在格式错误。
    const markdownResult = parseMarkdownAnalysis(content);
    if (markdownResult) return markdownResult;
    throw error;
  }
}

function parseJsonContent(content) {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("分析失败：模型没有返回可展示内容，请尝试更换模型或关闭推理模型的空输出模式。");
  }
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("分析失败：模型返回格式异常。");
    try {
      return JSON.parse(match[0]);
    } catch (__error) {
      throw new Error("分析失败：模型返回格式异常。");
    }
  }
}

function parseMarkdownAnalysis(content) {
  if (typeof content !== "string" || !content.trim()) return null;
  const text = content.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const result = {
    essence: sectionLines(text, "岗位本质"),
    coreRequirements: sectionLines(text, "核心要求"),
    hiddenRequirements: sectionLines(text, "隐形要求"),
    idealCandidate: sectionLines(text, "理想候选人").slice(0, 1)
  };

  const hasRequiredContent = [
    result.essence,
    result.coreRequirements,
    result.idealCandidate
  ].every((list) => list.length > 0);

  return hasRequiredContent ? result : null;
}

function sectionLines(text, title) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?${escapedTitle}(?:\\*\\*)?\\s*[:：]?\\s*\\n?([\\s\\S]*?)(?=\\n\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?(?:岗位本质|核心要求|隐形要求|理想候选人)(?:\\*\\*)?\\s*[:：]?\\s*(?:\\n|$)|$)`);
  const match = text.match(pattern);
  if (!match) return [];

  return match[1]
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)、])\s*/, "").trim())
    .filter((line) => line && !/^格式[:：]?$/.test(line))
    .slice(0, 5);
}
