import { escapeHtml } from "../dom.js";
import { keywordsFor } from "../intelligence.js";

export function jobSearchText(job) {
  // 搜索只覆盖列表可见和可推断字段，不把完整 JD 放进列表搜索，避免长文本拖慢输入。
  return [
    job.title,
    job.company,
    job.location,
    job.salary,
    job.experience,
    job.education,
    job.sourceSite,
    keywordsFor(job).join(" ")
  ].join(" ");
}

export function jobCard(job, index, selected) {
  return jobCardTemplate(job, index, {
    selected,
    favorite: false,
    starTitle: "收藏",
    actions: `
      <div class="job-actions">
        <button data-action="detail" type="button">查看详情</button>
        <button class="deep" data-action="analyze" type="button">深度分析</button>
      </div>
    `
  });
}

export function favoriteCard(job, index) {
  return jobCardTemplate(job, index, {
    selected: false,
    favorite: true,
    starTitle: "取消收藏",
    actions: `
      <div class="favorite-actions">
        <button class="primary" data-action="intelligence" type="button">深度分析结果</button>
      </div>
    `
  });
}

function jobCardTemplate(job, index, options) {
  const tags = keywordsFor(job).slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");

  return `
    <article class="job-card ${options.selected ? "selected" : ""} ${options.favorite ? "favorite-card" : ""}" data-job="${index}">
      <div class="job-top">
        <div>
          <h2>${escapeHtml(job.title || "未识别职位名")}</h2>
          <p>${escapeHtml(job.company || "公司待核对")}<br>${escapeHtml(metaLine(job))}</p>
        </div>
        <button class="star-btn ${job.starred ? "active" : ""}" data-action="star" type="button" title="${options.starTitle}" aria-label="${options.starTitle}">★</button>
      </div>
      <div class="job-tags">${tags}</div>
      ${options.actions}
    </article>
  `;
}

function metaLine(job) {
  return [job.location, job.salary, job.experience, job.education].filter(Boolean).join(" · ") || "岗位信息待核对";
}
