import { qs } from "../../shared/ui/dom.js";
import { structureResumeText } from "./extractor.js";
import { parseResumeFile } from "./parser.js";
import { reusableResumeProfile } from "../../shared/context/cache.js";
import { clearResume, getResume, setResume } from "./storage.js";

const EMPTY_RESUME_MESSAGE = "当前还没有简历。上传 PDF / DOCX 后，会在本地提取内容并用于匹配分析。";

// 返回 true 只表示本地解析及保存成功；Controller 随后启动 Resume Understanding，不自动 Match。
export async function handleResumeFile(state, file, callbacks) {
  const input = qs("#resumeFile");
  qs("#resumeStatus").textContent = `正在解析：${file.name}...`;
  input.disabled = true;
  state.resumeState.parsing = true;
  state.resumeState.profileError = null;
  qs("#exampleResumeBtn").disabled = true;
  callbacks.updateMatchState();

  try {
    const parsed = await parseResumeFile(file);
    const resume = structureResumeText(parsed.text, {
      fileName: file.name,
      fileType: parsed.fileType
    });
    state.resumeState.data = await setResume(resume);
    markResumeReady(state, file.name, callbacks);
    return true;
  } catch (error) {
    state.resumeState.uploaded = Boolean(state.resumeState.data);
    qs("#resumeStatus").textContent = error.message || "简历解析失败，请换一个 PDF 或 DOCX 文件。";
    callbacks.updateMatchState();
    return false;
  } finally {
    input.disabled = false;
    // 清空文件选择，让用户再次选择同一个文件时仍能触发 change。
    input.value = "";
    state.resumeState.parsing = false;
    qs("#exampleResumeBtn").disabled = false;
    callbacks.updateMatchState();
  }
}

export async function useExampleResume(state, callbacks) {
  state.resumeState.parsing = true;
  qs("#resumeFile").disabled = true;
  qs("#exampleResumeBtn").disabled = true;
  callbacks.updateMatchState();
  try {
    const resume = structureResumeText(exampleResumeText(), {
      fileName: "示例简历.pdf",
      fileType: "example"
    });
    state.resumeState.data = await setResume(resume);
    markResumeReady(state, "示例简历.pdf", callbacks);
    return true;
  } catch (error) {
    qs("#resumeStatus").textContent = error.message || "示例简历保存失败，请重试。";
    return false;
  } finally {
    state.resumeState.parsing = false;
    qs("#resumeFile").disabled = false;
    qs("#exampleResumeBtn").disabled = false;
    callbacks.updateMatchState();
  }
}

// 恢复时只加载本地简历；失效或缺失的 Profile 留待用户发起 Match 时补齐。
export async function restoreResume(state, callbacks) {
  state.resumeState.data = await getResume();
  if (!state.resumeState.data) {
    renderEmptyResume();
    callbacks.updateMatchState();
    return;
  }

  state.resumeState.uploaded = true;
  renderResumeStatus(state);
  callbacks.updateMatchState();
}

export async function clearCurrentResume(state, callbacks) {
  state.resumeState.parsing = true;
  qs("#resumeFile").disabled = true;
  qs("#exampleResumeBtn").disabled = true;
  callbacks.updateMatchState();
  try {
    state.resumeState.data = await clearResume();
    state.resumeState.uploaded = false;
    state.resumeState.understanding = false;
    state.resumeState.profileError = null;
    renderEmptyResume();
    callbacks.setStep("match");
  } catch (error) {
    qs("#resumeStatus").textContent = error.message || "清除简历失败，请重试。";
  } finally {
    state.resumeState.parsing = false;
    qs("#resumeFile").disabled = false;
    qs("#exampleResumeBtn").disabled = false;
    callbacks.updateMatchState();
  }
}

export function renderResumeStatus(state) {
  const resume = state.resumeState.data;
  if (!resume) {
    renderEmptyResume();
    return;
  }
  const label = resume.source?.fileName || "本地简历";
  const length = String(resume.rawText || "").length;
  if (state.resumeState.parsing) {
    qs("#resumeStatus").textContent = `正在解析：${label}...`;
    return;
  }
  if (state.resumeState.understanding) {
    qs("#resumeStatus").textContent = `已提取 ${length} 字，正在理解简历内容并生成 Resume Profile...`;
    return;
  }
  if (state.resumeState.profileError) {
    qs("#resumeStatus").textContent = `${state.resumeState.profileError} 已保留本地提取结果，点击“匹配”可重试。`;
    return;
  }
  const profile = reusableResumeProfile(resume);
  if (profile) {
    const work = profile.workExperience?.length || 0;
    const projects = profile.projects?.length || 0;
    const skills = profile.skills?.length || 0;
    qs("#resumeStatus").textContent = `简历已理解：${work} 段工作经历 · ${projects} 个项目 · ${skills} 项技能。Resume Profile 已缓存。`;
    return;
  }
  qs("#resumeStatus").textContent = `已提取：${label}，共 ${length} 字。匹配前会自动完成一次简历理解并缓存结果。`;
}

function markResumeReady(state, label, callbacks) {
  state.resumeState.uploaded = true;
  qs("#resumeStatus").textContent = parsedResumeStatus(label, state.resumeState.data);
  callbacks.updateMatchState();
  callbacks.setStep("match");
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
