/**
 * App 入口编排器。
 *
 * 只负责：组装各 Controller、绑定事件、初始化数据、触发全局刷新。
 * 业务规则放在 features，AI 工作流放在 task-runner，持久状态同步放在 runtime。
 */
import { getJobs } from "../features/jobs/repository.js";
import { loadSettings } from "../features/settings/service.js";
import { setStatus } from "../shared/ui/dom.js";
import { state, requests, syncTaskState } from "./runtime.js";
import { bindNavigationEvents, configureNavigation, openJob, setStep, setView } from "./controllers/navigation-controller.js";
import { bindJobsEvents, configureJobsController, renderFavorites, renderJobSummary } from "./controllers/jobs-controller.js";
import { bindDetailEvents, configureDetailController, renderDetail, startDeepAnalysis } from "./controllers/detail-controller.js";
import { bindResumeEvents, configureResumeController, renderResumeFlow, restoreResumeState } from "./controllers/resume-controller.js";
import { bindGreetingEvents, configureGreetingController, renderGreeting } from "./controllers/greeting-controller.js";
import { bindSettingsEvents } from "./controllers/settings-controller.js";

function refresh() {
  syncTaskState();
  renderJobSummary();
  renderDetail();
  renderResumeFlow();
  renderGreeting();
}

function openJobFromList(index, step, returnView = "jobs", options = {}) {
  openJob(index, step, returnView, {
    afterOpen: options.analyze ? () => startDeepAnalysis(index) : undefined
  });
  refresh();
}

function configureControllers() {
  configureNavigation({
    onView: (view) => { if (view === "favorites") renderFavorites(); },
    onStep: () => { renderResumeFlow(); renderGreeting(); }
  });
  configureJobsController({ openJob: openJobFromList, refresh });
  configureDetailController({ refresh, setStep });
  configureResumeController({ refresh, setStep });
  configureGreetingController({ refresh, setStep });
}

function bindEvents() {
  bindNavigationEvents();
  bindJobsEvents();
  bindDetailEvents();
  bindResumeEvents();
  bindGreetingEvents();
  bindSettingsEvents();
}

async function init() {
  configureControllers();
  bindEvents();
  state.jobs = await getJobs();
  await restoreResumeState();
  await loadSettings();
  refresh();
  setStatus(state.jobs.length ? "可以继续提取或导出" : "准备提取当前页面");
  setView("jobs");
  setStep("jd");
}

init().catch((error) => setStatus(error.message || "初始化失败"));
