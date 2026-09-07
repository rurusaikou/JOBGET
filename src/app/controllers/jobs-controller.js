/**
 * 岗位池交互：提取、搜索、收藏、导出、清空以及岗位卡片事件。
 * Controller 只连接 DOM、State 与业务动作，不包含 Prompt / Provider 细节。
 */
import { exportJobs } from "../../features/jobs/export.js";
import { extractFromCurrentTab } from "../../features/jobs/extract.js";
import { favoriteCard, jobCard, jobSearchText } from "../../features/jobs/view.js";
import { appendUniqueJob } from "../../features/jobs/repository.js";
import { reusableAnalysis } from "../../shared/context/cache.js";
import { qs, qsa, setStatus } from "../../shared/ui/dom.js";
import { requests, state, updateJobs } from "../runtime.js";

let actions = { openJob: () => {}, refresh: () => {} };

export function configureJobsController(nextActions = {}) {
  actions = { ...actions, ...nextActions };
}

export function renderJobs(filter = state.navigation.search) {
  state.navigation.search = filter;
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
    card.querySelector('[data-action="star"]').addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleStar(index);
    });
    card.querySelector('[data-action="intelligence"]').addEventListener("click", () => {
      actions.openJob(index, "analysis", "favorites", { analyze: !reusableAnalysis(state.jobs[index]) });
    });
  });
}

export function renderJobSummary() {
  qs("#count").textContent = String(state.jobs.length);
  qs("#exportAllBtn").disabled = state.jobs.length === 0;
  qs("#clearBtn").disabled = state.jobs.length === 0;
  qs("#exportFavoritesBtn").disabled = state.jobs.every((job) => !job.starred);
  renderJobs();
  renderFavorites();
}

function bindJobCardActions() {
  qsa("#jobList .job-card").forEach((card) => {
    const index = Number(card.dataset.job);
    card.querySelector('[data-action="star"]').addEventListener("click", async (event) => {
      event.stopPropagation();
      await toggleStar(index);
    });
    card.querySelector('[data-action="detail"]').addEventListener("click", () => actions.openJob(index, "jd"));
    card.querySelector('[data-action="analyze"]').addEventListener("click", () => {
      actions.openJob(index, "analysis", "jobs", { analyze: !reusableAnalysis(state.jobs[index]) });
    });
  });
}

export async function toggleStar(index) {
  const target = state.jobs[index];
  if (!target) return;
  await updateJobs((jobs) => jobs.map((job) => job.id === target.id ? { ...job, starred: !job.starred } : job));
  actions.refresh();
}

export function bindJobsEvents() {
  qs("#extractBtn").addEventListener("click", async () => {
    qs("#extractBtn").disabled = true;
    setStatus("正在提取当前页面...");
    try {
      const job = await extractFromCurrentTab();
      let result;
      await updateJobs((jobs) => {
        result = appendUniqueJob(jobs, job);
        return result.jobs;
      });
      if (result.added) state.navigation.selectedJob = state.jobs.length - 1;
      actions.refresh();
      setStatus(result.added ? "已保存到岗位池" : "已存在相同 JD，未重复保存");
    } catch (error) {
      setStatus(error.message || "提取失败");
    } finally {
      qs("#extractBtn").disabled = false;
    }
  });

  qs("#jobSearch").addEventListener("input", (event) => renderJobs(event.target.value));
  qs("#exportAllBtn").addEventListener("click", () => exportJobs(state.jobs, qs("#exportAllBtn"), "暂无 JD", state.resumeState.data));
  qs("#exportFavoritesBtn").addEventListener("click", () => exportJobs(state.jobs.filter((job) => job.starred), qs("#exportFavoritesBtn"), "暂无收藏", state.resumeState.data));
  qs("#clearBtn").addEventListener("click", async () => {
    requests.invalidate();
    await updateJobs(() => []);
    state.navigation.selectedJob = 0;
    actions.refresh();
    setStatus("岗位池已清空");
  });
  qs("#detailStar").addEventListener("click", () => toggleStar(state.navigation.selectedJob));
}
