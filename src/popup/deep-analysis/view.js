import { escapeHtml, qs, qsa } from "../dom.js";
import { validateJobForAnalysis } from "./result.js";

export function renderDeepAnalysis(job, intelligence, analysisState) {
  const result = intelligence.deepAnalysis;
  const isLoading = analysisState.analyzingJob === analysisState.selectedJob;
  const error = analysisState.analysisError && analysisState.analysisError.index === analysisState.selectedJob
    ? analysisState.analysisError.message
    : "";
  const validation = validateJobForAnalysis(job);
  const canAnalyze = validation.ok && !isLoading;
  const shouldShowResult = Boolean(result);

  qs("#retryAnalysisBtn").classList.toggle("is-hidden", !canAnalyze);
  qs("#retryAnalysisBtn").disabled = !canAnalyze;
  qs("#analysisStatusCard").classList.toggle("loading", isLoading);
  qsa(".analysis-result-card").forEach((card) => card.classList.toggle("is-hidden", !shouldShowResult));

  renderAnalysisStatus({ isLoading, validation, error, result });
  renderAnalysisSections(result);
}

function renderAnalysisStatus({ isLoading, validation, error, result }) {
  if (isLoading) {
    qs("#analysisStatusTitle").textContent = "正在深度分析";
    qs("#analysisStatusText").textContent = "AI 正在基于当前 JD 提炼岗位本质、核心要求、隐形要求和理想候选人。";
    return;
  }

  if (!validation.ok) {
    qs("#analysisStatusTitle").textContent = "无法分析";
    qs("#analysisStatusText").textContent = validation.message;
    qs("#retryAnalysisBtn").classList.add("is-hidden");
    return;
  }

  if (error) {
    qs("#analysisStatusTitle").textContent = "分析失败";
    qs("#analysisStatusText").textContent = `${error} 请点击“重新分析”再次尝试。`;
    return;
  }

  if (result) {
    qs("#analysisStatusTitle").textContent = "深度分析结果";
    qs("#analysisStatusText").textContent = result.updatedAt ? `已完成分析：${formatTime(result.updatedAt)}` : "已完成分析。";
    return;
  }

  qs("#analysisStatusTitle").textContent = "尚未分析";
  qs("#analysisStatusText").textContent = "点击“重新分析”生成该 JD 的结构化深度分析。";
}

function renderAnalysisSections(result) {
  const analysis = result || {
    essence: [],
    coreRequirements: [],
    hiddenRequirements: [],
    idealCandidate: []
  };

  qs("#analysisEssence").innerHTML = listHtml(analysis.essence);
  qs("#analysisAudience").innerHTML = listHtml(analysis.coreRequirements);
  qs("#analysisHidden").innerHTML = hiddenRequirementHtml(analysis.hiddenRequirements);
  qs("#analysisIdeal").innerHTML = listHtml(analysis.idealCandidate);
}

function listHtml(items) {
  return (items && items.length ? items : ["暂无结果"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function hiddenRequirementHtml(items) {
  const rows = items && items.length ? items : ["暂无结果"];
  return rows.map((item) => {
    // Prompt 约定隐形要求为“结论｜判断依据”，依据部分单独突出展示。
    const [conclusion, basis] = String(item || "").split("｜");
    if (!basis) return `<li>${escapeHtml(item)}</li>`;
    return `
      <li class="hidden-requirement">
        <span>${escapeHtml(conclusion.trim())}</span>
        <small>${escapeHtml(basis.trim())}</small>
      </li>
    `;
  }).join("");
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
