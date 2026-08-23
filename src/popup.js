import { analyzeJobWithAi } from "./popup/deep-analysis/client.js";
import { validateJobForAnalysis } from "./popup/deep-analysis/result.js";
import { renderDeepAnalysis } from "./popup/deep-analysis/view.js";
import { copyText, flashButton, qs, qsa, setStatus } from "./popup/dom.js";
import { exportJobs } from "./popup/export.js";
import { extractFromCurrentTab } from "./popup/extract.js";
import { generateGreetingWithAi } from "./popup/greeting/client.js";
import { favoriteCard, jobCard, jobSearchText } from "./popup/job-list/view.js";
import { appendUniqueJob, getJobs, normalizeJobForUi, setJobs } from "./popup/jobs.js";
import { clearCurrentResume, handleResumeFile, restoreResume, useExampleResume } from "./popup/resume/workflow.js";
import { analyzeResumeMatchWithAi } from "./popup/resume-match/client.js";
import { renderResumeMatchView } from "./popup/resume-match/view.js";
import { applyProviderPreset, getSettings, loadSettings, saveSettings, testApiKey } from "./popup/settings.js";

const state = {
  // 岗位池与页面导航状态
  jobs: [],
  view: "jobs",
  step: "jd",
  selectedJob: 0,
  returnView: "jobs",
  settingsReturnView: "jobs",
  search: "",

  // JD 深度分析请求状态
  analyzingJob: null,
  analysisRequestId: 0,
  analysisError: null,

  // 简历上传与 JD 匹配状态
  resumeUploaded: false,
  resume: null,
  resumeMatchRequestId: 0,
  resumeMatchLoading: false,
  resumeMatchError: null,
  resumeMatchResult: null,
  resumeMatchKey: "",

  // 求职开场白生成状态
  greetingRequestId: 0,
  greetingLoading: false,
  greetingError: null,
  greetingResult: ""
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
  qs("#detailView").classList.toggle("detail-mode", step === "jd");
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
    ? rows.map(({ job, index }) => jobCard(job, index, index === state.selectedJob)).join("")
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

  qs("#detailTitle").textContent = job.title || "未识别职位名";
  qs("#detailMeta").textContent = `${job.company || "公司待核对"} · ${metaLine(job)}`;
  qs("#jdFullTitle").textContent = job.title || "-";
  qs("#jdFullCompany").textContent = [job.company, job.location].filter(Boolean).join(" · ") || "-";
  qs("#jdFullMeta").textContent = [job.experience, job.education, job.postedDate, job.sourceSite].filter(Boolean).join(" · ") || "-";
  qs("#jdFullSalary").textContent = job.salary || "-";
  qs("#jdDetailText").textContent = job.description || "当前提取结果没有 JD 原文，请核对招聘页面结构。";
  qs("#detailStar").classList.toggle("active", job.starred);

  renderDeepAnalysis(job, state);
  qs("#greetingText").textContent = state.greetingResult;
  updateGreetingCounter();
  if (state.resumeUploaded) renderCurrentResumeMatch();
}

async function startDeepAnalysis(index = state.selectedJob) {
  const job = state.jobs[index];
  if (!job) return;

  const validation = validateJobForAnalysis(job);
  if (!validation.ok) {
    renderDeepAnalysis(job, state);
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
  qs("#matchUploadPrompt").classList.toggle("is-hidden", state.resumeUploaded);
  syncResumeMatchPanelVisibility();
  updateGreetingStepState();
  qs("#clearResumeBtn").disabled = !state.resumeUploaded;
  updateRevisionStepState();
  if (shouldShowResumeMatchPanel()) renderCurrentResumeMatch();
}

function renderCurrentResumeMatch() {
  // 匹配结果绑定当前 JD 和当前简历；任一输入变化都需要清空旧分析。
  if (state.resumeMatchKey && state.resumeMatchKey !== currentResumeMatchKey()) {
    state.resumeMatchResult = null;
    state.resumeMatchError = null;
    state.resumeMatchLoading = false;
    resetGreetingState();
  }
  const restored = restoreStoredResumeMatchForCurrentJob();
  syncResumeMatchPanelVisibility();
  if (!shouldShowResumeMatchPanel()) return;
  renderResumeMatchView(state);
  if (restored) {
    updateRevisionStepState();
    updateGreetingStepState();
  }
}

function shouldShowResumeMatchPanel() {
  return Boolean(state.resumeUploaded);
}

function syncResumeMatchPanelVisibility() {
  qs("#matchResults").classList.toggle("is-hidden", !shouldShowResumeMatchPanel());
}

function updateRevisionStepState() {
  // “修改建议”页只消费匹配分析结果，不再承载旧版简历编辑器。
  const hasSuggestions = Boolean(state.resumeUploaded && state.resumeMatchResult && !state.resumeMatchLoading && !state.resumeMatchError);
  const prompt = qs("#revisionPrompt");
  const promptText = qs("#revisionPromptText");
  prompt.classList.toggle("is-hidden", hasSuggestions);

  if (!state.resumeUploaded) {
    promptText.textContent = "上传简历并完成匹配分析后，这里会展示针对当前岗位的简历修改建议。";
    return;
  }

  if (state.resumeMatchLoading) {
    promptText.textContent = "正在分析简历与岗位匹配情况，完成后会在这里展示修改建议。";
    return;
  }

  if (state.resumeMatchError) {
    promptText.textContent = "匹配分析失败，回到“匹配”页重新分析后再查看修改建议。";
    return;
  }

  if (!state.resumeMatchResult) {
    promptText.textContent = "简历已上传。请先在“匹配”页开始分析，完成后这里会展示修改建议。";
  }
}

function updateGreetingStepState() {
  const canGenerate = Boolean(state.resumeUploaded && state.resumeMatchResult && !state.resumeMatchLoading);
  qs("#greetingPrompt").classList.toggle("is-hidden", canGenerate);
  qs("#greetingResult").classList.toggle("is-hidden", !canGenerate);
  updateGreetingControls();

  if (!state.resumeUploaded) {
    qs("#greetingPrompt h2").textContent = "先上传简历";
    qs("#greetingPrompt p").textContent = "求职开场白会基于 JD 和简历匹配亮点生成。请先在“匹配”中上传简历。";
    qs("#goMatchUploadBtn").textContent = "去上传简历";
    return;
  }

  if (state.resumeMatchLoading) {
    qs("#greetingPrompt h2").textContent = "正在匹配分析";
    qs("#greetingPrompt p").textContent = "匹配分析完成后，会基于匹配亮点生成求职开场白。";
    qs("#goMatchUploadBtn").textContent = "查看匹配进度";
    return;
  }

  if (!state.resumeMatchResult) {
    qs("#greetingPrompt h2").textContent = "先完成匹配分析";
    qs("#greetingPrompt p").textContent = "求职开场白需要基于简历与 JD 的匹配亮点生成。请先完成匹配分析。";
    qs("#goMatchUploadBtn").textContent = "去匹配分析";
  }
}

async function startResumeMatchAnalysis() {
  if (!state.resumeUploaded || !state.resume) return;

  // requestId 防止用户快速切换简历/JD 时，较慢的旧请求覆盖新结果。
  const requestId = state.resumeMatchRequestId + 1;
  const jobIndex = state.selectedJob;
  const matchKey = currentResumeMatchKey();
  state.resumeMatchRequestId = requestId;
  state.resumeMatchLoading = true;
  state.resumeMatchError = null;
  state.resumeMatchResult = null;
  state.resumeMatchKey = matchKey;
  resetGreetingState();
  updateRevisionStepState();
  renderCurrentResumeMatch();

  try {
    const settings = await getSettings();
    const result = await analyzeResumeMatchWithAi({
      job: state.jobs[jobIndex],
      resume: state.resume,
      settings
    });
    if (requestId !== state.resumeMatchRequestId) return;
    await saveResumeMatchToJob(jobIndex, matchKey, result);
    if (jobIndex !== state.selectedJob || matchKey !== currentResumeMatchKey()) return;
    state.resumeMatchResult = result;
    state.resumeMatchError = null;
  } catch (error) {
    if (requestId === state.resumeMatchRequestId && jobIndex === state.selectedJob) {
      state.resumeMatchError = error.message || "分析失败，请稍后重试。";
    }
  } finally {
    if (requestId === state.resumeMatchRequestId) {
      state.resumeMatchLoading = false;
      renderCurrentResumeMatch();
      updateRevisionStepState();
      updateGreetingStepState();
    }
  }
}

function resetResumeMatchState() {
  state.resumeMatchLoading = false;
  state.resumeMatchError = null;
  state.resumeMatchResult = null;
  state.resumeMatchKey = "";
  resetGreetingState();
  syncResumeMatchPanelVisibility();
}

async function saveResumeMatchToJob(index, key, result) {
  if (!state.jobs[index]) return;
  state.jobs[index] = {
    ...state.jobs[index],
    resumeMatch: {
      key,
      updatedAt: new Date().toISOString(),
      result
    }
  };
  state.jobs = await setJobs(state.jobs);
}

function resetGreetingState() {
  state.greetingLoading = false;
  state.greetingError = null;
  state.greetingResult = "";
  qs("#greetingText").textContent = "";
  updateGreetingCounter();
  updateGreetingControls();
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

function restoreStoredResumeMatchForCurrentJob() {
  if (!state.resumeUploaded || state.resumeMatchLoading || state.resumeMatchResult || state.resumeMatchError) return false;

  const stored = currentJob().resumeMatch;
  const key = currentResumeMatchKey();
  if (!stored || stored.key !== key || !stored.result) return false;

  state.resumeMatchKey = key;
  state.resumeMatchResult = stored.result;
  return true;
}

async function startGreetingGeneration() {
  if (!state.resumeMatchResult || state.greetingLoading) return;

  // 开场白依赖匹配结果；重新匹配或清除简历时会一起失效。
  const requestId = state.greetingRequestId + 1;
  state.greetingRequestId = requestId;
  state.greetingLoading = true;
  state.greetingError = null;
  updateGreetingControls();
  qs("#greetingText").textContent = "正在基于匹配亮点生成求职开场白...";
  updateGreetingCounter();

  try {
    const settings = await getSettings();
    const result = await generateGreetingWithAi({
      job: currentJob(),
      resume: state.resume,
      matchResult: state.resumeMatchResult,
      tone: qs("#greetingTone").value,
      maxChars: greetingLengthLimit(),
      settings
    });
    if (requestId !== state.greetingRequestId) return;
    state.greetingResult = result.greeting;
    qs("#greetingText").textContent = result.greeting;
    qs("#copyStatus").textContent = "已生成，可复制后按投递场景微调。";
  } catch (error) {
    if (requestId === state.greetingRequestId) {
      state.greetingError = error.message || "生成失败，请稍后重试。";
      qs("#greetingText").textContent = "";
      qs("#copyStatus").textContent = state.greetingError;
    }
  } finally {
    if (requestId === state.greetingRequestId) {
      state.greetingLoading = false;
      updateGreetingCounter();
      updateGreetingControls();
    }
  }
}

function updateGreetingControls() {
  const button = qs("#generateGreetingBtn");
  if (!button) return;
  button.disabled = state.greetingLoading || !state.resumeMatchResult;
  button.textContent = state.greetingLoading ? "生成中" : state.greetingResult ? "↻ 重新生成" : "生成开场白";
  qs("#copyGreetingBtn").disabled = state.greetingLoading || !qs("#greetingText").textContent.trim();
}

function markGreetingConstraintChanged() {
  updateGreetingCounter();
  if (state.greetingResult) qs("#copyStatus").textContent = "语气或字数上限已调整，点击“重新生成”后生效。";
}

function updateGreetingCounter() {
  const counter = qs("#greetingCounter");
  if (!counter) return;
  counter.textContent = `${qs("#greetingText").textContent.trim().length} / ${greetingLengthLimit()} 字`;
}

function greetingLengthLimit() {
  return Number(qs("#greetingLength").value) || 120;
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
  qs("#analyzeResumeMatchBtn").addEventListener("click", startResumeMatchAnalysis);
  qs("#toGreetingBtn").addEventListener("click", async () => {
    setStep("greeting");
    if (state.resumeMatchResult && !state.greetingResult) await startGreetingGeneration();
  });
  qs("#toRevisionBtn").addEventListener("click", () => setStep("revision"));
  qs("#goMatchUploadBtn").addEventListener("click", () => setStep("match"));
  qs("#goRevisionMatchBtn").addEventListener("click", () => setStep("match"));
  qs("#generateGreetingBtn").addEventListener("click", startGreetingGeneration);
  qs("#greetingTone").addEventListener("change", markGreetingConstraintChanged);
  qs("#greetingLength").addEventListener("change", markGreetingConstraintChanged);
  qs("#copyGreetingBtn").addEventListener("click", () => {
    const copied = copyText(qs("#greetingText").textContent.trim());
    qs("#copyStatus").textContent = copied ? "已复制到剪贴板。" : "浏览器限制了复制权限，请手动选中文案复制。";
    updateGreetingCounter();
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
