/**
 * 岗位池交互：提取、搜索、收藏、导出、清空以及岗位卡片事件。
 * Controller 只连接 DOM、State 与业务动作，不包含 Prompt / Provider 细节。
 */
import { startUsage, trackUsage } from "../../shared/backend/usage.js";
import { createManualJob } from "../../features/jobs/manual.js";
import { exportJobs } from "../../features/jobs/export.js";
import { extractFromCurrentTab } from "../../features/jobs/extract.js";
import { favoriteCard, jobCard, jobSearchText } from "../../features/jobs/view.js";
import { appendUniqueJob } from "../../features/jobs/repository.js";
import { reusableAnalysis } from "../../shared/context/cache.js";
import { qs, qsa, setStatus } from "../../shared/ui/dom.js";
import { requests, state, updateJobs } from "../runtime.js";

let actions = { openJob: () => {}, refresh: () => {}, setView: () => {} };
const pendingStars = new Set();

export function configureJobsController(nextActions = {}) {
  actions = { ...actions, ...nextActions };
}

export function renderJobs(filter = state.navigation.search) {
  state.navigation.search = filter;
  const hasJobs = state.jobs.length > 0;
  qs("#jobsView").classList.toggle("is-empty", !hasJobs);
  qs('.top-tabs [data-tab="jobs"]').classList.toggle("active", hasJobs && state.navigation.view === "jobs");
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
    ? rows.map(({ job, index }) => jobCard(job, index, index === state.navigation.selectedJob)).join("")
    : `<article class="card"><h2>没有匹配结果</h2><p class="note">换一个关键词试试。</p></article>`;
  bindJobCardActions();
}

export function renderFavorites() {
  const rows = state.jobs.map((job, index) => ({ job, index })).filter(({ job }) => job.starred);
  qs("#favoriteList").innerHTML = rows.length
    ? rows.map(({ job, index }) => favoriteCard(job, index)).join("")
    : `<article class="card"><h2>暂无收藏</h2><p class="note">在岗位卡片右上角点击星标即可收藏重点机会。</p></article>`;
  qsa("#favoriteList .job-card").forEach((card) => {
    const index = Number(card.dataset.job);
    bindCardDetailEntry(card, index, "favorites");
    card.querySelector('[data-action="star"]').addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleStar(index);
    });
    card.querySelector('[data-action="intelligence"]').addEventListener("click", (event) => {
      event.stopPropagation();
      const analyzed = Boolean(reusableAnalysis(state.jobs[index]));
      actions.openJob(index, "analysis", "favorites", { analyze: !analyzed });
    });
  });
}

export function renderJobSummary() {
  qs("#count").textContent = String(state.jobs.length);
  qs("#bottomActions").classList.toggle("is-hidden", state.jobs.length === 0);
  qs("#exportAllBtn").disabled = state.jobs.length === 0;
  qs("#clearBtn").disabled = state.jobs.length === 0;
  qs("#exportFavoritesBtn").disabled = state.jobs.every((job) => !job.starred);
  renderJobs();
  renderFavorites();
}

function bindJobCardActions() {
  qsa("#jobList .job-card").forEach((card) => {
    const index = Number(card.dataset.job);
    bindCardDetailEntry(card, index, "jobs");
    card.querySelector('[data-action="star"]').addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleStar(index);
    });
    card.querySelector('[data-action="analyze"]').addEventListener("click", (event) => {
      event.stopPropagation();
      actions.openJob(index, "analysis", "jobs", { analyze: !reusableAnalysis(state.jobs[index]) });
    });
  });
}

function bindCardDetailEntry(card, index, returnView) {
  const openDetail = () => actions.openJob(index, "jd", returnView);
  card.querySelector('[data-action="detail"]').addEventListener("click", openDetail);
}

export async function toggleStar(index) {
  const target = state.jobs[index];
  if (!target || pendingStars.has(target.id)) return;
  pendingStars.add(target.id);
  qsa(`[data-job="${index}"] [data-action="star"]`).forEach((button) => { button.disabled = true; });
  try {
    await trackUsage("favorite", () => updateJobs((jobs) => jobs.map((job) => job.id === target.id ? { ...job, starred: !job.starred } : job)));
  } catch (_error) {
    setStatus("收藏操作失败，请重试");
  } finally {
    pendingStars.delete(target.id);
    // 成功时同步所有星标；失败时也重建按钮，避免保持禁用。
    actions.refresh();
  }
}

export function bindJobsEvents() {
  const form = qs("#manualJobForm");
  const description = qs("#manualDescription");
  let saving = false;
  const syncManualSubmit = () => {
    qs("#manualSubmitBtn").disabled = saving || !description.value.trim();
  };
  const resetManual = () => {
    form.reset();
    qs("#manualOptionalDetails").open = false;
    qs("#manualError").textContent = "";
    description.setCustomValidity("");
    syncManualSubmit();
  };
  const openManualForm = () => {
    actions.setView("manual");
    description.focus();
  };
  qs("#manualAddBtn").addEventListener("click", openManualForm);
  qs("#emptyManualAddBtn").addEventListener("click", openManualForm);
  for (const id of ["#manualBackBtn", "#manualCancelBtn"]) {
    qs(id).addEventListener("click", () => {
      if (saving) return;
      resetManual();
      actions.setView("jobs");
    });
  }
  description.addEventListener("input", () => {
    description.setCustomValidity("");
    qs("#manualError").textContent = "";
    syncManualSubmit();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving) return;
    const finishUsage = startUsage("jd_manual");
    let job;
    try {
      job = createManualJob(Object.fromEntries(new FormData(form)));
    } catch (error) {
      finishUsage(false);
      description.setCustomValidity(error.message);
      description.reportValidity();
      return;
    }
    saving = true;
    const controls = [...form.elements, qs("#manualBackBtn")];
    controls.forEach((control) => { control.disabled = true; });
    qs("#manualOptionalDetails").inert = true;
    qs("#manualSubmitBtn").setAttribute("aria-busy", "true");
    qs("#manualSubmitBtn").textContent = "添加中…";
    qs("#manualError").textContent = "";
    try {
      let result;
      await updateJobs((jobs) => {
        result = appendUniqueJob(jobs, job);
        return result.jobs;
      });
      if (!result.added) {
        finishUsage(true);
        qs("#manualError").textContent = "已存在相同岗位，未重复保存";
        return;
      }
      finishUsage(true);
      state.navigation.selectedJob = state.jobs.length - 1;
      state.navigation.search = "";
      qs("#jobSearch").value = "";
      actions.refresh();
      resetManual();
      actions.setView("jobs");
      setStatus("手动添加成功，已保存到岗位池");
      qs(`#jobList [data-job="${state.navigation.selectedJob}"]`)?.scrollIntoView({ block: "nearest" });
    } catch (error) {
      finishUsage(false);
      qs("#manualError").textContent = error.message || "添加失败，请重试";
    } finally {
      saving = false;
      controls.forEach((control) => { control.disabled = false; });
      qs("#manualOptionalDetails").inert = false;
      qs("#manualSubmitBtn").removeAttribute("aria-busy");
      qs("#manualSubmitBtn").textContent = "添加岗位";
      syncManualSubmit();
    }
  });

  const extractCurrentJob = async (button) => {
    const buttonContent = button.innerHTML;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "提取中…";
    setStatus("正在提取当前页面...");
    qs("#emptyActionStatus").textContent = "正在提取当前页面...";
    const finishUsage = startUsage("jd_extract");
    try {
      const job = await extractFromCurrentTab();
      let result;
      await updateJobs((jobs) => {
        result = appendUniqueJob(jobs, job);
        return result.jobs;
      });
      finishUsage(true);
      if (result.added) state.navigation.selectedJob = state.jobs.length - 1;
      actions.refresh();
      setStatus(result.added ? "已保存到岗位池" : "已存在相同岗位，未重复保存");
    } catch (error) {
      finishUsage(false);
      const message = error.message || "提取失败";
      setStatus(message);
      qs("#emptyActionStatus").textContent = message;
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.innerHTML = buttonContent;
    }
  };
  qs("#extractBtn").addEventListener("click", (event) => extractCurrentJob(event.currentTarget));
  qs("#emptyExtractBtn").addEventListener("click", (event) => extractCurrentJob(event.currentTarget));

  qs("#jobSearch").addEventListener("input", (event) => renderJobs(event.target.value));
  qs("#exportAllBtn").addEventListener("click", () => exportJobs(state.jobs, qs("#exportAllBtn"), "暂无岗位", state.resumeState.data));
  qs("#exportFavoritesBtn").addEventListener("click", () => exportJobs(state.jobs.filter((job) => job.starred), qs("#exportFavoritesBtn"), "暂无收藏", state.resumeState.data));
  let clearingJobs = false;
  const clearDialog = qs("#clearConfirmDialog");
  qs("#clearBtn").addEventListener("click", () => {
    if (!clearingJobs) {
      qs("#clearConfirmError").textContent = "";
      clearDialog.showModal();
    }
  });
  clearDialog.addEventListener("cancel", (event) => {
    if (clearingJobs) event.preventDefault();
  });
  qs("#cancelClearBtn").addEventListener("click", () => {
    if (!clearingJobs) clearDialog.close();
  });
  qs("#confirmClearBtn").addEventListener("click", async () => {
    if (clearingJobs) return;
    clearingJobs = true;
    const button = qs("#confirmClearBtn");
    const cancelButton = qs("#cancelClearBtn");
    const errorText = qs("#clearConfirmError");
    button.disabled = true;
    cancelButton.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "清空中…";
    errorText.textContent = "";
    try {
      requests.invalidate();
      await updateJobs(() => []);
      state.navigation.selectedJob = 0;
      actions.refresh();
      setStatus("岗位池已清空");
      clearDialog.close();
    } catch (error) {
      const message = error.message || "清空岗位失败，请重试";
      setStatus(message);
      errorText.textContent = message;
    } finally {
      clearingJobs = false;
      button.disabled = false;
      cancelButton.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = "清空岗位";
    }
  });
  qs("#detailStar").addEventListener("click", () => toggleStar(state.navigation.selectedJob));
}
