const STORAGE_KEY = "jdget.jobs";

// 侧边栏面板中会频繁访问这些节点，集中缓存可以避免到处 querySelector。
const els = {
  extract: document.querySelector("#extract"),
  export: document.querySelector("#export"),
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
  // 覆盖式写入比增量 append 更简单；当前数据量是用户手动采集的 JD 列表，
  // chrome.storage.local 足够承载，不需要引入 IndexedDB。
  await chromeAsync((done) => chrome.storage.local.set({ [STORAGE_KEY]: jobs }, done));
}

function normalizeForDedupe(value) {
  // 去重前先统一空白和大小写，避免同一 JD 因换行/空格差异被当成两条。
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function jobDedupeKey(job) {
  // 来源链接通常最稳定；同时拼上核心字段，避免列表页同 URL 下切换职位时误判。
  const sourceUrl = normalizeForDedupe(job.sourceUrl);
  const identity = [
    normalizeForDedupe(job.title),
    normalizeForDedupe(job.company),
    normalizeForDedupe(job.location),
    normalizeForDedupe(job.salary)
  ].filter(Boolean).join("|");

  return sourceUrl ? `${sourceUrl}|${identity}` : identity;
}

function dedupeJobs(jobs) {
  // 保留第一次出现的记录，后续重复项丢弃；这样不会改变用户原有收集顺序。
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

function appendUniqueJob(jobs, job) {
  // 保存时就去重，避免面板计数和最终 Excel 数量不一致。
  const nextJobs = dedupeJobs([...jobs, job]);
  return {
    jobs: nextJobs,
    added: nextJobs.length > dedupeJobs(jobs).length
  };
}

// 面板只展示最近一次提取的核心字段；完整字段在导出的 Excel 中。
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

// 获取当前激活标签页。所有提取动作都只作用于这个标签页。
async function activeTab() {
  const tabs = await chromeAsync((done) => chrome.tabs.query({ active: true, currentWindow: true }, done));
  return tabs[0];
}

async function extractFromCurrentTab() {
  const tab = await activeTab();
  if (!tab || !tab.id) throw new Error("没有找到当前标签页");

  // 只把“提取”命令发给 content script；字段解析逻辑都留在页面上下文中完成。
  // 这样侧边栏面板不需要知道招聘网站 DOM，也不会因为跨上下文访问 DOM 失败。
  const response = await sendMessageWithInjection(tab.id, { type: "JDGET_EXTRACT" });
  if (!response || !response.ok) throw new Error((response && response.message) || "页面没有返回 JD 信息");
  return response.job;
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
  // chrome.tabs.sendMessage 会把消息发到指定标签页的 content script。
  // 如果目标页是 chrome://、扩展页或浏览器禁止注入的页面，调用会失败并进入上层 catch。
  return chromeAsync((done) => {
    chrome.tabs.sendMessage(tabId, message, done);
  });
}

// Excel 的列顺序由这里决定。只保留当前真正需要的字段，
// content.js 中用于调试或未来扩展的字段不会自动进入表格。
function jobRows(jobs) {
  // 对象 key 会成为 xlsx 第一行表头；这里使用中文 key，用户打开 Excel 即可直接阅读。
  return dedupeJobs(jobs).map((job) => ({
    "岗位": job.title || "",
    "公司": job.company || "",
    "工作地点": job.location || "",
    "工作经验": job.experience || "",
    "学历要求": job.education || "",
    "薪资": job.salary || "",
    "JD原文": job.description || "",
    "发布日期": job.postedDate || "",
    "来源网站": job.sourceSite || inferSourceSite(job.sourceUrl),
    "来源链接": job.sourceUrl || ""
  }));
}

function inferSourceSite(sourceUrl) {
  // 兼容旧缓存：历史记录没有 sourceSite 时，导出前从链接反推来源网站。
  const url = String(sourceUrl || "");
  if (/zhipin\.com/i.test(url)) return "boss直聘";
  if (/zhaopin\.com/i.test(url)) return "智联招聘";
  if (/liepin\.com/i.test(url)) return "猎聘";
  return "";
}

async function downloadWorkbook(jobs) {
  // xlsx.js 暴露 JDGET_XLSX.createWorkbookBlob，返回标准 Excel MIME Blob。
  // 侧边栏面板只负责把业务数据映射成表格行，不处理底层 zip/xml 细节。
  const blob = window.JDGET_XLSX.createWorkbookBlob(jobRows(jobs), "JD信息");
  const date = new Date().toISOString().slice(0, 10);
  await downloadBlob(blob, `JDGET-${date}.xlsx`, true);
}

async function downloadBlob(blob, filename, saveAs) {
  // downloads API 需要可下载 URL。Blob URL 只在当前扩展上下文有效，
  // 下载任务创建后延迟释放，避免浏览器还没读取完就 revoke。
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
    const result = appendUniqueJob(jobs, job);
    await setJobs(result.jobs);
    render(result.jobs);
    if (!result.added) {
      setStatus("已存在相同 JD，未重复保存");
    } else {
      setStatus(job.title ? "已保存到本地列表" : "已保存，但职位名可能需要手动核对");
    }
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
    const uniqueJobs = dedupeJobs(jobs);
    if (uniqueJobs.length !== jobs.length) {
      await setJobs(uniqueJobs);
    }
    await downloadWorkbook(uniqueJobs);
    setStatus(uniqueJobs.length === jobs.length ? "Excel 已发送到下载目录" : "Excel 已去重并发送到下载目录");
  } catch (error) {
    setStatus(error.message || "导出失败");
  }
});

// 清空只影响本地缓存的提取记录，不会修改页面内容。
els.clear.addEventListener("click", async () => {
  await setJobs([]);
  render([]);
  setStatus("列表已清空");
});

// 面板打开时立即恢复本地记录数量和最近一条预览。
getJobs()
  .then((jobs) => {
    const uniqueJobs = dedupeJobs(jobs);
    render(uniqueJobs);
    if (uniqueJobs.length !== jobs.length) {
      setJobs(uniqueJobs).catch(() => {});
      setStatus("已清理本地重复 JD");
    } else {
      setStatus(jobs.length ? "可以继续提取或导出" : "准备提取当前页面");
    }
  })
  .catch((error) => setStatus(error.message || "读取本地数据失败"));
