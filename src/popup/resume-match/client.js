import { logApiError } from "../api/debug.js";
import { jdAnalysisToText } from "../deep-analysis/prompt-text.js";
import { attachJsonSchemaFormat, postResponses, validateModelSettings } from "../api/client.js";
import { extractResponseContent } from "../api/response.js";
import { RESUME_MATCH_RESPONSE_SCHEMA, resumeMatchMessages } from "../prompts/resume-match.js";
import { resumeToPromptText } from "../resume/prompt.js";
import { parseResumeMatchResponse } from "./response.js";

export async function analyzeResumeMatchWithAi({ job, resume, settings }) {
  validateResumeMatchInput(job, resume, settings);

  const requestBody = attachJsonSchemaFormat({
    model: settings.model.trim(),
    temperature: 0.2,
    max_tokens: 7000,
    messages: resumeMatchMessages({
      job,
      resumeText: resumeToPromptText(resume),
      jdAnalysisText: jdAnalysisToText(job.deepAnalysis)
    })
  }, RESUME_MATCH_RESPONSE_SCHEMA, "resume_match_analysis");

  const payload = await postResponses({
    label: "resume-match",
    settings,
    body: requestBody,
    errorPrefix: "分析失败"
  });
  try {
    return parseResumeMatchResponse(payload);
  } catch (error) {
    logApiError("resume-match-parse", {
      message: error.message,
      content: extractResponseContent(payload)
    });
    throw error;
  }
}

function validateResumeMatchInput(job, resume, settings) {
  if (!job || !String(job.description || "").trim()) throw new Error("当前 JD 内容为空，无法进行简历匹配分析。");
  if (!resume) throw new Error("请先上传并结构化简历。");
  validateModelSettings(settings);
}
