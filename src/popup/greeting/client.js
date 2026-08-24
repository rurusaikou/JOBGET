import { logApiError } from "../api/debug.js";
import { jdAnalysisToText } from "../deep-analysis/prompt-text.js";
import { attachJsonSchemaFormat, postResponses, validateModelSettings } from "../api/client.js";
import { extractResponseContent } from "../api/response.js";
import { GREETING_RESPONSE_SCHEMA, greetingMessages } from "../prompts/greeting.js";
import { parseGreetingResponse } from "./response.js";

export async function generateGreetingWithAi({ job, resume, matchResult, tone, maxChars, settings }) {
  validateGreetingInput(job, resume, matchResult, settings);

  const requestBody = attachJsonSchemaFormat({
    model: settings.model.trim(),
    temperature: 0.45,
    max_tokens: Math.max(2500, Number(maxChars) * 12),
    messages: greetingMessages({
      job,
      jdAnalysisText: compactText(jdAnalysisToText(job.deepAnalysis), 500),
      resumeText: resumeEvidenceToText(resume, matchResult),
      matchText: matchResultToText(matchResult),
      toneLabel: toneLabel(tone),
      maxChars
    })
  }, GREETING_RESPONSE_SCHEMA, "job_application_greeting");

  const payload = await postResponses({
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
  appendMatches(lines, "避免夸大的缺口", matchResult.gaps, (item) => [
    item.gap,
    item.impact
  ], 2);
  return compactText(lines.join("\n"), 900);
}

function resumeEvidenceToText(resume, matchResult) {
  const basic = resume && resume.basicInfo ? resume.basicInfo : {};
  const lines = [];
  if (basic.name) lines.push(`姓名：${basic.name}`);
  appendMatches(lines, "可使用的简历证据", [
    ...(matchResult.directMatches || []),
    ...(matchResult.transferableMatches || [])
  ], (item) => [
    item.experience,
    item.proof || item.ability
  ], 4);
  return compactText(lines.join("\n"), 700);
}

function appendMatches(lines, title, items, renderParts, limit = 3) {
  const rows = (items || []).slice(0, limit).map((item) => renderParts(item).filter(Boolean).join("｜")).filter(Boolean);
  if (rows.length) lines.push(`${title}：`, ...rows.map((row) => `- ${row}`));
}

function compactText(text, maxLength) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
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
