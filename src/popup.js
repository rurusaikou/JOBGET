import { analyzeJobWithAi } from "./popup/deep-analysis/client.js";
import { validateJobForAnalysis } from "./popup/deep-analysis/result.js";
import { renderDeepAnalysis } from "./popup/deep-analysis/view.js";
import { copyText, escapeHtml, flashButton, qs, qsa, setStatus } from "./popup/dom.js";
import { exportJobs } from "./popup/export.js";
import { extractFromCurrentTab } from "./popup/extract.js";
import { appendUniqueJob, getJobs, normalizeJobForUi, setJobs } from "./popup/jobs.js";
import { greetingFor, intelligenceFor, keywordsFor } from "./popup/intelligence.js";
import { applyEditorAction, clearCurrentResume, handleResumeFile, restoreResume, saveResumeFromEditor, useExampleResume } from "./popup/resume/workflow.js";
import { analyzeResumeMatchWithAi } from "./popup/resume-match/client.js";
import { renderResumeMatchView } from "./popup/resume-match/view.js";
import { applyProviderPreset, getSettings, loadSettings, saveSettings, testApiKey } from "./popup/settings.js";

const state = {
  jobs: [],
  view: "jobs",
  step: "jd",
  selectedJob: 0,
  returnView: "jobs",
  settingsReturnView: "jobs",
  resumeUploaded: false,
  search: "",
  analyzingJob: null,
  analysisRequestId: 0,
  analysisError: null,
  resume: null,
  resumeMatchRequestId: 0,
  resumeMatchLoading: false,
  resumeMatchError: null,
  resumeMatchResult: null,
  resumeMatchKey: ""
};

// 页面路由与主渲染
function setView(view) {
  state.view = view;
  qsa(".view").forEach((node) => node.classList.remove("active"));
  qs(`#${view}View`).classList.add("active");
  qsa(".top-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.tab === view));
  qs("#plugin").classList.toggle("task-mode", view === "detail" || view === "settings");
  if (view === "favorites") renderFavorites();
}

function setStep(step) {
  state.step = step;
  qsa(".step-view").forEach((node) => node.classList.remove("active"));
  qs(`#${step}Step`).classList.add("active");
  qsa(".flow-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.step === step));
  qs("#detailView").classList.toggle("detail-mode", step === "jd" || step === "intelligence");
  updateMatchState();
}

function currentJob() {
  return state.jobs[state.selectedJob] || normalizeJobForUi({});
}

function render() {
  qs("#count").textContent = String(state.jobs.length);
  qs("#exportAllBtn").disabled = state.jobs.length === 0;
  qs("#clearBtn").disabled = state.jobs.length === 0;
  qs("#exportFavoritesBtn").disabled = state.jobs.every((job) => !job.starred);
  renderJobs(state.search);
  renderFavorites();
  if (state.jobs.length) updateDetailHeader();
}

function renderJobs(filter = "") {
  state.search = filter;
  const hasJobs = state.jobs.length > 0;
  qs("#emptyPanel").classList.toggle("is-hidden", hasJobs);
  qs("#searchRow").classList.toggle("is-hidden", !hasJobs);

  if (!hasJobs) {
    qs("#jobList").innerHTML = "";
    return;
  }

  const keyword = filter.trim().toLowerCase();
  const rows = state.jobs
    .map((job, index) => ({ job, index }))
    .filter(({ job }) => jobSearchText(job).toLowerCase().includes(keyword));

  qs("#jobList").innerHTML = rows.length
    ? rows.map(({ job, index }) => jobCard(job, index)).join("")
    : `<article class="card"><h2>没有匹配结果</h2><p class="note">换一个关键词试试。</p></article>`;

  bindJobCardActions("#jobList");
}

function renderFavorites() {
  const rows = state.jobs.map((job, index) => ({ job, index })).filter(({ job }) => job.starred);
  qs("#favoriteList").innerHTML = rows.length
    ? rows.map(({ job, index }) => favoriteCard(job, index)).join("")
    : `<article class="card"><h2>暂无收藏</h2><p class="note">在岗位卡片右上角点击星标即可收藏重点机会。</p></article>`;

  bindFavoriteCardActions();
}

// 岗位卡片
function jobSearchText(job) {
  return [
    job.title,
    job.company,
    job.location,
    job.salary,
    job.experience,
    job.education,
    job.sourceSite,
    keywordsFor(job).join(" ")
  ].join(" ");
}

function jobCard(job, index) {
  return jobCardTemplate(job, index, {
    selected: index === state.selectedJob,
    favorite: false,
    starTitle: "收藏",
    actions: `
      <div class="job-actions">
        <button data-action="detail" type="button">查看详情</button>
        <button class="deep" data-action="analyze" type="button">深度分析</button>
      </div>
    `
  });
}

function favoriteCard(job, index) {
  return jobCardTemplate(job, index, {
    selected: false,
    favorite: true,
    starTitle: "取消收藏",
    actions: `
      <div class="favorite-actions">
        <button class="primary" data-action="intelligence" type="button">深度分析结果</button>
      </div>
    `
  });
}

function jobCardTemplate(job, index, options) {
  return `
    <article class="job-card ${options.selected ? "selected" : ""} ${options.favorite ? "favorite-card" : ""}" data-job="${index}">
      <div class="job-top">
        <div>
          <h2>${escapeHtml(job.title || "未识别职位名")}</h2>
          <p>${escapeHtml(job.company || "公司待核对")}<br>${escapeHtml(metaLine(job))}</p>
        </div>
        <button class="star-btn ${job.starred ? "active" : ""}" data-action="star" type="button" title="${options.starTitle}" aria-label="${options.starTitle}">★</button>
      </div>
      <div class="job-tags">${keywordsFor(job).slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      ${options.actions}
    </article>
  `;
}

function bindJobCardActions(rootSelector) {
  qsa(`${rootSelector} .job-card`).forEach((card) => {
    const index = Number(card.dataset.job);
    card.querySelector('[data-action="star"]').addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleStar(index);
    });
    card.querySelector('[data-action="detail"]').addEventListener("click", () => openJob(index, "jd"));
    card.querySelector('[data-action="analyze"]').addEventListener("click", () => {
      openJob(index, "analysis", "jobs", { analyze: !state.jobs[index].deepAnalysis });
    });
  });
}

function bindFavoriteCardActions() {
  qsa("#favoriteList .job-card").forEach((card) => {
    const index = Number(card.dataset.job);
    card.querySelector('[data-action="star"]').addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleStar(index);
    });
    card.querySelector('[data-action="intelligence"]').addEventListener("click", () => openJob(index, "analysis", "favorites", { analyze: !state.jobs[index].deepAnalysis }));
  });
}

async function toggleStar(index) {
  if (!state.jobs[index]) return;
  state.jobs[index].starred = !state.jobs[index].starred;
  state.jobs = await setJobs(state.jobs);
  render();
  updateDetailHeader();
}

function openJob(index, step, returnView = "jobs", options = {}) {
  state.selectedJob = index;
  state.returnView = returnView;
  updateDetailHeader();
  qs("#backBtn").textContent = returnView === "favorites" ? "‹ 返回收藏" : "‹ 返回岗位池";
  setView("detail");
  setStep(step);
  if (options.analyze) startDeepAnalysis(index);
}

function analyzeCurrentJobIfNeeded() {
  const job = currentJob();
  // 已有分析结果时只切到结果页，避免用户从岗位池/详情页进入时反复调用模型。
  if (job.deepAnalysis) {
    setStep("analysis");
    return;
  }

  setStep("analysis");
  startDeepAnalysis();
}

function updateDetailHeader() {
  const job = currentJob();
  const intelligence = intelligenceFor(job);

  qs("#detailTitle").textContent = job.title || "未识别职位名";
  qs("#detailMeta").textContent = `${job.company || "公司待核对"} · ${metaLine(job)}`;
  qs("#jdFullTitle").textContent = job.title || "-";
  qs("#jdFullCompany").textContent = [job.company, job.location].filter(Boolean).join(" · ") || "-";
  qs("#jdFullMeta").textContent = [job.experience, job.education, job.postedDate, job.sourceSite].filter(Boolean).join(" · ") || "-";
  qs("#jdFullSalary").textContent = job.salary || "-";
  qs("#jdDetailText").textContent = job.description || "当前提取结果没有 JD 原文，请核对招聘页面结构。";
  qs("#detailStar").classList.toggle("active", job.starred);

  renderDeepAnalysis(job, intelligence, state);
  qs("#intelTitle").textContent = job.title || "-";
  qs("#intelCompany").textContent = [job.company, job.location].filter(Boolean).join(" · ") || "-";
  qs("#intelMeta").textContent = [job.experience, job.education, job.postedDate, job.sourceSite].filter(Boolean).join(" · ") || "-";
  qs("#intelSalary").textContent = job.salary || "-";
  qs("#intelJdText").textContent = job.description || "";
  qs("#intelAnalysis").innerHTML = intelligence.analysis.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  qs("#intelSuggestions").innerHTML = intelligence.suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  qs("#intelGreeting").textContent = intelligence.greeting;
  qs("#greetingText").textContent = intelligence.greeting;
  if (state.resumeUploaded) renderCurrentResumeMatch();
}

async function startDeepAnalysis(index = state.selectedJob) {
  const job = state.jobs[index];
  if (!job) return;

  const validation = validateJobForAnalysis(job);
  if (!validation.ok) {
    renderDeepAnalysis(job, intelligenceFor(job), state);
    setStatus(validation.message);
    return;
  }

  const requestId = state.analysisRequestId + 1;
  state.analysisRequestId = requestId;
  state.analyzingJob = index;
  state.analysisError = null;
  updateDetailHeader();
  setStatus("正在进行深度分析...");

  try {
    const settings = await getSettings();
    const result = await analyzeJobWithAi(job, settings);
    // 用户可能在请求过程中切换岗位，旧请求返回后不能覆盖新页面状态。
    if (requestId !== state.analysisRequestId) return;

    state.jobs[index] = { ...state.jobs[index], deepAnalysis: result };
    state.jobs = await setJobs(state.jobs);
    state.selectedJob = Math.min(index, state.jobs.length - 1);
    state.analysisError = null;
    setStatus("深度分析已完成");
  } catch (error) {
    if (requestId === state.analysisRequestId) {
      state.analysisError = { index, message: error.message || "分析失败，请稍后重试。" };
      setStatus(state.analysisError.message);
    }
  } finally {
    if (requestId === state.analysisRequestId) {
      state.analyzingJob = null;
      updateDetailHeader();
    }
  }
}

function metaLine(job) {
  return [job.location, job.salary, job.experience, job.education].filter(Boolean).join(" · ") || "岗位信息待核对";
}

function updateMatchState() {
  qs("#matchUploadPrompt").classList.remove("is-hidden");
  qs("#matchResults").classList.toggle("is-hidden", !state.resumeUploaded);
  qs("#greetingPrompt").classList.toggle("is-hidden", state.resumeUploaded);
  qs("#greetingResult").classList.toggle("is-hidden", !state.resumeUploaded);
  qs("#editorPrompt").classList.toggle("is-hidden", state.resumeUploaded);
  qs("#editorLayout").classList.toggle("is-hidden", !state.resumeUploaded);
  qs("#editorActions").classList.toggle("is-hidden", !state.resumeUploaded);
  qs("#clearResumeBtn").disabled = !state.resumeUploaded;
  qs("#clearResumeEditorBtn").disabled = !state.resumeUploaded;
  if (state.resumeUploaded) renderCurrentResumeMatch();
}

function renderCurrentResumeMatch() {
  if (state.resumeMatchKey && state.resumeMatchKey !== currentResumeMatchKey()) {
    state.resumeMatchResult = null;
    state.resumeMatchError = null;
    state.resumeMatchLoading = false;
  }
  renderResumeMatchView(state);
}

async function startResumeMatchAnalysis() {
  if (!state.resumeUploaded || !state.resume) return;

  const requestId = state.resumeMatchRequestId + 1;
  state.resumeMatchRequestId = requestId;
  state.resumeMatchLoading = true;
  state.resumeMatchError = null;
  state.resumeMatchResult = null;
  state.resumeMatchKey = currentResumeMatchKey();
  renderCurrentResumeMatch();

  try {
    const settings = await getSettings();
    const result = await analyzeResumeMatchWithAi({
      job: currentJob(),
      resume: state.resume,
      settings
    });
    if (requestId !== state.resumeMatchRequestId) return;
    state.resumeMatchResult = result;
    state.resumeMatchError = null;
  } catch (error) {
    if (requestId === state.resumeMatchRequestId) {
      state.resumeMatchError = error.message || "分析失败，请稍后重试。";
    }
  } finally {
    if (requestId === state.resumeMatchRequestId) {
      state.resumeMatchLoading = false;
      renderCurrentResumeMatch();
    }
  }
}

function resetResumeMatchState() {
  state.resumeMatchLoading = false;
  state.resumeMatchError = null;
  state.resumeMatchResult = null;
  state.resumeMatchKey = "";
}

function currentResumeMatchKey() {
  const job = currentJob();
  const source = state.resume && state.resume.source ? state.resume.source : {};
  return [
    job.title,
    job.company,
    String(job.description || "").slice(0, 200),
    source.updatedAt || source.parsedAt || "",
    source.fileName || ""
  ].join("|");
}

function generateGreeting() {
  const job = currentJob();
  const variants = [
    greetingFor(job, keywordsFor(job)),
    `你好，看到${job.company || "贵司"}${job.title || "这个岗位"}后很感兴趣。我的经历和岗位中提到的产品规划、跨团队推动、数据复盘比较匹配，期待有机会和您进一步交流岗位目标和团队现阶段重点。`,
    `你好，我想投递${job.company || "贵司"}的${job.title || "这个岗位"}。我过去做过需求调研、方案设计、研发协同和上线后的指标复盘，比较契合岗位对执行推进和结构化表达的要求。`
  ];
  qs("#greetingText").textContent = variants[Math.floor(Math.random() * variants.length)];
  qs("#copyStatus").textContent = "已重新生成，可复制后按投递场景微调。";
}

// 事件绑定与启动
function bindEvents() {
  qs("#settingsBtn").addEventListener("click", () => {
    state.settingsReturnView = state.view;
    setView("settings");
  });

  qs("#settingsBackBtn").addEventListener("click", () => setView(state.settingsReturnView));
  qs("#backBtn").addEventListener("click", () => setView(state.returnView));

  qsa(".top-tabs button").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.tab));
  });

  qsa(".flow-tabs button").forEach((button) => {
    button.addEventListener("click", () => setStep(button.dataset.step));
  });

  qs("#extractBtn").addEventListener("click", async () => {
    qs("#extractBtn").disabled = true;
    setStatus("正在提取当前页面...");

    try {
      const job = await extractFromCurrentTab();
      const result = appendUniqueJob(state.jobs, job);
      state.jobs = await setJobs(result.jobs);
      state.selectedJob = state.jobs.length - 1;
      render();
      setStatus(result.added ? "已保存到岗位池" : "已存在相同 JD，未重复保存");
    } catch (error) {
      setStatus(error.message || "提取失败");
    } finally {
      qs("#extractBtn").disabled = false;
    }
  });

  qs("#jobSearch").addEventListener("input", (event) => renderJobs(event.target.value));
  qs("#exportAllBtn").addEventListener("click", () => exportJobs(state.jobs, qs("#exportAllBtn"), "暂无 JD"));
  qs("#exportFavoritesBtn").addEventListener("click", () => {
    exportJobs(state.jobs.filter((job) => job.starred), qs("#exportFavoritesBtn"), "暂无收藏");
  });
  qs("#clearBtn").addEventListener("click", async () => {
    state.jobs = await setJobs([]);
    state.selectedJob = 0;
    render();
    setStatus("岗位池已清空");
  });

  qs("#detailStar").addEventListener("click", async () => toggleStar(state.selectedJob));
  qs("#detailAnalyzeBtn").addEventListener("click", analyzeCurrentJobIfNeeded);
  qs("#retryAnalysisBtn").addEventListener("click", () => startDeepAnalysis());
  qs("#copyJdBtn").addEventListener("click", () => {
    copyText(qs("#jdDetailText").textContent.trim());
    flashButton(qs("#copyJdBtn"), "已复制");
  });

  qs("#resumeFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (file) {
      resetResumeMatchState();
      await handleResumeFile(state, file, { updateMatchState, setStep });
      await startResumeMatchAnalysis();
    }
  });
  qs("#exampleResumeBtn").addEventListener("click", async () => {
    resetResumeMatchState();
    await useExampleResume(state, { updateMatchState, setStep });
    await startResumeMatchAnalysis();
  });
  qs("#clearResumeBtn").addEventListener("click", async () => {
    resetResumeMatchState();
    await clearCurrentResume(state, { updateMatchState, setStep });
  });
  qs("#clearResumeEditorBtn").addEventListener("click", async () => {
    resetResumeMatchState();
    await clearCurrentResume(state, { updateMatchState, setStep });
  });
  qs("#analyzeResumeMatchBtn").addEventListener("click", startResumeMatchAnalysis);
  qs("#toGreetingBtn").addEventListener("click", () => setStep("greeting"));
  qs("#toEditorBtn").addEventListener("click", () => setStep("editor"));
  qs("#goMatchUploadBtn").addEventListener("click", () => setStep("match"));
  qs("#goEditorUploadBtn").addEventListener("click", () => setStep("match"));
  qs("#generateGreetingBtn").addEventListener("click", generateGreeting);
  qs("#copyGreetingBtn").addEventListener("click", () => {
    const copied = copyText(qs("#greetingText").textContent.trim());
    qs("#copyStatus").textContent = copied ? "已复制到剪贴板。" : "浏览器限制了复制权限，请手动选中文案复制。";
  });
  qs("#resumePaper").addEventListener("click", (event) => {
    if (applyEditorAction(state, event)) resetResumeMatchState();
  });
  qs("#saveResumeBtn").addEventListener("click", async () => {
    const saved = await saveResumeFromEditor(state);
    if (saved) {
      flashButton(qs("#saveResumeBtn"), "已保存");
      resetResumeMatchState();
      await startResumeMatchAnalysis();
    }
  });
  qs("#exportPdfBtn").addEventListener("click", () => {
    document.body.classList.add("print-resume");
    window.print();
    setTimeout(() => document.body.classList.remove("print-resume"), 300);
  });

  qs("#apiProvider").addEventListener("change", (event) => applyProviderPreset(event.target.value));
  qs("#testApiBtn").addEventListener("click", testApiKey);
  qs("#apiForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSettings();
    qs("#apiStatus").className = "api-status ok";
    qs("#apiStatus").textContent = "非敏感配置已保存，API Key 已保存到当前浏览器会话。";
  });
}

async function init() {
  bindEvents();
  updateMatchState();
  state.jobs = await getJobs();
  await restoreResume(state, { updateMatchState, setStep });
  await loadSettings();
  render();
  setStatus(state.jobs.length ? "可以继续提取或导出" : "准备提取当前页面");
  setView("jobs");
  setStep("jd");
}

init().catch((error) => setStatus(error.message || "初始化失败"));
