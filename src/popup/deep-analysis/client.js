import { postChatCompletions, supportsJsonResponseFormat, validateModelSettings } from "../llm.js";
import { deepAnalysisMessages } from "../prompts/deep-analysis.js";
import { parseAnalysisResponse } from "./response.js";
import { validateJobForAnalysis } from "./result.js";

export async function analyzeJobWithAi(job, settings) {
  const validation = validateJobForAnalysis(job);
  if (!validation.ok) throw new Error(validation.message);
  validateModelSettings(settings);

  const requestBody = {
    model: settings.model.trim(),
    temperature: 0.2,
    max_tokens: 2000,
    messages: deepAnalysisMessages(job)
  };

  if (supportsJsonResponseFormat(settings)) {
    requestBody.response_format = { type: "json_object" };
  }

  const payload = await postChatCompletions({
    label: "deep-analysis",
    settings,
    body: requestBody,
    errorPrefix: "分析失败"
  });
  return parseAnalysisResponse(payload);
}
