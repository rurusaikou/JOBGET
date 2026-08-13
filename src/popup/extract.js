import { chromeAsync } from "./storage.js";

export async function extractFromCurrentTab() {
  if (!(window.chrome && chrome.tabs && chrome.scripting)) {
    throw new Error("请在浏览器扩展侧边栏中使用提取功能");
  }

  const tab = await activeTab();
  if (!tab || !tab.id) throw new Error("没有找到当前标签页");

  const response = await sendMessageWithInjection(tab.id, { type: "JDGET_EXTRACT" });
  if (!response || !response.ok) throw new Error((response && response.message) || "页面没有返回 JD 信息");
  return response.job;
}

async function activeTab() {
  const tabs = await chromeAsync((done) => chrome.tabs.query({ active: true, currentWindow: true }, done));
  return tabs[0];
}

async function sendMessageWithInjection(tabId, message) {
  let response;

  try {
    response = await sendMessage(tabId, message);
  } catch (_error) {
    await chromeAsync((done) => {
      chrome.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] }, done);
    });
    response = await sendMessage(tabId, message);
  }

  return response;
}

function sendMessage(tabId, message) {
  return chromeAsync((done) => {
    chrome.tabs.sendMessage(tabId, message, done);
  });
}
