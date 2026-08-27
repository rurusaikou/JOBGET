import { escapeHtml, qs, qsa } from "../dom.js";
import { validateJobForAnalysis } from "./result.js";

export function renderDeepAnalysis(job, analysisState) {
  const result = job && job.deepAnalysis ? job.deepAnalysis : null;
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
    qs("#analysisStatusText").textContent = "正在提炼岗位本质、核心要求、隐形要求和理想候选人。";
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
    qs("#analysisStatusText").textContent = result.updatedAt ? `最近分析： ${formatTime(result.updatedAt)}` : "已完成分析。";
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

  qs("#analysisEssence").innerHTML = essenceHtml(analysis.essence);
  qs("#analysisAudience").innerHTML = coreRequirementHtml(analysis.coreRequirements);
  qs("#analysisHidden").innerHTML = hiddenRequirementHtml(analysis.hiddenRequirements);
  qs("#analysisIdeal").innerHTML = listHtml(analysis.idealCandidate);
}

function essenceHtml(items) {
  return (items && items.length ? items : ["暂无结果"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function coreRequirementHtml(items) {
  return (items && items.length ? items : ["暂无结果"]).map((item, index) => {
    const [title, description] = splitCoreRequirement(item);
    return `
      <li class="core-requirement">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div>
          <strong>${escapeHtml(title)}</strong>
          ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        </div>
      </li>
    `;
  }).join("");
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
        <small><strong>依据：</strong>${escapeHtml(basis.trim())}</small>
      </li>
    `;
  }).join("");
}

function splitCoreRequirement(item) {
  const text = String(item || "").trim();
  const parts = text.split(/[：:｜|]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1 && parts[0].length <= 18) return [parts[0], parts.slice(1).join("：")];
  const sentenceMatch = text.match(/^(.{2,18}?)(?:，|,|。|\s)(.+)$/);
  if (sentenceMatch) return [sentenceMatch[1].trim(), sentenceMatch[2].trim()];
  return [text, ""];
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
