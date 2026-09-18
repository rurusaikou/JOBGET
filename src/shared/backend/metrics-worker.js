import { backendUrl, USAGE_MODULES } from "./config.js";
const ID_KEY = "jobget.installationId";
const QUEUE_KEY = "jobget.usageQueue";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let serial = Promise.resolve();
let flushing;
function locked(action) {
  const result = serial.then(action);
  serial = result.catch(() => {});
  return result;
}
async function installation() {
  const data = await chrome.storage.local.get(ID_KEY);
  if (UUID.test(data[ID_KEY] || "")) return data[ID_KEY];
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [ID_KEY]: id });
  return id;
}
export function installationId() { return locked(installation); }
export function enqueueUsage(payload) {
  return locked(async () => {
    if (!payload || Object.keys(payload).sort().join() !== "date,event,execution_id,module" ||
        !USAGE_MODULES.includes(payload.module) || !UUID.test(payload.execution_id) ||
        !["start", "success", "failed"].includes(payload.event) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return;
    const age = Date.now() - Date.parse(payload.date);
    if (!Number.isFinite(age) || age < -86400000 || age > 7 * 86400000) return;
    const installation_id = await installation();
    const data = await chrome.storage.local.get(QUEUE_KEY);
    const queue = (data[QUEUE_KEY] || []).filter(item => Date.now() - Date.parse(item.date) < 7 * 86400000);
    if (!queue.some(item => item.execution_id === payload.execution_id && item.event === payload.event)) {
      queue.push({ installation_id, module: payload.module, execution_id: payload.execution_id, event: payload.event, date: payload.date });
    }
    await chrome.storage.local.set({ [QUEUE_KEY]: queue.slice(-200) });
  });
}
export function flushUsage() {
  if (flushing) return flushing;
  flushing = (async () => {
    const batch = await locked(async () => {
      const data = await chrome.storage.local.get(QUEUE_KEY);
      return (data[QUEUE_KEY] || []).filter(item => Date.now() - Date.parse(item.date) < 7 * 86400000).slice(0, 40);
    });
    if (!batch.length) return;
    const response = await fetch(backendUrl("/api/events"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }), signal: AbortSignal.timeout(8000)
    });
    if (!response.ok && ![400, 413].includes(response.status)) return;
    await locked(async () => {
      const data = await chrome.storage.local.get(QUEUE_KEY);
      const sent = new Set(batch.map(item => `${item.execution_id}:${item.event}`));
      await chrome.storage.local.set({ [QUEUE_KEY]: (data[QUEUE_KEY] || []).filter(item => !sent.has(`${item.execution_id}:${item.event}`)) });
    });
  })().catch(() => {}).finally(() => { flushing = null; });
  return flushing;
}
