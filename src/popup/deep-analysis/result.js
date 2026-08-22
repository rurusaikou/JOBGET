export const MAX_JD_ANALYSIS_LENGTH = 10000;

export function validateJobForAnalysis(job) {
  const description = String(job && job.description || "").trim();
  const compact = description.replace(/\s+/g, "");

  if (!description) return { ok: false, message: "JD 内容为空，未发起分析。" };
  if (description.length > MAX_JD_ANALYSIS_LENGTH) return { ok: false, message: "JD 内容超过 10000 字，未发起分析。" };
  if (compact.length < 20) return { ok: false, message: "JD 内容异常，未发起分析。" };
  if (/^(暂无|无|未识别|undefined|null|-)+$/i.test(compact)) return { ok: false, message: "JD 内容异常，未发起分析。" };

  return { ok: true, message: "" };
}

export function normalizeStoredDeepAnalysis(analysis) {
  if (!analysis || typeof analysis !== "object") return null;
  return {
    essence: normalizeList(analysis.essence),
    coreRequirements: normalizeList(analysis.coreRequirements),
    hiddenRequirements: normalizeList(analysis.hiddenRequirements),
    idealCandidate: normalizeList(analysis.idealCandidate),
    updatedAt: analysis.updatedAt || ""
  };
}

export function normalizeAiAnalysis(data) {
  const result = normalizeStoredDeepAnalysis({
    essence: data.essence || data["岗位本质"],
    coreRequirements: data.coreRequirements || data["核心要求"],
    hiddenRequirements: data.hiddenRequirements || data["隐形要求"],
    idealCandidate: data.idealCandidate || data["理想候选人"],
    updatedAt: new Date().toISOString()
  });

  // 隐形要求允许证据不足时为空；其余三个模块缺失会让页面无法成立。
  const hasRequiredContent = [
    result.essence,
    result.coreRequirements,
    result.idealCandidate
  ].every((list) => list.length > 0);

  if (!hasRequiredContent) throw new Error("分析失败：模型返回内容不完整。");
  return result;
}

function normalizeList(value) {
  const list = Array.isArray(value) ? value : [value].filter(Boolean);
  return list
    .map((item) => String(item || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 5);
}
