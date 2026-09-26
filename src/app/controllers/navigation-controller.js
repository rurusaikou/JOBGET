/**
 * 页面级导航与详情步骤切换；只修改 navigation state 和 DOM 激活态。
 * Controller 只连接 DOM、State 与业务动作，不包含 Prompt / Provider 细节。
 */
import { API_SETTINGS_ENABLED } from "../../shared/config/features.js";
import { qsa, qs } from "../../shared/ui/dom.js";
import { reusableAnalysis } from "../../shared/context/cache.js";
import { currentJob, state } from "../runtime.js";

let hooks = { onView: () => {}, onStep: () => {} };

export function configureNavigation(nextHooks = {}) {
  hooks = { ...hooks, ...nextHooks };
}

export function setView(view) {
  if (view === "settings" && !API_SETTINGS_ENABLED) return;
  state.navigation.view = view;
  qsa(".view").forEach((node) => node.classList.remove("active"));
  qs(`#${view}View`).classList.add("active");
  qsa(".top-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.tab === view));
  qs("#plugin").classList.toggle("task-mode", ["detail", "settings", "manual", "help", "helpDetail", "feedback"].includes(view));
  hooks.onView(view);
}

export function setStep(step) {
  if (["match", "revision", "greeting"].includes(step) && reusableAnalysis(currentJob())?.isJobDescription === false) step = "analysis";
  state.navigation.step = step;
  qsa(".step-view").forEach((node) => node.classList.remove("active"));
  qs(`#${step}Step`).classList.add("active");
  qsa(".flow-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.step === step));
  qs("#detailView").classList.toggle("detail-mode", step === "jd");
  hooks.onStep(step);
}

export function openJob(index, step, returnView = "jobs", options = {}) {
  state.navigation.selectedJob = index;
  state.navigation.returnView = returnView;
  qs("#backBtn").textContent = returnView === "favorites" ? "‹ 返回收藏" : "‹ 返回岗位池";
  setView("detail");
  setStep(step);
  if (options.afterOpen) options.afterOpen();
}

export function bindNavigationEvents() {
  const menu = qs("#headerMenu");
  const menuButton = qs("#moreMenuBtn");
  const closeMenu = () => {
    menu.classList.add("is-hidden");
    menuButton.setAttribute("aria-expanded", "false");
  };
  const openUtilityView = (view) => {
    if (view === "settings" && !API_SETTINGS_ENABLED) return;
    // 在辅助页再次点击当前菜单项时只关闭菜单，避免把返回目标覆盖成当前页。
    if (state.navigation.view === view) {
      closeMenu();
      return;
    }
    // 只有从非辅助页进入时才记录返回目标；辅助页之间切换仍返回原业务页。
    if (!["settings", "help", "helpDetail", "feedback"].includes(state.navigation.view)) {
      state.navigation.utilityReturnView = state.navigation.view;
    }
    closeMenu();
    setView(view);
  };

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.classList.contains("is-hidden");
    menu.classList.toggle("is-hidden", !willOpen);
    menuButton.setAttribute("aria-expanded", String(willOpen));
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".header-menu-wrap")) closeMenu();
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });

  qs("#settingsBtn").addEventListener("click", () => openUtilityView("settings"));
  qs("#helpBtn").addEventListener("click", () => openUtilityView("help"));
  qs("#feedbackBtn").addEventListener("click", () => openUtilityView("feedback"));
  for (const id of ["#settingsBackBtn", "#helpBackBtn", "#feedbackBackBtn"]) {
    qs(id).addEventListener("click", () => setView(state.navigation.utilityReturnView));
  }
  qs("#settingsBtn").classList.toggle("is-hidden", !API_SETTINGS_ENABLED);

  qs("#backBtn").addEventListener("click", () => setView(state.navigation.returnView));
  qsa(".top-tabs button").forEach((button) => button.addEventListener("click", () => setView(button.dataset.tab)));
  qsa(".flow-tabs button").forEach((button) => button.addEventListener("click", () => setStep(button.dataset.step)));
}
