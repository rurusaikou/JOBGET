const STORAGE_KEY = "jdget.jobs";

// 弹窗页面中会频繁访问这些节点，集中缓存可以避免到处 querySelector。
const els = {
  extract: document.querySelector("#extract"),
  export: document.querySelector("#export"),
  inspect: document.querySelector("#inspect"),
  clear: document.querySelector("#clear"),
  status: document.querySelector("#status"),
  count: document.querySelector("#count"),
  title: document.querySelector("#title"),
  company: document.querySelector("#company"),
  location: document.querySelector("#location"),
  salary: document.querySelector("#salary")
};

function setStatus(text) {
  els.status.textContent = text;
}

// Chrome 扩展 API 仍以 callback 为主。包装成 Promise 后，
// 后续流程可以用 async/await 串起来，错误处理也更集中。
function chromeAsync(fn) {
  return new Promise((resolve, reject) => {
    fn((result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}

// 所有提取结果只保存在浏览器本地 storage，不上传到任何服务。
async function getJobs() {
  const data = await chromeAsync((done) => chrome.storage.local.get({ [STORAGE_KEY]: [] }, done));
  return data[STORAGE_KEY] || [];
}

async function setJobs(jobs) {
  await chromeAsync((done) => chrome.storage.local.set({ [STORAGE_KEY]: jobs }, done));
}

// 弹窗只展示最近一次提取的核心字段；完整字段在导出的 Excel 中。
function render(jobs) {
  const latest = jobs[jobs.length - 1] || {};
  els.count.textContent = String(jobs.length);
  els.title.textContent = latest.title || "-";
  els.company.textContent = latest.company || "-";
  els.location.textContent = latest.location || "-";
  els.salary.textContent = latest.salary || "-";
  els.export.disabled = jobs.length === 0;
  els.clear.disabled = jobs.length === 0;
}

// 获取当前激活标签页。所有提取和 DOM 调试都只作用于这个标签页。
async function activeTab() {
  const tabs = await chromeAsync((done) => chrome.tabs.query({ active: true, currentWindow: true }, done));
  return tabs[0];
}

async function extractFromCurrentTab() {
  const tab = await activeTab();
  if (!tab || !tab.id) throw new Error("没有找到当前标签页");

  const response = await sendMessageWithInjection(tab.id, { type: "JDGET_EXTRACT" });
  if (!response || !response.ok) throw new Error("页面没有返回 JD 信息");
  return response.job;
}

async function inspectCurrentTab() {
  const tab = await activeTab();
  if (!tab || !tab.id) throw new Error("没有找到当前标签页");

  const response = await sendMessageWithInjection(tab.id, { type: "JDGET_INSPECT_DOM" });
  if (!response || !response.ok) throw new Error("页面没有返回 DOM 结构");
  return response.report;
}

// 如果页面是在扩展安装前打开的，content script 可能还没注入。
// 第一次发送消息失败时，主动注入 src/content.js 后再重试。
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

// Excel 的列顺序由这里决定。只保留当前真正需要的字段，
// content.js 中用于调试或未来扩展的字段不会自动进入表格。
function jobRows(jobs) {
  return jobs.map((job) => ({
    "岗位名称": job.title || "",
    "公司名称": job.company || "",
    "工作地点": job.location || "",
    "工作经验": job.experience || "",
    "学历要求": job.education || "",
    "薪资": job.salary || "",
    "JD原文": job.description || "",
    "发布日期": job.postedDate || "",
    "来源链接": job.sourceUrl || ""
  }));
}

async function downloadWorkbook(jobs) {
  const blob = window.JDGET_XLSX.createWorkbookBlob(jobRows(jobs), "JD信息");
  const date = new Date().toISOString().slice(0, 10);
  await downloadBlob(blob, `JDGET-${date}.xlsx`, true);
}

// DOM 调试报告可能很大，保存为 JSON 方便直接搜索 HTML 结构。
async function downloadJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await downloadBlob(blob, `JDGET-DOM-${timestamp}.json`, true);
}

async function downloadBlob(blob, filename, saveAs) {
  const url = URL.createObjectURL(blob);

  await chromeAsync((done) => {
    chrome.downloads.download(
      {
        url,
        filename,
        saveAs
      },
      done
    );
  });

  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// “提取当前 JD”：读取当前页面结构，追加到本地列表。
els.extract.addEventListener("click", async () => {
  els.extract.disabled = true;
  setStatus("正在提取当前页面...");

  try {
    const job = await extractFromCurrentTab();
    const jobs = await getJobs();
    jobs.push(job);
    await setJobs(jobs);
    render(jobs);
    setStatus(job.title ? "已保存到本地列表" : "已保存，但职位名可能需要手动核对");
  } catch (error) {
    setStatus(error.message || "提取失败");
  } finally {
    els.extract.disabled = false;
  }
});

// “导出 Excel”：把本地列表转换为 xlsx 文件并交给浏览器下载。
els.export.addEventListener("click", async () => {
  setStatus("正在生成 Excel...");

  try {
    const jobs = await getJobs();
    await downloadWorkbook(jobs);
    setStatus("Excel 已发送到下载目录");
  } catch (error) {
    setStatus(error.message || "导出失败");
  }
});

// “导出DOM结构”：用于排查页面结构变化，后续适配新网站也靠它。
els.inspect.addEventListener("click", async () => {
  els.inspect.disabled = true;
  setStatus("正在读取页面 DOM 结构...");

  try {
    const report = await inspectCurrentTab();
    await downloadJson(report);
    setStatus("DOM 结构已导出为 JSON");
  } catch (error) {
    setStatus(error.message || "导出 DOM 失败");
  } finally {
    els.inspect.disabled = false;
  }
});

// 清空只影响本地缓存的提取记录，不会修改页面内容。
els.clear.addEventListener("click", async () => {
  await setJobs([]);
  render([]);
  setStatus("列表已清空");
});

// 弹窗打开时立即恢复本地记录数量和最近一条预览。
getJobs()
  .then((jobs) => {
    render(jobs);
    setStatus(jobs.length ? "可以继续提取或导出" : "准备提取当前页面");
  })
  .catch((error) => setStatus(error.message || "读取本地数据失败"));
