import { STORAGE_KEY } from "./constants.js";
import { normalizeStoredDeepAnalysis } from "./deep-analysis/result.js";
import { getLocal, setLocal } from "./storage.js";

export async function getJobs() {
  const data = await getLocal({ [STORAGE_KEY]: [] });
  return dedupeJobs((data[STORAGE_KEY] || []).map(normalizeJobForUi));
}

export async function setJobs(jobs) {
  const nextJobs = dedupeJobs(jobs.map(normalizeJobForUi));
  await setLocal({ [STORAGE_KEY]: nextJobs });
  return nextJobs;
}

export function appendUniqueJob(jobs, job) {
  const normalizedJobs = dedupeJobs(jobs.map(normalizeJobForUi));
  const normalizedJob = normalizeJobForUi(job);
  const nextJobs = dedupeJobs([...normalizedJobs, normalizedJob]);

  return {
    jobs: nextJobs,
    added: nextJobs.length > normalizedJobs.length
  };
}

export function dedupeJobs(jobs) {
  const seen = new Set();
  const unique = [];

  for (const job of jobs) {
    const key = jobDedupeKey(job);
    if (!key) {
      unique.push(job);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(job);
  }

  return unique;
}

export function normalizeJobForUi(job) {
  return {
    title: job && job.title ? job.title : "",
    company: job && job.company ? job.company : "",
    location: job && job.location ? job.location : "",
    experience: job && job.experience ? job.experience : "",
    education: job && job.education ? job.education : "",
    salary: job && job.salary ? job.salary : "",
    description: job && job.description ? job.description : "",
    postedDate: job && job.postedDate ? job.postedDate : "",
    sourceSite: job && job.sourceSite ? job.sourceSite : inferSourceSite(job && job.sourceUrl),
    sourceUrl: job && job.sourceUrl ? job.sourceUrl : "",
    starred: Boolean(job && job.starred),
    deepAnalysis: normalizeStoredDeepAnalysis(job && job.deepAnalysis),
    resumeMatch: normalizeStoredResumeMatch(job && job.resumeMatch),
    greeting: normalizeStoredGreeting(job && job.greeting)
  };
}

export function inferSourceSite(sourceUrl) {
  const url = String(sourceUrl || "");
  if (/zhipin\.com/i.test(url)) return "boss直聘";
  if (/zhaopin\.com/i.test(url)) return "智联招聘";
  if (/liepin\.com/i.test(url)) return "猎聘";
  return "";
}

function normalizeForDedupe(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function jobDedupeKey(job) {
  const sourceUrl = normalizeForDedupe(job.sourceUrl);
  const identity = [
    normalizeForDedupe(job.title),
    normalizeForDedupe(job.company),
    normalizeForDedupe(job.location),
    normalizeForDedupe(job.salary)
  ].filter(Boolean).join("|");

  return sourceUrl ? `${sourceUrl}|${identity}` : identity;
}

function normalizeStoredResumeMatch(match) {
  if (!match || typeof match !== "object") return null;
  const result = match.result && typeof match.result === "object" ? match.result : match;
  return {
    key: match.key || "",
    updatedAt: match.updatedAt || "",
    result: {
      level: result.level || "",
      reason: result.reason || "",
      directMatches: normalizeObjectList(result.directMatches),
      transferableMatches: normalizeObjectList(result.transferableMatches),
      gaps: normalizeObjectList(result.gaps),
      revisions: normalizeObjectList(result.revisions),
      usage: normalizeTokenUsage(result.usage)
    }
  };
}

function normalizeStoredGreeting(greeting) {
  if (!greeting || typeof greeting !== "object") return null;
  const result = greeting.result && typeof greeting.result === "object" ? greeting.result : greeting;
  return {
    key: greeting.key || "",
    tone: greeting.tone || "",
    maxChars: Number(greeting.maxChars) || 0,
    updatedAt: greeting.updatedAt || "",
    result: {
      greeting: result.greeting || "",
      rawText: result.rawText || "",
      usage: normalizeTokenUsage(result.usage)
    }
  };
}

function normalizeObjectList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function normalizeTokenUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = numberOrEmpty(usage.inputTokens);
  const outputTokens = numberOrEmpty(usage.outputTokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens: totalTokensOrFallback(usage.totalTokens, inputTokens, outputTokens)
  };
}

function numberOrEmpty(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function totalTokensOrFallback(value, inputTokens, outputTokens) {
  const totalTokens = numberOrEmpty(value);
  if (totalTokens !== "") return totalTokens;
  if (inputTokens === "" || outputTokens === "") return "";
  return inputTokens + outputTokens;
}
