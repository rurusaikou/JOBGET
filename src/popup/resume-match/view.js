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
  qs("#analyzeResumeMatchBtn").textContent = analyzeButtonText(state);

  if (state.resumeMatchLoading) {
    setMatchDetailsVisible(false);
    renderShell("分析中", "正在结合 JD、JD 分析结果和简历进行匹配分析...", 55, "loading");
    clearMatchDetails();
    return;
  }

  if (state.resumeMatchError) {
    setMatchDetailsVisible(false);
    renderShell("分析失败", state.resumeMatchError, 0, "error");
    clearMatchDetails();
    return;
  }

  if (!result) {
    setMatchDetailsVisible(false);
    renderShell("等待分析", "简历已上传，点击右上角“开始分析”生成匹配结果。", 0, "idle");
    clearMatchDetails();
    return;
  }

  setMatchDetailsVisible(true);
  const score = LEVEL_SCORE[result.level] || 60;
  renderShell(result.level, result.reason || "已完成匹配分析。", score, "done");
  qs("#matchMatchedCount").textContent = String(result.directMatches.length);
  qs("#matchPartialCount").textContent = String(result.transferableMatches.length);
  qs("#matchMissingCount").textContent = String(result.gaps.length);
  qs("#matchList").innerHTML = [
    directSectionHtml(result.directMatches),
    transferableSectionHtml(result.transferableMatches),
    gapSectionHtml(result.gaps)
  ].join("");
  qs("#revisionPriorityText").textContent = revisionPriorityText(result.revisions);
  qs("#suggestList").innerHTML = result.revisions.length
    ? result.revisions.map(revisionHtml).join("")
    : '<p class="match-empty">当前没有需要优先修改的内容。</p>';
}

function setMatchDetailsVisible(visible) {
  qs("#matchMetricGrid").classList.toggle("is-hidden", !visible);
  qs("#matchList").classList.toggle("is-hidden", !visible);
  qs("#resumeSuggestionsCard").classList.toggle("is-hidden", !visible);
  qs("#revisionPrompt").classList.toggle("is-hidden", visible);
}

function clearMatchDetails() {
  qs("#matchList").innerHTML = "";
  qs("#suggestList").innerHTML = "";
  qs("#revisionPriorityText").textContent = "优先补强：产品落地表达、AI 能力迁移、求职动机";
}

function analyzeButtonText(state) {
  if (state.resumeMatchLoading) return "分析中";
  if (state.resumeMatchResult || state.resumeMatchError) return "重新分析";
  return "开始分析";
}

function renderShell(level, reason, score, status = "idle") {
  qs("#matchScore").textContent = level;
  qs("#matchPercent").textContent = `${score}%`;
  qs("#matchPercent").classList.toggle("is-hidden", status !== "done");
  qs("#matchVerdict").textContent = reason;
  qs("#matchProgress").style.width = status === "done" ? `${score}%` : "";
  qs("#matchProgress").parentElement.dataset.status = status;
  qs("#matchMatchedCount").textContent = "0";
  qs("#matchPartialCount").textContent = "0";
  qs("#matchMissingCount").textContent = "0";
}

function directSectionHtml(items) {
  return sectionHtml("直接匹配", items, "matched", (item) => matchRecordHtml(item.requirement || "对应岗位要求", `
      ${fieldHtml("现有经历", item.experience)}
      ${fieldHtml("证明点", item.proof)}
  `));
}

function transferableSectionHtml(items) {
  return sectionHtml("可迁移能力", items, "partial", (item) => matchRecordHtml(item.requirement || "岗位要求", `
      ${fieldHtml("现有经历", item.experience)}
      ${fieldHtml("可迁移能力", item.ability)}
      ${fieldHtml("迁移边界", item.boundary)}
  `));
}

function gapSectionHtml(items) {
  return sectionHtml("关键缺口", items, "missing", (item) => matchRecordHtml(item.gap || "缺口", `
      ${fieldHtml("对投递的影响", item.impact)}
  `, "single"));
}

function sectionHtml(title, items, status, renderItem) {
  if (!items.length) {
    return `
      <section class="match-section ${status}">
        <header>
          <div class="match-section-title">
            <span class="match-section-dot"></span>
            <strong>${escapeHtml(title)}</strong>
            <em>${escapeHtml(sectionDescription(status))}</em>
          </div>
        </header>
        <p class="match-empty">无明显内容。</p>
      </section>
    `;
  }

  return `
    <section class="match-section ${status}">
      <header>
        <div class="match-section-title">
          <span class="match-section-dot"></span>
          <strong>${escapeHtml(title)}</strong>
          <em>${escapeHtml(sectionDescription(status))}</em>
        </div>
      </header>
      <div class="match-record-list">
        ${items.map(renderItem).join("")}
      </div>
    </section>
  `;
}

function matchRecordHtml(title, details, layout = "") {
  return `
    <details class="match-record">
      <summary>
        <span class="match-record-main">${escapeHtml(title)}</span>
        <span class="match-record-toggle">
          <span class="toggle-open">展开⌄</span>
          <span class="toggle-close">收起⌃</span>
        </span>
      </summary>
      <dl class="match-record-fields ${escapeHtml(layout)}">${details}</dl>
    </details>
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

function revisionHtml(item, index) {
  if (typeof item === "string") {
    return `
      <article class="resume-revision">
        <span class="revision-index">${String(index + 1).padStart(2, "0")}</span>
        <p>${escapeHtml(item)}</p>
      </article>
    `;
  }
  const title = item.summary || item.direction || "简历修改建议";
  const bodyText = item.direction || item.rewrite || item.summary || "";
  const pillText = item.original ? `原内容：${item.original}` : item.rewrite ? `可改为：${item.rewrite}` : "";
  const details = [
    item.original ? `<p><span>原内容</span>${escapeHtml(item.original)}</p>` : "",
    item.direction ? `<p><span>建议方向</span>${escapeHtml(item.direction)}</p>` : "",
    item.rewrite ? `<p><span>可改为</span>${escapeHtml(item.rewrite)}</p>` : ""
  ].filter(Boolean).join("");

  return `
    <details class="resume-revision">
      <summary>
        <span class="revision-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="revision-summary-main">
          <strong>${escapeHtml(title)}</strong>
          ${bodyText ? `<em>${escapeHtml(bodyText)}</em>` : ""}
          ${pillText ? `<small>${escapeHtml(pillText)}</small>` : ""}
        </span>
        <span class="resume-revision-toggle">
          <span class="toggle-open">⌄</span>
          <span class="toggle-close">⌃</span>
        </span>
      </summary>
      <div class="resume-revision-body">${details}</div>
    </details>
  `;
}

function revisionPriorityText(items) {
  const titles = (items || [])
    .map((item) => typeof item === "string" ? item : item.summary || item.direction || "")
    .map((text) => text.split(/[，,。；;]/)[0].trim())
    .filter(Boolean)
    .slice(0, 3);
  return titles.length ? `优先补强：${titles.join("、")}` : "优先补强：产品落地表达、AI 能力迁移、求职动机";
}

function sectionDescription(status) {
  if (status === "matched") return "具备岗位所需的关键经验和能力";
  if (status === "partial") return "相关经验可迁移到该岗位";
  return "当前简历中缺乏的关键要求或证据";
}
