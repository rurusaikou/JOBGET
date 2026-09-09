/**
 * 页面级导航与详情步骤切换；只修改 navigation state 和 DOM 激活态。
 * Controller 只连接 DOM、State 与业务动作，不包含 Prompt / Provider 细节。
 */
import { qsa, qs } from "../../shared/ui/dom.js";
import { state } from "../runtime.js";

let hooks = { onView: () => {}, onStep: () => {} };

export function configureNavigation(nextHooks = {}) {
  hooks = { ...hooks, ...nextHooks };
}

export function setView(view) {
  state.navigation.view = view;
  qsa(".view").forEach((node) => node.classList.remove("active"));
  qs(`#${view}View`).classList.add("active");
  qsa(".top-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.tab === view));
  qs("#plugin").classList.toggle("task-mode", view === "detail" || view === "settings" || view === "manual");
  hooks.onView(view);
}

export function setStep(step) {
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
  qs("#settingsBtn").addEventListener("click", () => {
    state.navigation.settingsReturnView = state.navigation.view;
    setView("settings");
  });
  qs("#settingsBackBtn").addEventListener("click", () => setView(state.navigation.settingsReturnView));
  qs("#backBtn").addEventListener("click", () => setView(state.navigation.returnView));
  qsa(".top-tabs button").forEach((button) => button.addEventListener("click", () => setView(button.dataset.tab)));
  qsa(".flow-tabs button").forEach((button) => button.addEventListener("click", () => setStep(button.dataset.step)));
}
