/**
 * 开场白参数、状态同步、生成与复制交互。
 * Controller 只连接 DOM、State 与业务动作，不包含 Prompt / Provider 细节。
 */
import { isResultCurrent, taskKey } from "../../shared/context/cache.js";
import { copyText, qs } from "../../shared/ui/dom.js";
import { currentJob, requests, state } from "../runtime.js";
import { runGreeting } from "../task-runner.js";

let actions = { refresh: () => {}, setStep: () => {} };

export function configureGreetingController(nextActions = {}) {
  actions = { ...actions, ...nextActions };
}

export function greetingOptions() {
  return { tone: qs("#greetingTone").value, maxChars: greetingLengthLimit() };
}

export function syncGreetingState() {
  const job = currentJob();
  const resume = state.resumeState.data;
  const options = greetingOptions();
  const key = taskKey("greeting", { job, resume, ...options });
  const ticket = key ? requests.get("greeting", job.id, key) : null;
  if (ticket?.loading) {
    Object.assign(state.tasks.greeting, { status: "loading", error: null });
    return;
  }
  if (ticket?.error) {
    Object.assign(state.tasks.greeting, { status: "error", error: ticket.error, result: "" });
    return;
  }
  const stored = isResultCurrent("greeting", job.greeting, { job, resume, ...options }) ? job.greeting : null;
  if (stored) {
    Object.assign(state.tasks.greeting, { status: "success", error: null, result: stored.result.greeting || "" });
  } else {
    Object.assign(state.tasks.greeting, { status: "idle", error: null, result: "" });
  }
}

export function renderGreeting() {
  syncGreetingState();
  const match = state.tasks.resumeMatch;
  const greeting = state.tasks.greeting;
  const uploaded = state.resumeState.uploaded;
  const canGenerate = Boolean(uploaded && match.status === "success" && match.result);
  qs("#greetingPrompt").classList.toggle("is-hidden", canGenerate);
  qs("#greetingResult").classList.toggle("is-hidden", !canGenerate);
  qs("#greetingText").textContent = greeting.status === "loading" ? "正在基于匹配亮点生成求职开场白..." : greeting.result;
  qs("#copyStatus").textContent = greeting.status === "error" ? greeting.error || "" : "";
  updateGreetingCounter();
  updateGreetingControls();

  if (!uploaded) {
    qs("#greetingPrompt h2").textContent = "先上传简历";
    qs("#greetingPrompt p").textContent = "求职开场白会基于 JD 和简历匹配亮点生成。请先在“匹配”中上传简历。";
    qs("#goMatchUploadBtn").textContent = "去上传简历";
  } else if (match.status === "loading") {
    qs("#greetingPrompt h2").textContent = "正在匹配分析";
    qs("#greetingPrompt p").textContent = "匹配分析完成后，会基于匹配亮点生成求职开场白。";
    qs("#goMatchUploadBtn").textContent = "查看匹配进度";
  } else if (!canGenerate) {
    qs("#greetingPrompt h2").textContent = "先完成匹配分析";
    qs("#greetingPrompt p").textContent = "求职开场白需要基于简历与 JD 的匹配亮点生成。请先完成匹配分析。";
    qs("#goMatchUploadBtn").textContent = "去匹配分析";
  }
}

export async function startGreetingGeneration() {
  syncGreetingState();
  if (state.tasks.resumeMatch.status !== "success" || !state.tasks.resumeMatch.result || state.tasks.greeting.status === "loading" || state.resumeState.parsing) return;
  await runGreeting(currentJob(), greetingOptions(), { onUpdate: actions.refresh });
}

function updateGreetingControls() {
  const button = qs("#generateGreetingBtn");
  if (!button) return;
  const greeting = state.tasks.greeting;
  const matchReady = state.tasks.resumeMatch.status === "success" && Boolean(state.tasks.resumeMatch.result);
  button.disabled = greeting.status === "loading" || !matchReady || Boolean(state.resumeState.parsing);
  button.textContent = greeting.status === "loading" ? "生成中" : greeting.result ? "↻ 重新生成" : "生成开场白";
  qs("#copyGreetingBtn").disabled = greeting.status === "loading" || !greeting.result;
}

function markGreetingConstraintChanged() {
  requests.invalidate("greeting", currentJob().id);
  actions.refresh();
  if (!state.tasks.greeting.result) qs("#copyStatus").textContent = "语气或字数上限已调整，点击生成后生效。";
}

function updateGreetingCounter() {
  const counter = qs("#greetingCounter");
  if (!counter) return;
  counter.textContent = `${qs("#greetingText").textContent.trim().length} / ${greetingLengthLimit()} 字`;
}

function greetingLengthLimit() {
  return Number(qs("#greetingLength").value) || 120;
}

export function bindGreetingEvents() {
  qs("#toGreetingBtn").addEventListener("click", async () => {
    actions.setStep("greeting");
    if (state.tasks.resumeMatch.status === "success" && !state.tasks.greeting.result) await startGreetingGeneration();
  });
  qs("#goMatchUploadBtn").addEventListener("click", () => actions.setStep("match"));
  qs("#generateGreetingBtn").addEventListener("click", startGreetingGeneration);
  qs("#greetingTone").addEventListener("change", markGreetingConstraintChanged);
  qs("#greetingLength").addEventListener("change", markGreetingConstraintChanged);
  qs("#copyGreetingBtn").addEventListener("click", () => {
    const copied = copyText(qs("#greetingText").textContent.trim());
    qs("#copyStatus").textContent = copied ? "已复制到剪贴板。" : "浏览器限制了复制权限，请手动选中文案复制。";
    updateGreetingCounter();
  });
}
