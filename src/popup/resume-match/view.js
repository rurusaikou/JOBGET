import { escapeHtml, qs } from "../dom.js";

const LEVEL_SCORE = {
  "高匹配": 92,
  "中高匹配": 78,
  "中匹配": 62,
  "中低匹配": 42,
  "低匹配": 24
};

export function renderResumeMatchView(state) {
  const result = state.resumeMatchResult;
  qs("#analyzeResumeMatchBtn").disabled = state.resumeMatchLoading || !state.resumeUploaded;

  if (state.resumeMatchLoading) {
    renderShell("分析中", "正在结合 JD、JD 分析结果和简历进行匹配分析...", 18);
    qs("#matchList").innerHTML = '<article class="match-item"><p class="match-empty">AI 分析中，请稍候。</p></article>';
    qs("#suggestList").innerHTML = "";
    return;
  }

  if (state.resumeMatchError) {
    renderShell("分析失败", state.resumeMatchError, 0);
    qs("#matchList").innerHTML = '<article class="match-item missing"><p class="match-empty">分析失败，请点击“重新分析”再次尝试。</p></article>';
    qs("#suggestList").innerHTML = "";
    return;
  }

  if (!result) {
    renderShell("等待分析", "上传简历后会基于当前 JD 发起匹配分析。", 0);
    qs("#matchList").innerHTML = "";
    qs("#suggestList").innerHTML = "";
    return;
  }

  const score = LEVEL_SCORE[result.level] || 60;
  renderShell(result.level, result.reason || "已完成匹配分析。", score);
  qs("#matchMatchedCount").textContent = String(result.directMatches.length);
  qs("#matchPartialCount").textContent = String(result.transferableMatches.length);
  qs("#matchMissingCount").textContent = String(result.gaps.length);
  qs("#matchList").innerHTML = [
    directSectionHtml(result.directMatches),
    transferableSectionHtml(result.transferableMatches),
    gapSectionHtml(result.gaps)
  ].join("");
  qs("#suggestList").innerHTML = result.revisions.length
    ? result.revisions.map(revisionHtml).join("")
    : '<p class="match-empty">当前没有需要优先修改的内容。</p>';
}

function renderShell(level, reason, score) {
  qs("#matchScore").textContent = level;
  qs("#matchVerdict").textContent = reason;
  qs("#matchProgress").style.width = `${score}%`;
  qs("#matchMatchedCount").textContent = "0";
  qs("#matchPartialCount").textContent = "0";
  qs("#matchMissingCount").textContent = "0";
}

function directSectionHtml(items) {
  return sectionHtml("直接匹配", items, "matched", (item) => `
    <div class="match-record-main">${escapeHtml(item.requirement || "对应岗位要求")}</div>
    <dl class="match-record-fields">
      ${fieldHtml("现有经历", item.experience)}
      ${fieldHtml("证明点", item.proof)}
    </dl>
  `);
}

function transferableSectionHtml(items) {
  return sectionHtml("可迁移能力", items, "partial", (item) => `
    <div class="match-record-main">${escapeHtml(item.requirement || "岗位要求")}</div>
    <dl class="match-record-fields">
      ${fieldHtml("现有经历", item.experience)}
      ${fieldHtml("可迁移能力", item.ability)}
      ${fieldHtml("迁移边界", item.boundary)}
    </dl>
  `);
}

function gapSectionHtml(items) {
  return sectionHtml("关键缺口", items, "missing", (item) => `
    <div class="match-record-main">${escapeHtml(item.gap || "缺口")}</div>
    <dl class="match-record-fields">
      ${fieldHtml("对投递的影响", item.impact)}
    </dl>
  `);
}

function sectionHtml(title, items, status, renderItem) {
  if (!items.length) {
    return `
      <section class="match-section ${status}">
        <header>
          <strong>${escapeHtml(title)}</strong>
          <span>${statusLabel(status)}</span>
        </header>
        <p class="match-empty">无明显内容。</p>
      </section>
    `;
  }

  return `
    <section class="match-section ${status}">
      <header>
        <strong>${escapeHtml(title)}</strong>
        <span>${statusLabel(status)}</span>
      </header>
      <div class="match-record-list">
        ${items.map((item) => `<article class="match-record">${renderItem(item)}</article>`).join("")}
      </div>
    </section>
  `;
}

function fieldHtml(label, value) {
  if (!value) return "";
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function revisionHtml(item) {
  if (typeof item === "string") {
    return `<article class="resume-revision"><p>${escapeHtml(item)}</p></article>`;
  }
  return `
    <article class="resume-revision">
      ${item.summary ? `<strong>${escapeHtml(item.summary)}</strong>` : ""}
      ${item.original ? `<p><span>原内容</span>${escapeHtml(item.original)}</p>` : ""}
      ${item.direction ? `<p><span>建议方向</span>${escapeHtml(item.direction)}</p>` : ""}
      ${item.rewrite ? `<p><span>可改为</span>${escapeHtml(item.rewrite)}</p>` : ""}
    </article>
  `;
}

function statusLabel(status) {
  if (status === "matched") return "直接匹配";
  if (status === "partial") return "可迁移";
  return "真实缺口";
}
