import { qs } from "../dom.js";
import { structureResumeText } from "./extractor.js";
import { parseResumeFile } from "./parser.js";
import { clearResume, getResume, setResume } from "./storage.js";

const EMPTY_RESUME_MESSAGE = "当前还没有简历。上传 PDF / DOCX 后，会在本地提取内容并用于匹配分析。";

export async function handleResumeFile(state, file, callbacks) {
  const input = qs("#resumeFile");
  qs("#resumeStatus").textContent = `正在解析：${file.name}...`;
  input.disabled = true;

  try {
    const parsed = await parseResumeFile(file);
    const resume = structureResumeText(parsed.text, {
      fileName: file.name,
      fileType: parsed.fileType
    });
    state.resume = await setResume(resume);
    markResumeReady(state, file.name, callbacks);
  } catch (error) {
    state.resumeUploaded = Boolean(state.resume);
    qs("#resumeStatus").textContent = error.message || "简历解析失败，请换一个 PDF 或 DOCX 文件。";
    callbacks.updateMatchState();
  } finally {
    input.disabled = false;
    input.value = "";
  }
}

export async function useExampleResume(state, callbacks) {
  const resume = structureResumeText(exampleResumeText(), {
    fileName: "示例简历.pdf",
    fileType: "example"
  });
  state.resume = await setResume(resume);
  markResumeReady(state, "示例简历.pdf", callbacks);
}

export async function restoreResume(state, callbacks) {
  state.resume = await getResume();
  if (!state.resume) {
    renderEmptyResume();
    callbacks.updateMatchState();
    return;
  }

  state.resumeUploaded = true;
  qs("#resumeStatus").textContent = parsedResumeStatus(
    state.resume.source && state.resume.source.fileName ? state.resume.source.fileName : "本地简历",
    state.resume
  );
  callbacks.updateMatchState();
}

export async function clearCurrentResume(state, callbacks) {
  state.resume = await clearResume();
  state.resumeUploaded = false;
  renderEmptyResume();
  callbacks.updateMatchState();
  callbacks.setStep("match");
}

function markResumeReady(state, label, callbacks) {
  state.resumeUploaded = true;
  qs("#resumeStatus").textContent = parsedResumeStatus(label, state.resume);
  callbacks.updateMatchState();
  setTimeout(() => callbacks.setStep("match"), 300);
}

function parsedResumeStatus(label, resume) {
  const length = String(resume && resume.rawText || "").length;
  const suffix = length ? `共提取 ${length} 字，` : "";
  return `已解析：${label}。${suffix}可继续用于匹配分析。`;
}

function renderEmptyResume() {
  qs("#resumeStatus").textContent = EMPTY_RESUME_MESSAGE;
}

function exampleResumeText() {
  return [
    "陆阳",
    "AI 产品经理 深圳 luyang@example.com 13800000000",
    "求职意向：产品经理",
    "教育经历",
    "2022.09-2024.07 天津大学 计算机技术 硕士",
    "项目经历",
    "2023.03-2024.01 企业知识库产品 产品负责人",
    "负责企业知识库产品 0 到 1 的规划设计，完成用户调研、需求拆解、RAG 能力接入与效果评估。",
    "协同算法和研发团队推动上线，月活提升 40%，企业客户续费率提升 25%。",
    "技能特长",
    "需求分析、用户调研、项目管理、数据分析、跨团队协作"
  ].join("\n");
}
