const ALLOWED_LEVELS = ["高匹配", "中高匹配", "中匹配", "中低匹配", "低匹配"];
const FORMAT_ERROR = "分析失败：模型返回格式异常。请点击“重新分析”再次尝试。";

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
    throw new Error(FORMAT_ERROR);
  }
}

function parseJsonResumeMatch(content) {
  const data = parseJsonContent(content);
  return {
    level: data.overall && data.overall.level || data.level || "",
    reason: data.overall && data.overall.reason || data.reason || "",
    directMatches: normalizeObjectList(data.directMatches),
    transferableMatches: normalizeObjectList(data.transferableMatches),
    gaps: normalizeObjectList(data.gaps),
    revisions: normalizeObjectList(data.revisions),
    rawText: content
  };
}

function parseJsonContent(content) {
  if (typeof content !== "string" || !content.trim()) throw new Error("empty");
  const trimmed = content.trim().replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("not json");
    return JSON.parse(match[0]);
  }
}

function normalizeObjectList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function normalizeRevisionBlocks(items) {
  return normalizeObjectList(items).map((item) => ({
    summary: cleanText(item.summary),
    original: cleanText(item.original),
    direction: cleanText(item.direction),
    rewrite: cleanText(item.rewrite)
  })).filter(hasAnyValue);
}

function normalizeDirectMatches(items) {
  return normalizeObjectList(items).map((item) => ({
    requirement: cleanText(item.requirement),
    experience: cleanText(item.experience),
    proof: cleanText(item.proof)
  })).filter(hasAnyValue);
}

function normalizeTransferableMatches(items) {
  return normalizeObjectList(items).map((item) => ({
    requirement: cleanText(item.requirement),
    experience: cleanText(item.experience),
    ability: cleanText(item.ability),
    boundary: cleanText(item.boundary)
  })).filter(hasAnyValue);
}

function normalizeGaps(items) {
  return normalizeObjectList(items).map((item) => ({
    gap: cleanText(item.gap),
    impact: cleanText(item.impact)
  })).filter(hasAnyValue);
}

function hasAnyValue(item) {
  return Object.values(item).some(Boolean);
}

function normalizeLevel(value) {
  const level = cleanText(value);
  if (!ALLOWED_LEVELS.includes(level)) throw new Error(FORMAT_ERROR);
  return level;
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

function extractResponseContent(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.output_text === "string") return payload.output_text.trim();

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
    return payload.output.map((item) => contentToText(item && item.content)).filter(Boolean).join("\n").trim();
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
