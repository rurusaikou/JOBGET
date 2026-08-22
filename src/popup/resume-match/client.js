import { resumeMatchMessages } from "../prompts/resume-match.js";
import { parseResumeMatchResponse } from "./response.js";

export async function analyzeResumeMatchWithAi({ job, resume, settings }) {
  validateResumeMatchInput(job, resume, settings);

  const requestBody = {
    model: settings.model.trim(),
    temperature: 0.2,
    max_tokens: 2600,
    messages: resumeMatchMessages({
      job,
      resumeText: resumeToPromptText(resume),
      jdAnalysisText: jdAnalysisToText(job.deepAnalysis)
    })
  };

  if (supportsJsonResponseFormat(settings)) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch(chatCompletionsUrl(settings.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey.trim()}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message ? `分析失败：${message.slice(0, 120)}` : "分析失败：API 调用失败。");
  }

  return parseResumeMatchResponse(await response.json());
}

function validateResumeMatchInput(job, resume, settings) {
  if (!job || !String(job.description || "").trim()) throw new Error("当前 JD 内容为空，无法进行简历匹配分析。");
  if (!resume) throw new Error("请先上传并结构化简历。");
  if (!settings.apiKey || settings.apiKey.trim().length < 12) throw new Error("请先在 API 设置中填写有效的 API Key。");
  if (!settings.baseUrl || !/^https:\/\//i.test(settings.baseUrl)) throw new Error("请先在 API 设置中填写 https:// 开头的 Base URL。");
  if (!settings.model || !settings.model.trim()) throw new Error("请先在 API 设置中填写模型名称。");
}

function resumeToPromptText(resume) {
  const basic = resume.basicInfo || {};
  const linesForPrompt = [];
  appendValue(linesForPrompt, "姓名", basic.name);
  appendValue(linesForPrompt, "求职意向", basic.jobIntent);
  appendValue(linesForPrompt, "所在地", basic.location);
  appendValue(linesForPrompt, "手机", basic.phone);
  appendValue(linesForPrompt, "邮箱", basic.email);
  appendSection(linesForPrompt, "教育经历", resume.education, (item) => [
    [item.startDate, item.endDate].filter(Boolean).join("-"),
    item.school,
    item.degree,
    item.major,
    lines(item.description).join("；")
  ].filter(Boolean).join(" "));
  appendSection(linesForPrompt, "工作经历", resume.workExperience, (item) => [
    [item.startDate, item.endDate].filter(Boolean).join("-"),
    item.organization,
    item.role,
    lines(item.description).join("；")
  ].filter(Boolean).join(" "));
  appendSection(linesForPrompt, "项目经历", resume.projects, (item) => [
    [item.startDate, item.endDate].filter(Boolean).join("-"),
    item.name,
    item.role,
    lines(item.description).join("；")
  ].filter(Boolean).join(" "));
  appendList(linesForPrompt, "技能 / 能力", resume.skills);
  appendList(linesForPrompt, "证书 / 荣誉", resume.certifications);
  appendValue(linesForPrompt, "自我评价", resume.selfEvaluation);
  return linesForPrompt.join("\n");
}

function appendValue(target, label, value) {
  if (value) target.push(`${label}：${value}`);
}

function appendSection(target, title, entries, renderEntry) {
  const rows = (entries || []).map(renderEntry).filter(Boolean);
  if (!rows.length) return;
  target.push(`${title}：`, ...rows.map((row) => `- ${row}`));
}

function appendList(target, title, items) {
  if (items && items.length) target.push(`${title}：${items.join("、")}`);
}

function lines(value) {
  return Array.isArray(value) ? value : [value].filter(Boolean);
}

function jdAnalysisToText(analysis) {
  if (!analysis) return "";
  return [
    analysis.essence && analysis.essence.length ? `岗位本质：${analysis.essence.join("、")}` : "",
    analysis.coreRequirements && analysis.coreRequirements.length ? `核心要求：${analysis.coreRequirements.join("、")}` : "",
    analysis.hiddenRequirements && analysis.hiddenRequirements.length ? `隐形要求：${analysis.hiddenRequirements.join("、")}` : "",
    analysis.idealCandidate && analysis.idealCandidate.length ? `理想候选人：${analysis.idealCandidate.join("、")}` : ""
  ].filter(Boolean).join("\n");
}

function chatCompletionsUrl(baseUrl) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return /\/chat\/completions$/i.test(trimmed) ? trimmed : `${trimmed}/chat/completions`;
}

function supportsJsonResponseFormat(settings) {
  const provider = String(settings.provider || "").toLowerCase();
  const baseUrl = String(settings.baseUrl || "").toLowerCase();
  return provider === "openai" || baseUrl.includes("api.openai.com");
}
