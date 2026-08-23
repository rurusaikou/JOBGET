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
  return dedupeJobs(jobs).map((job) => {
    const analysis = job.deepAnalysis || {};
    const match = job.resumeMatch && job.resumeMatch.result ? job.resumeMatch.result : {};

    return {
      "岗位": job.title || "",
      "公司": job.company || "",
      "工作地点": job.location || "",
      "工作经验": job.experience || "",
      "学历要求": job.education || "",
      "薪资": job.salary || "",
      "JD原文": job.description || "",
      "发布日期": job.postedDate || "",
      "来源网站": job.sourceSite || inferSourceSite(job.sourceUrl),
      "来源链接": job.sourceUrl || "",
      "岗位本质": joinList(analysis.essence),
      "核心要求": joinList(analysis.coreRequirements),
      "隐形要求": joinList(analysis.hiddenRequirements),
      "理想候选人": joinList(analysis.idealCandidate),
      "深度分析时间": formatExportTime(analysis.updatedAt),
      "匹配等级": match.level || "",
      "匹配说明": match.reason || "",
      "直接匹配": joinObjects(match.directMatches, ["requirement", "experience", "proof"]),
      "可迁移能力": joinObjects(match.transferableMatches, ["requirement", "experience", "ability", "boundary"]),
      "关键缺口": joinObjects(match.gaps, ["gap", "impact"]),
      "简历修改建议": joinObjects(match.revisions, ["summary", "original", "direction", "rewrite"]),
      "匹配分析时间": formatExportTime(job.resumeMatch && job.resumeMatch.updatedAt)
    };
  });
}

function joinList(items) {
  return (items || []).filter(Boolean).join("\n");
}

function joinObjects(items, keys) {
  return (items || []).map((item, index) => {
    const text = keys.map((key) => item && item[key]).filter(Boolean).join("｜");
    return text ? `${index + 1}. ${text}` : "";
  }).filter(Boolean).join("\n");
}

function formatExportTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN");
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
