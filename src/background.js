import { enqueueUsage, flushUsage, installationId } from "./shared/backend/metrics-worker.js";
function enableSidePanelOnActionClick() {
  // 让用户点击浏览器工具栏里的 JOBGET 图标时打开侧边栏面板。
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
}

chrome.runtime.onInstalled.addListener(enableSidePanelOnActionClick);
chrome.runtime.onStartup.addListener(enableSidePanelOnActionClick);

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === "jobget.installation") {
    installationId().then(installation_id => reply({ installation_id })).catch(() => reply({ error: true }));
    return true;
  }
  if (message?.type === "jobget.usage") {
    enqueueUsage(message.payload).then(() => { reply({ ok: true }); void flushUsage(); }).catch(() => reply({ ok: false }));
    return true;
  }
});
chrome.alarms.create("jobget.usage.flush", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === "jobget.usage.flush") void flushUsage(); });
void flushUsage();
