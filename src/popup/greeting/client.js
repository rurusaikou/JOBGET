import { logApiError } from "../api-debug.js";
import { jdAnalysisToText } from "../deep-analysis/prompt-text.js";
import { postChatCompletions, supportsJsonResponseFormat, validateModelSettings } from "../llm.js";
import { extractResponseContent } from "../llm-response.js";
import { greetingMessages } from "../prompts/greeting.js";
import { resumeToPromptText } from "../resume/prompt.js";
import { parseGreetingResponse } from "./response.js";

export async function generateGreetingWithAi({ job, resume, matchResult, tone, maxChars, settings }) {
  validateGreetingInput(job, resume, matchResult, settings);

  const requestBody = {
    model: settings.model.trim(),
    temperature: 0.45,
    max_tokens: Math.max(220, Number(maxChars) * 3),
    messages: greetingMessages({
      job,
      jdAnalysisText: jdAnalysisToText(job.deepAnalysis),
      resumeText: resumeToPromptText(resume),
      matchText: matchResultToText(matchResult),
      toneLabel: toneLabel(tone),
      maxChars
    })
  };

  if (supportsJsonResponseFormat(settings)) {
    requestBody.response_format = { type: "json_object" };
  }

  const payload = await postChatCompletions({
    label: "greeting",
    settings,
    body: requestBody,
    errorPrefix: "生成失败"
  });
  try {
    return parseGreetingResponse(payload, maxChars);
  } catch (error) {
    logApiError("greeting-parse", {
      message: error.message,
      content: extractResponseContent(payload)
    });
    throw error;
  }
}

function validateGreetingInput(job, resume, matchResult, settings) {
  if (!job || !String(job.description || "").trim()) throw new Error("当前 JD 内容为空，无法生成求职开场白。");
  if (!resume) throw new Error("请先上传并结构化简历。");
  if (!matchResult) throw new Error("请先完成简历与 JD 匹配分析。");
  validateModelSettings(settings);
}

function matchResultToText(matchResult) {
  const lines = [];
  if (matchResult.level || matchResult.reason) {
    lines.push(`总体匹配：${[matchResult.level, matchResult.reason].filter(Boolean).join("，")}`);
  }
  appendMatches(lines, "直接匹配", matchResult.directMatches, (item) => [
    item.requirement,
    item.experience,
    item.proof
  ]);
  appendMatches(lines, "可迁移能力", matchResult.transferableMatches, (item) => [
    item.requirement,
    item.experience,
    item.ability
  ]);
  appendMatches(lines, "关键缺口", matchResult.gaps, (item) => [
    item.gap,
    item.impact
  ]);
  return lines.join("\n");
}

function appendMatches(lines, title, items, renderParts) {
  const rows = (items || []).slice(0, 3).map((item) => renderParts(item).filter(Boolean).join("｜")).filter(Boolean);
  if (rows.length) lines.push(`${title}：`, ...rows.map((row) => `- ${row}`));
}

function toneLabel(tone) {
  const labels = {
    natural: "自然",
    professional: "专业",
    concise: "简洁",
    warm: "热情"
  };
  return labels[tone] || labels.natural;
}
