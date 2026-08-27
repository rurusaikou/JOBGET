import { attachJsonSchemaFormat, postResponses, validateModelSettings } from "../api/client.js";
import { compactText, MODEL_TOKEN_LIMITS } from "../api/token-limits.js";
import { DEEP_ANALYSIS_RESPONSE_SCHEMA, deepAnalysisMessages } from "../prompts/deep-analysis.js";
import { parseAnalysisResponse } from "./response.js";
import { validateJobForAnalysis } from "./result.js";

export async function analyzeJobWithAi(job, settings) {
  const validation = validateJobForAnalysis(job);
  if (!validation.ok) throw new Error(validation.message);
  validateModelSettings(settings);

  const requestBody = attachJsonSchemaFormat({
    model: settings.model.trim(),
    temperature: 0.2,
    max_tokens: MODEL_TOKEN_LIMITS.deepAnalysis.outputTokens,
    messages: deepAnalysisMessages(jobForDeepAnalysisPrompt(job))
  }, DEEP_ANALYSIS_RESPONSE_SCHEMA, "job_deep_analysis");

  const payload = await postResponses({
    label: "deep-analysis",
    settings,
    body: requestBody,
    errorPrefix: "分析失败"
  });
  return parseAnalysisResponse(payload);
}

function jobForDeepAnalysisPrompt(job) {
  return {
    ...job,
    description: compactText(job.description, MODEL_TOKEN_LIMITS.deepAnalysis.inputChars.jobDescription)
  };
}
