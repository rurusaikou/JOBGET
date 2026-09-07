/**
 * AI 任务编排层。
 *
 * 标准流程：冻结输入 → 计算依赖 key → 创建 request ticket → 构建 Context →
 * 调用 Feature Service → 校验 ticket 仍有效 → 写回岗位结果。
 *
 * 这里不写 Prompt、不解析模型响应；这些职责属于对应 feature。
 */
import { buildTaskContext } from "../shared/context/builders.js";
import { resultMetadata, reusableAnalysis, reusableResumeProfile, taskKey } from "../shared/context/cache.js";
import { analyzeJobWithAi } from "../features/jd-analysis/service.js";
import { analyzeResumeMatchWithAi } from "../features/resume-match/service.js";
import { generateResumeRevisions } from "../features/resume-revision/service.js";
import { generateGreetingWithAi } from "../features/greeting/service.js";
import { buildResumeProfileWithAi } from "../features/resume/profile-service.js";
import { saveResumeProfile } from "../features/resume/storage.js";
import { getSettings } from "../features/settings/service.js";
import { deepAnalysisUserMessage, resumeProfileUserMessage } from "../shared/ai/errors.js";
import { requests, state, updateJobs } from "./runtime.js";

// 请求开始时复制输入，避免用户切换岗位/简历后正在执行的请求读取到新状态。
function frozenInputs(job, options = {}) {
  return {
    job: structuredClone(job),
    resume: state.resumeState.data ? structuredClone(state.resumeState.data) : null,
    ...options
  };
}

// 写回前再次校验 ticket 和 dependency key；失败即丢弃过期响应。
function stillValid(ticket, task, key, snapshot, jobs) {
  const liveJob = jobs.find((item) => item.id === snapshot.job.id);
  return Boolean(liveJob && requests.isCurrent(ticket) && key === taskKey(task, {
    job: liveJob,
    resume: state.resumeState.data,
    tone: snapshot.tone,
    maxChars: snapshot.maxChars
  }));
}

/** 执行单个岗位的 JD 深度分析。 */
export async function runDeepAnalysis(job, { onUpdate = () => {} } = {}) {
  const snapshot = frozenInputs(job);
  const key = taskKey("deep_analysis", snapshot);
  if (!key) return;
  const ticket = requests.start("deep_analysis", job.id, key);
  onUpdate();
  try {
    const context = buildTaskContext({ task: "deep_analysis", ...snapshot });
    const settings = await getSettings();
    if (!stillValid(ticket, "deep_analysis", key, snapshot, state.jobs)) return;
    const result = await analyzeJobWithAi(snapshot.job, settings, context);
    const metadata = resultMetadata(context);
    await updateJobs((jobs) => {
      if (!stillValid(ticket, "deep_analysis", key, snapshot, jobs)) return jobs;
      requests.invalidate("resume_match", job.id);
      requests.invalidate("resume_revision", job.id);
      requests.invalidate("greeting", job.id);
      return jobs.map((item) => item.id === job.id
        ? { ...item, deepAnalysis: { ...result, ...metadata }, resumeMatch: null, greeting: null }
        : item);
    });
    requests.finish(ticket);
    return true;
  } catch (error) {
    // 技术错误（max_output_tokens、JSON 截断、Provider 返回体等）只留在 Debug。
    // 页面不直接暴露内部细节，避免让用户处理自己无法控制的参数。
    requests.finish(ticket, deepAnalysisUserMessage(error));
    return false;
  } finally {
    onUpdate();
  }
}


/**
 * 确保当前简历拥有与 contentVersion 对应的 Resume Profile。
 * Resume Understanding 只按简历版本执行一次；缓存有效时直接复用。
 */
export async function runResumeUnderstanding({ onUpdate = () => {} } = {}) {
  const live = state.resumeState.data;
  if (!live?.id || !live?.contentVersion) return false;
  if (reusableResumeProfile(live)) return true;

  const snapshot = structuredClone(live);
  state.resumeState.understanding = true;
  state.resumeState.profileError = null;
  onUpdate();
  try {
    const settings = await getSettings();
    const profileData = await buildResumeProfileWithAi({ resume: snapshot, settings });
    const current = state.resumeState.data;
    if (!current || current.id !== snapshot.id || current.contentVersion !== snapshot.contentVersion) return false;
    const saved = await saveResumeProfile(snapshot, profileData);
    if (!saved) return false;
    state.resumeState.data = saved;
    return Boolean(reusableResumeProfile(saved));
  } catch (error) {
    state.resumeState.profileError = resumeProfileUserMessage(error);
    return false;
  } finally {
    const current = state.resumeState.data;
    if (!current || (current.id === snapshot.id && current.contentVersion === snapshot.contentVersion)) {
      state.resumeState.understanding = false;
    }
    onUpdate();
  }
}

/**
 * 执行简历流程：先 Match，成功后再启动独立 Revision。
 * Match 成功会立即持久化；Revision 即使失败也不会回滚 Match。
 */
export async function runResumePipeline(job, { onUpdate = () => {} } = {}) {
  // Match 需要两个 Understanding 结果：Job Profile 与 Resume Profile。
  // 缺哪个就自动补哪个；两者都缺时并行准备，减少串行等待。
  let liveJob = state.jobs.find((item) => item.id === job.id) || job;
  const needJobProfile = !reusableAnalysis(liveJob);
  const needResumeProfile = !reusableResumeProfile(state.resumeState.data);
  const [jobReady, resumeReady] = await Promise.all([
    needJobProfile ? runDeepAnalysis(liveJob, { onUpdate }) : Promise.resolve(true),
    needResumeProfile ? runResumeUnderstanding({ onUpdate }) : Promise.resolve(true)
  ]);
  if (!jobReady || !resumeReady) return;

  liveJob = state.jobs.find((item) => item.id === job.id);
  if (!liveJob || !reusableAnalysis(liveJob) || !reusableResumeProfile(state.resumeState.data)) return;

  const snapshot = frozenInputs(liveJob);
  const matchKey = taskKey("resume_match", snapshot);
  if (!matchKey) return;
  requests.invalidate("resume_revision", job.id);
  requests.invalidate("greeting", job.id);
  const matchTicket = requests.start("resume_match", job.id, matchKey);
  onUpdate();

  let context;
  let settings;
  let matchResult;
  let metadata;
  try {
    context = buildTaskContext({ task: "resume_match", ...snapshot });
    settings = await getSettings();
    if (!stillValid(matchTicket, "resume_match", matchKey, snapshot, state.jobs)) return;
    matchResult = await analyzeResumeMatchWithAi({ ...snapshot, settings, context });
    metadata = resultMetadata(context);
    const stored = { ...metadata, result: { ...matchResult, revisions: [], revisionError: null, revisionCompleted: false } };
    await updateJobs((jobs) => {
      if (!stillValid(matchTicket, "resume_match", matchKey, snapshot, jobs)) return jobs;
      return jobs.map((item) => item.id === job.id ? { ...item, resumeMatch: stored, greeting: null } : item);
    });
    requests.finish(matchTicket);
    onUpdate();
  } catch (error) {
    requests.finish(matchTicket, error.message || "匹配分析失败，请重试。");
    onUpdate();
    return;
  }

  // 匹配已经成功。修改建议拥有独立 ticket / 独立状态，不再把 Match 保持在 loading。
  const revisionKey = `${matchKey}:revision:${metadata.resultId}`;
  const revisionTicket = requests.start("resume_revision", job.id, revisionKey);
  onUpdate();
  try {
    const revision = await generateResumeRevisions({ settings, contextInput: context.input, matchResult });
    await updateJobs((jobs) => {
      const live = jobs.find((item) => item.id === job.id);
      const current = live?.resumeMatch?.resultId === metadata.resultId && requests.isCurrent(revisionTicket);
      if (!current) return jobs;
      return jobs.map((item) => item.id === job.id ? {
        ...item,
        resumeMatch: {
          ...item.resumeMatch,
          result: { ...item.resumeMatch.result, ...revision, revisionCompleted: true, revisionError: null }
        }
      } : item);
    });
    requests.finish(revisionTicket);
  } catch (error) {
    const message = error.message || "修改建议生成失败，请重新分析。";
    await updateJobs((jobs) => jobs.map((item) => item.id === job.id && item.resumeMatch?.resultId === metadata.resultId
      ? { ...item, resumeMatch: { ...item.resumeMatch, result: { ...item.resumeMatch.result, revisionError: message, revisionCompleted: false } } }
      : item));
    requests.finish(revisionTicket, message);
  } finally {
    onUpdate();
  }
}

/** Match 已成功时执行开场白生成。Greeting 不依赖 Revision 是否成功。 */
export async function runGreeting(job, options, { onUpdate = () => {} } = {}) {
  const snapshot = frozenInputs(job, options);
  const key = taskKey("greeting", snapshot);
  if (!key) return;
  const ticket = requests.start("greeting", job.id, key);
  onUpdate();
  try {
    const context = buildTaskContext({ task: "greeting", ...snapshot });
    const settings = await getSettings();
    if (!stillValid(ticket, "greeting", key, snapshot, state.jobs)) return;
    const result = await generateGreetingWithAi({ ...snapshot, settings, context });
    const metadata = resultMetadata(context);
    await updateJobs((jobs) => {
      if (!stillValid(ticket, "greeting", key, snapshot, jobs)) return jobs;
      return jobs.map((item) => item.id === job.id ? { ...item, greeting: { ...metadata, ...options, result } } : item);
    });
    requests.finish(ticket);
  } catch (error) {
    requests.finish(ticket, error.message || "开场白生成失败，请重试。");
  } finally {
    onUpdate();
  }
}
