/**
 * 人岗匹配服务：只负责 Match，不负责生成简历修改建议。
 * 请求格式兼容、错误处理统一交给 shared/ai/client.js。
 */
import { logApiError } from "../../shared/ai/debug.js";
import { buildTaskContext } from "../../shared/context/builders.js";
import { attachJsonSchemaFormat, postResponses, validateModelSettings } from "../../shared/ai/client.js";
import { extractResponseContent, extractTokenUsage } from "../../shared/ai/response.js";
import { MODEL_INPUT_LIMITS, MODEL_REASONING_EFFORT, MODEL_TOKEN_LIMITS } from "../../shared/ai/token-limits.js";
import { RESUME_MATCH_RESPONSE_SCHEMA, resumeMatchMessages } from "./prompt.js";
import { parseResumeMatchResponse } from "./response.js";

// 只负责“匹配分析”。修改建议是独立的 resume-revision 任务，拥有自己的 UI 状态机。
export async function analyzeResumeMatchWithAi({ job, resume, settings, context = buildTaskContext({ task: "resume_match", job, resume }) }) {
  validateResumeMatchInput(job, resume, settings, context);

  const requestBody = attachJsonSchemaFormat({
    model: settings.model.trim(),
    temperature: 0.2,
    reasoning_effort: MODEL_REASONING_EFFORT.resumeMatch,
    max_tokens: MODEL_TOKEN_LIMITS.resumeMatch.outputTokens,
    messages: resumeMatchMessages(context.input)
  }, RESUME_MATCH_RESPONSE_SCHEMA, "resume_match_analysis");

  const payload = await postResponses({
    label: "resume-match",
    settings,
    body: requestBody,
    errorPrefix: "分析失败"
  });
  try {
    return {
      ...parseResumeMatchResponse(payload),
      revisions: [],
      revisionError: null,
      usage: extractTokenUsage(payload)
    };
  } catch (error) {
    logApiError("resume-match-parse", {
      message: error.message,
      content: extractResponseContent(payload)
    });
    throw error;
  }
}

function validateResumeMatchInput(job, resume, settings, context) {
  const jdLength = String(job && job.description || "").trim().length;
  if (!job || !jdLength) throw new Error("当前 JD 内容为空，无法进行简历匹配分析。");
  if (context.stats.job === "raw" && jdLength > MODEL_INPUT_LIMITS.jobDescriptionChars) throw new Error("当前 JD 内容超过 5000 字，无法进行简历匹配分析。");
  if (!resume?.profile || context.stats.resume !== "profile") throw new Error("请先完成简历理解，再进行匹配分析。");
  validateModelSettings(settings);
}
