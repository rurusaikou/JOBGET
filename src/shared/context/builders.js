/**
 * AI Context 组装器。
 *
 * 每个任务只拿自己真正需要的信息。优先使用结构化摘要，必要时回退原文；
 * 超出预算直接报错，不静默截断，避免模型在缺失信息上做错误判断。
 */
import { MODEL_INPUT_LIMITS } from "../ai/token-limits.js";
import { reusableResumeProfile, taskDependencies } from "./cache.js";
import { getJobSummary } from "./summaries.js";
import { jobContent } from "./identity.js";

// 固定字段白名单：每次请求从本地资产重新组装，不附加其他岗位或模型对话历史。
export function buildTaskContext({ task, job, resume, tone = "natural", maxChars = 120 }) {
  const dependencies = taskDependencies(task, { job, resume, tone, maxChars });
  if (!dependencies) throw new Error("当前岗位、简历或匹配结果已失效，请重新分析。");
  let input;
  let modes;
  if (task === "deep_analysis") {
    input = jobContent(job);
    modes = { job: "raw", resume: "none" };
  } else if (task === "resume_match") {
    const jd = getJobSummary(job);
    const resumeProfile = reusableResumeProfile(resume);
    // Match 两侧都只消费已经完成的 Understanding 结果：Job Profile × Resume Profile。
    // Raw JD / Raw Resume 都不再作为正常 Match fallback，避免把理解职责重新塞给 low reasoning 的 Match。
    if (!jd.analysis?.coreRequirements.length || !jd.analysis?.essence.length) {
      throw new Error("岗位深度分析尚未完成，请稍后重试。");
    }
    if (!resumeProfile) {
      throw new Error("简历理解尚未完成，请稍后重试。");
    }
    const { usage: _usage, resultId: _resultId, version: _version, promptVersion: _promptVersion, sourceVersion: _sourceVersion, updatedAt: _updatedAt, ...profileFacts } = resumeProfile;
    input = {
      job: jd.facts,
      jobSummary: { ...jd.analysis, sourceEvidence: jd.sourceEvidence },
      resumeProfile: profileFacts,
      resumeMode: "AI Resume Profile（按简历版本缓存）"
    };
    modes = { job: "summary", resume: "profile" };
  } else if (task === "greeting") {
    const match = job.resumeMatch.result;
    // 匹配结果已经按重要性排序。开场白最多读取 3 个有效亮点，直接匹配优先，
    // 剩余位置再补充可迁移能力，避免把整份匹配结果重新塞进 Context。
    const directHighlights = (match.directMatches || [])
      .filter((item) => item.experience && item.proof)
      .map((item) => ({
        type: "直接匹配",
        requirement: item.requirement || "",
        experience: item.experience,
        evidence: item.proof,
        boundary: ""
      }));
    const transferableHighlights = (match.transferableMatches || [])
      .filter((item) => item.experience && item.ability)
      .map((item) => ({
        type: "可迁移能力",
        requirement: item.requirement || "",
        experience: item.experience,
        evidence: item.ability,
        boundary: item.boundary || "不得表述为直接经验"
      }));
    const highlights = [...directHighlights, ...transferableHighlights].slice(0, 3);
    input = {
      job: { title: job.title, company: job.company },
      highlights,
      toneLabel: ({ natural: "自然", professional: "专业", concise: "简洁", warm: "热情" })[tone] || "自然",
      maxChars: Number(maxChars) || 120
    };
    modes = { job: "identity", resume: "match-highlights" };
  } else {
    throw new Error(`不支持的任务：${task}`);
  }
  const inputChars = JSON.stringify(input).length;
  if (inputChars > MODEL_INPUT_LIMITS.contextChars) throw new Error("当前任务所需信息过长，请精简材料后重试；未截断输入。");
  return { task, dependencies, input, stats: { ...modes, inputChars } };
}

/**
 * Deep Analysis 的一次性 Retry Context。
 *
 * 第一次请求保留完整 JD；只有检测到输出截断 / JSON 不完整时才走这里。
 * Retry 不再调用额外模型做摘要，而是确定性压缩 JD：去重空白与重复段落，
 * 优先保留职责、要求、经验、技能、优先项等高信号段落，再按原顺序拼回。
 */
export function buildDeepAnalysisRetryContext(job) {
  const dependencies = taskDependencies("deep_analysis", { job });
  if (!dependencies) throw new Error("当前岗位已失效，请重新分析。");
  const raw = jobContent(job);
  const originalDescription = String(raw.description || "").trim();
  const description = compactJobDescription(
    originalDescription,
    MODEL_INPUT_LIMITS.deepAnalysisRetryDescriptionChars
  );
  const input = { ...raw, description };
  return {
    task: "deep_analysis",
    dependencies,
    input,
    stats: {
      job: "retry-compact",
      resume: "none",
      inputChars: JSON.stringify(input).length,
      originalDescriptionChars: originalDescription.length,
      compactDescriptionChars: description.length
    }
  };
}

function compactJobDescription(description, maxChars) {
  const normalized = String(description || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized.length <= maxChars) return normalized;

  const blocks = normalized
    .split(/\n+/)
    .map((text, index) => ({ text: text.trim(), index }))
    .filter((item) => item.text)
    .filter((item, index, list) => list.findIndex((candidate) => candidate.text === item.text) === index);

  const highSignal = /职责|任职|要求|资格|经验|能力|技能|优先|加分|负责|工作内容|岗位|学历|专业|产品|业务|数据|AI|模型|算法|研发|协作|沟通|指标|增长|用户/i;
  const scored = blocks.map((block) => ({
    ...block,
    score: (block.index < 4 ? 3 : 0) + (highSignal.test(block.text) ? 5 : 0) + (block.text.length <= 220 ? 1 : 0)
  }));

  const selected = [];
  let used = 0;
  for (const block of [...scored].sort((a, b) => b.score - a.score || a.index - b.index)) {
    const remaining = maxChars - used - (selected.length ? 1 : 0);
    if (remaining <= 0) break;
    const text = block.text.length <= remaining ? block.text : block.text.slice(0, remaining);
    if (!text) continue;
    selected.push({ ...block, text });
    used += text.length + (selected.length > 1 ? 1 : 0);
  }

  return selected.sort((a, b) => a.index - b.index).map((item) => item.text).join("\n").slice(0, maxChars);
}
