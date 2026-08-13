import { flashButton } from "./dom.js";
import { dedupeJobs, inferSourceSite } from "./jobs.js";
import { chromeAsync } from "./storage.js";

export async function exportJobs(jobs, button, emptyText) {
  if (!jobs.length) {
    flashButton(button, emptyText);
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  await downloadWorkbook(jobs, `JOBGET-${date}.xlsx`);
  flashButton(button, "已导出");
}

function jobRows(jobs) {
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

async function downloadWorkbook(jobs, filename) {
  const blob = window.JDGET_XLSX.createWorkbookBlob(jobRows(jobs), "JD信息");
  await downloadBlob(blob, filename, true);
}

async function downloadBlob(blob, filename, saveAs) {
  const url = URL.createObjectURL(blob);

  if (window.chrome && chrome.downloads) {
    await chromeAsync((done) => {
      chrome.downloads.download({ url, filename, saveAs }, done);
    });
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
