import { extractResponseContent } from "../api/response.js";

const ALLOWED_LEVELS = ["中高匹配", "中低匹配", "高匹配", "中匹配", "低匹配"];
const FORMAT_ERROR = "分析失败：模型返回格式异常。请点击“重新分析”再次尝试。";
const REASONING_LEAK_ERROR = "分析失败：模型返回了推理过程而不是 JSON。请更换非推理模型，或使用支持 JSON 输出的模型后重试。";

export function parseResumeMatchResponse(payload) {
  const content = extractResponseContent(payload);
  if (!content) throw new Error("分析失败：模型返回为空。");
  return normalizeResumeMatch(parseResumeMatchContent(content));
}

function normalizeResumeMatch(result) {
  const normalized = {
    level: normalizeLevel(result.level),
    reason: cleanText(result.reason),
    directMatches: normalizeDirectMatches(result.directMatches).slice(0, 6),
    transferableMatches: normalizeTransferableMatches(result.transferableMatches).slice(0, 5),
    gaps: normalizeGaps(result.gaps).slice(0, 5),
    revisions: normalizeRevisionBlocks(result.revisions).slice(0, 5),
    rawText: result.rawText
  };

  const hasUsefulContent = normalized.reason
    || normalized.directMatches.length
    || normalized.transferableMatches.length
    || normalized.gaps.length
    || normalized.revisions.length;
  if (!hasUsefulContent) throw new Error(FORMAT_ERROR);

  return normalized;
}

function parseResumeMatchContent(content) {
  try {
    return parseJsonResumeMatch(content);
  } catch (_error) {
    if (looksLikeReasoningLeak(content)) throw new Error(REASONING_LEAK_ERROR);
    throw new Error(FORMAT_ERROR);
  }
}

function parseJsonResumeMatch(content) {
  const data = unwrapResultObject(parseJsonContent(content));
  // 兼容模型把总体匹配压成一句话的情况，例如“中低匹配｜缺少 ToB 产品经验”。
  const overallValue = data.overall || data["总体匹配"];
  const overall = firstObject(overallValue);
  const overallText = typeof overallValue === "string" ? overallValue : "";
  return {
    level: pickField(overall, ["level", "匹配等级", "等级"]) || pickField(data, ["level", "匹配等级", "等级"]) || extractLevel(overallText),
    reason: pickField(overall, ["reason", "原因", "说明", "主要原因"]) || pickField(data, ["reason", "原因", "说明", "主要原因"]) || stripLevel(overallText),
    directMatches: normalizeObjectList(data.directMatches || data["直接匹配"]),
    transferableMatches: normalizeObjectList(data.transferableMatches || data["可迁移能力"] || data["可迁移匹配"]),
    gaps: normalizeObjectList(data.gaps || data["关键缺口"] || data["真实缺口"]),
    revisions: normalizeObjectList(data.revisions || data["简历修改建议"] || data["修改建议"]),
    rawText: content
  };
}

function parseJsonContent(content) {
  if (typeof content !== "string" || !content.trim()) throw new Error("empty");
  const trimmed = content.trim().replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  try {
    return normalizeParsedJson(JSON.parse(trimmed));
  } catch (_error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("not json");
    return normalizeParsedJson(JSON.parse(match[0]));
  }
}

function normalizeParsedJson(value) {
  if (typeof value === "string") return parseJsonContent(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not object");
  return value;
}

function unwrapResultObject(value) {
  // 部分兼容接口会额外包一层 result/data/analysis，这里只剥离明确的对象包装。
  const wrapped = firstObject(value.result, value.data, value.analysis, value["分析结果"], value["匹配分析"]);
  return Object.keys(wrapped).length ? wrapped : value;
}

function normalizeObjectList(value) {
  if (Array.isArray(value)) {
    // 结构化输出偶尔仍会出现字符串数组；字符串用后续的“｜”切分兜底。
    return value.map((item) => {
      if (item && typeof item === "object") return item;
      if (typeof item === "string") return { text: item };
      return null;
    }).filter(Boolean);
  }
  if (typeof value === "string") return value.split(/\n+/).map((line) => ({ text: line.trim() })).filter((item) => item.text);
  return [];
}

function normalizeRevisionBlocks(items) {
  return normalizeObjectList(items).map((item) => ({
    summary: cleanText(pickField(item, ["summary", "总述", "目的", "修改目的"]) || textPart(item.text, 0)),
    original: cleanText(pickField(item, ["original", "原内容"]) || textPart(item.text, 1)),
    direction: cleanText(pickField(item, ["direction", "建议方向"]) || textPart(item.text, 2)),
    rewrite: cleanText(pickField(item, ["rewrite", "可改为", "建议改写"]) || textPart(item.text, 3))
  })).filter(hasAnyValue);
}

function normalizeDirectMatches(items) {
  return normalizeObjectList(items).map((item) => ({
    requirement: cleanText(pickField(item, ["requirement", "对应岗位要求", "岗位要求"]) || textPart(item.text, 0)),
    experience: cleanText(pickField(item, ["experience", "现有经历", "简历经历"]) || textPart(item.text, 1)),
    proof: cleanText(pickField(item, ["proof", "证明点", "证据"]) || textPart(item.text, 2))
  })).filter(hasAnyValue);
}

function normalizeTransferableMatches(items) {
  return normalizeObjectList(items).map((item) => ({
    requirement: cleanText(pickField(item, ["requirement", "岗位要求", "对应岗位要求"]) || textPart(item.text, 0)),
    experience: cleanText(pickField(item, ["experience", "现有经历", "简历经历"]) || textPart(item.text, 1)),
    ability: cleanText(pickField(item, ["ability", "可迁移能力", "迁移能力"]) || textPart(item.text, 2)),
    boundary: cleanText(pickField(item, ["boundary", "迁移边界", "边界"]) || textPart(item.text, 3))
  })).filter(hasAnyValue);
}

function normalizeGaps(items) {
  return normalizeObjectList(items).map((item) => ({
    gap: cleanText(pickField(item, ["gap", "缺口", "真实缺口"]) || textPart(item.text, 0)),
    impact: cleanText(pickField(item, ["impact", "对投递的影响", "影响"]) || textPart(item.text, 1))
  })).filter(hasAnyValue);
}

function hasAnyValue(item) {
  return Object.values(item).some(Boolean);
}

function normalizeLevel(value) {
  const levelText = cleanText(value);
  const level = extractLevel(levelText);
  if (!level) throw new Error(FORMAT_ERROR);
  return level;
}

function extractLevel(text) {
  const levelText = cleanText(text);
  return ALLOWED_LEVELS.find((item) => levelText.includes(item)) || "";
}

function stripLevel(text) {
  return cleanText(text).replace(extractLevel(text), "").replace(/^[：:｜|\-\s]+/, "");
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
}

function pickField(source, keys) {
  if (!source || typeof source !== "object") return "";
  const key = keys.find((item) => source[item] !== undefined && source[item] !== null);
  return key ? source[key] : "";
}

function textPart(text, index) {
  if (!text) return "";
  return String(text).split(/\s*[｜|]\s*/)[index] || "";
}

function cleanText(value) {
  return stripLeakedReasoning(String(value || "").replace(/\s+/g, " ").trim());
}

function stripLeakedReasoning(text) {
  const leakedPattern = /(?:但是要小心|我不能|用户说|用户明确说|现在思考|输出结构|我需要|也许|哦，|这太单薄|条数和字数|需要控制在|prompt|规划：)/;
  const cleaned = String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .trim();
  const match = cleaned.search(leakedPattern);
  return (match >= 0 ? cleaned.slice(0, match) : cleaned).trim();
}

function looksLikeReasoningLeak(content) {
  return /(?:我们只需要输出严格 JSON|需要分析|先看简历内容|整体匹配度|输出格式要求|我们来构造|注意：不能虚构|直接匹配：|可迁移能力：|关键缺口：|简历修改建议：)/.test(String(content || ""));
}
