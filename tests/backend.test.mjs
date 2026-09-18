import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { installStorage, responseFor, analysisResult, legacyJob } from "./helpers.mjs";
import { postResponses, validateModelSettings } from "../src/shared/ai/client.js";
import { defaultSettings, getSettings } from "../src/features/settings/service.js";
import { startUsage, trackUsage, cachedUsage } from "../src/shared/backend/usage.js";
import { enqueueUsage, flushUsage, installationId } from "../src/shared/backend/metrics-worker.js";
import { analyzeJobWithAi } from "../src/features/jd-analysis/service.js";
import { setJobs } from "../src/features/jobs/repository.js";
import { BACKEND_URL } from "../src/shared/backend/config.js";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; delete globalThis.chrome; });
const id = "11111111-1111-4111-8111-111111111111";
const exec = "22222222-2222-4222-8222-222222222222";
function mockChrome() {
  const data = {};
  const messages = [];
  globalThis.chrome = { runtime: { id: "extension", async sendMessage(message) { messages.push(message); return { installation_id: id }; } }, storage: { local: {
    async get(key) { return { [key]: structuredClone(data[key]) }; },
    async set(values) { Object.assign(data, structuredClone(values)); }
  } } };
  return { data, messages };
}
test("fresh users default to hosted; existing explicit provider settings stay usable", async () => {
  installStorage();
  assert.equal((await getSettings()).provider, "hosted");
  assert.doesNotThrow(() => validateModelSettings(defaultSettings));
  installStorage({ "jobget.settings": { provider: "deepseek", model: "old-model", baseUrl: "https://provider.test" } });
  assert.equal((await getSettings()).provider, "deepseek");
});
test("hosted requests use envelope without keys, model or provider URL", async () => {
  mockChrome();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `${BACKEND_URL}/api/ai`);
    assert.equal(options.headers.Authorization, undefined);
    const body = JSON.parse(options.body);
    assert.equal(body.installation_id, id);
    assert.equal(body.module, "resume_match");
    assert.equal(body.request.model, undefined);
    assert.doesNotMatch(options.body, /secret|private-provider/);
    return Response.json({ status: "completed", output_text: "ok" });
  };
  await postResponses({ label: "resume-match:first", settings: { ...defaultSettings, apiKey: "secret", baseUrl: "https://private-provider.test" }, body: { model: "expensive", messages: [{ role: "user", content: "input" }], max_tokens: 100 }, errorPrefix: "失败" });
});
test("hosted quota errors are actionable and raw server messages never appear", async () => {
  mockChrome();
  globalThis.fetch = async () => new Response("private upstream error", { status: 429 });
  await assert.rejects(postResponses({ label: "greeting", settings: defaultSettings, body: { messages: [] }, errorPrefix: "失败" }), error => error.hosted && /额度|频繁/.test(error.message) && !error.message.includes("private"));
});
test("installation generation is serialized across concurrent panel requests", async () => {
  const { data } = mockChrome();
  const ids = await Promise.all(Array.from({ length: 20 }, () => installationId()));
  assert.equal(new Set(ids).size, 1);
  assert.equal(ids[0], data["jobget.installationId"]);
});
test("offline event queue survives failure and replays the exact receipt", async () => {
  const { data } = mockChrome();
  const payload = { execution_id: exec, module: "excel_export", event: "success", date: new Date().toISOString().slice(0, 10) };
  await Promise.all([enqueueUsage(payload), enqueueUsage(payload)]);
  assert.equal(data["jobget.usageQueue"].length, 1);
  globalThis.fetch = async () => { throw new Error("offline"); };
  await flushUsage();
  assert.equal(data["jobget.usageQueue"].length, 1);
  globalThis.fetch = async (_, options) => {
    assert.deepEqual(JSON.parse(options.body).events, data["jobget.usageQueue"]);
    return Response.json({ ok: true });
  };
  await flushUsage();
  assert.deepEqual(data["jobget.usageQueue"], []);
  await enqueueUsage({ ...payload, filename: "private.pdf" });
  assert.deepEqual(data["jobget.usageQueue"], []);
});
test("module operation settles once; cache counts success; reporting errors don't fail business", async () => {
  const { messages } = mockChrome();
  const finish = startUsage("deep_analysis");
  finish(true); finish(false);
  cachedUsage("resume_profile");
  assert.deepEqual(messages.map(message => message.payload.event), ["start", "success", "start", "success"]);
  assert.equal(messages[0].payload.execution_id, messages[1].payload.execution_id);
  chrome.runtime.sendMessage = () => Promise.reject(new Error("closed"));
  assert.equal(await trackUsage("favorite", async () => "saved"), "saved");
});
test("AI compact retry produces two calls but one module use and one terminal outcome", async () => {
  installStorage();
  const { messages } = mockChrome();
  let attempts = 0;
  globalThis.fetch = async () => {
    if (++attempts === 1) return { ok: true, json: async () => ({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] }) };
    return responseFor(analysisResult);
  };
  const [job] = await setJobs([legacyJob]);
  await trackUsage("deep_analysis", () => analyzeJobWithAi(job, { ...defaultSettings, model: "" }));
  assert.equal(attempts, 2);
  const usage = messages.filter(message => message.type === "jobget.usage");
  assert.deepEqual(usage.map(message => message.payload.event), ["start", "success"]);
});
