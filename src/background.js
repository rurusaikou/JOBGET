function enableSidePanelOnActionClick() {
  // 让用户点击浏览器工具栏里的 JOBGET 图标时打开侧边栏面板。
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
}

chrome.runtime.onInstalled.addListener(enableSidePanelOnActionClick);
chrome.runtime.onStartup.addListener(enableSidePanelOnActionClick);
