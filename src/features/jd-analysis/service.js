/**
 * JD 深度分析服务。
 *
 * 第一次请求保留完整 JD + medium reasoning；只有检测到 max_output_tokens 或
 * 最终 JSON 不完整时，才自动 Retry 一次。Retry 仍保持 medium reasoning，
 * 但使用更紧凑的 JD Context 与更高 output budget。
 */
import { buildDeepAnalysisRetryContext, buildTaskContext } from "../../shared/context/builders.js";
import { attachJsonSchemaFormat, postResponses, validateModelSettings } from "../../shared/ai/client.js";
import {
  logDeepAnalysisAttemptFailure,
  recordDeepAnalysisReliability
} from "../../shared/ai/debug.js";
import { isDeepAnalysisRetryableError } from "../../shared/ai/errors.js";
import { extractTokenUsage } from "../../shared/ai/response.js";
import { MODEL_REASONING_EFFORT, MODEL_TOKEN_LIMITS } from "../../shared/ai/token-limits.js";
import { DEEP_ANALYSIS_RESPONSE_SCHEMA, deepAnalysisMessages } from "./prompt.js";
import { parseAnalysisResponse } from "./response.js";
import { validateJobForAnalysis } from "./result.js";

export async function analyzeJobWithAi(job, settings, context = buildTaskContext({ task: "deep_analysis", job })) {
  const validation = validateJobForAnalysis(job);
  if (!validation.ok) throw new Error(validation.message);
  validateModelSettings(settings);

  recordDeepAnalysisReliability("firstAttempt");
  try {
    return await runAttempt({
      label: "deep-analysis:first",
      settings,
      context,
      outputTokens: MODEL_TOKEN_LIMITS.deepAnalysis.outputTokens,
      attempt: 1
    });
  } catch (error) {
    logDeepAnalysisAttemptFailure("first", error, {
      inputChars: context.stats?.inputChars || 0,
      outputBudget: MODEL_TOKEN_LIMITS.deepAnalysis.outputTokens,
      reasoning: MODEL_REASONING_EFFORT.deepAnalysis
    });
    if (!isDeepAnalysisRetryableError(error)) {
      recordDeepAnalysisReliability("finalFailure");
      throw error;
    }

    // 自动重试只发生一次，并且只针对“结果没完整生成”这一类可恢复错误。
    recordDeepAnalysisReliability("retry");
    const retryContext = buildDeepAnalysisRetryContext(job);
    try {
      const result = await runAttempt({
        label: "deep-analysis:retry",
        settings,
        context: retryContext,
        outputTokens: MODEL_TOKEN_LIMITS.deepAnalysis.retryOutputTokens,
        attempt: 2
      });
      return {
        ...result,
        reliability: {
          attempts: 2,
          retried: true,
          firstFailureCode: error.code || error.name || "unknown",
          firstFailureReason: error.reason || "unknown",
          firstInputChars: context.stats?.inputChars || 0,
          retryInputChars: retryContext.stats?.inputChars || 0
        }
      };
    } catch (retryError) {
      recordDeepAnalysisReliability("finalFailure");
      logDeepAnalysisAttemptFailure("retry", retryError, {
        inputChars: retryContext.stats?.inputChars || 0,
        originalDescriptionChars: retryContext.stats?.originalDescriptionChars || 0,
        compactDescriptionChars: retryContext.stats?.compactDescriptionChars || 0,
        outputBudget: MODEL_TOKEN_LIMITS.deepAnalysis.retryOutputTokens,
        reasoning: MODEL_REASONING_EFFORT.deepAnalysis
      });
      throw retryError;
    }
  }
}

async function runAttempt({ label, settings, context, outputTokens, attempt }) {
  const requestBody = attachJsonSchemaFormat({
    model: settings.model.trim(),
    temperature: 0.2,
    reasoning_effort: MODEL_REASONING_EFFORT.deepAnalysis,
    max_tokens: outputTokens,
    messages: deepAnalysisMessages(context.input)
  }, DEEP_ANALYSIS_RESPONSE_SCHEMA, "job_deep_analysis");

  const payload = await postResponses({
    label,
    settings,
    body: requestBody,
    errorPrefix: "分析失败"
  });
  return {
    ...parseAnalysisResponse(payload),
    usage: extractTokenUsage(payload),
    reliability: {
      attempts: attempt,
      retried: attempt > 1,
      inputChars: context.stats?.inputChars || 0
    }
  };
}
