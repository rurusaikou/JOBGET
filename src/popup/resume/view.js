import { escapeHtml, qs } from "../dom.js";

const BASIC_FIELDS = [
  ["basicInfo.name", "姓名", "姓名"],
  ["basicInfo.jobIntent", "求职意向", "目标岗位"],
  ["basicInfo.location", "所在地", "城市"],
  ["basicInfo.phone", "手机", "手机号"],
  ["basicInfo.email", "邮箱", "邮箱", "wide"]
];

const EDUCATION_FIELDS = [
  ["school", "学校"],
  ["degree", "学历"],
  ["major", "专业"],
  ["startDate", "开始"],
  ["endDate", "结束"]
];

const EXPERIENCE_FIELDS = [
  ["organization", "公司/组织"],
  ["role", "岗位/角色"],
  ["startDate", "开始"],
  ["endDate", "结束"]
];

const PROJECT_FIELDS = [
  ["name", "项目/案例"],
  ["role", "角色"],
  ["startDate", "开始"],
  ["endDate", "结束"]
];

const ACHIEVEMENT_PATTERN = /(\d+%?|\d+万|\d+家|\d+人|提升|降低|完成|推动|达成|优化|管理|交付)/;

const SECTION_META = {
  education: { title: "教育经历", fields: EDUCATION_FIELDS, render: educationHtml, empty: emptyEducationEntry },
  workExperience: { title: "工作经历", fields: EXPERIENCE_FIELDS, render: experienceHtml, empty: emptyExperienceEntry },
  projects: { title: "项目经历", fields: PROJECT_FIELDS, render: projectHtml, empty: emptyProjectEntry }
};

export function renderResumeEditor(resume) {
  if (!resume) return;

  const basic = resume.basicInfo || {};
  qs("#resumePaper").innerHTML = `
    <header class="resume-editor-head">
      ${BASIC_FIELDS.map(([field, label, placeholder, className]) => fieldInputHtml({
        field,
        label,
        value: readPath(basic, field.replace("basicInfo.", "")),
        placeholder,
        className
      })).join("")}
    </header>
    ${entrySectionHtml("education", resume.education)}
    ${entrySectionHtml("workExperience", resume.workExperience)}
    ${entrySectionHtml("projects", resume.projects)}
    ${listSectionHtml("技能 / 能力", "skills", resume.skills)}
    ${listSectionHtml("证书 / 荣誉", "certifications", resume.certifications)}
    ${textSectionHtml("自我评价", "selfEvaluation", resume.selfEvaluation)}
  `;
  renderResumeSummary(resume);
}

export function collectResumeFromEditor(previousResume) {
  const nextResume = structuredCloneSafe(previousResume);

  // 编辑器以 Resume JSON 为唯一数据源，保存时重新收集表单值，避免维护一份易漂移的 HTML 状态。
  nextResume.basicInfo = {
    name: valueOf("basicInfo.name"),
    jobIntent: valueOf("basicInfo.jobIntent"),
    location: valueOf("basicInfo.location"),
    phone: valueOf("basicInfo.phone"),
    email: valueOf("basicInfo.email")
  };
  nextResume.education = collectEntries("education", collectEducationEntry);
  nextResume.workExperience = collectEntries("workExperience", collectExperienceEntry);
  nextResume.projects = collectEntries("projects", collectProjectEntry);
  nextResume.skills = linesOf("skills");
  nextResume.certifications = linesOf("certifications");
  nextResume.selfEvaluation = valueOf("selfEvaluation");
  nextResume.source = {
    ...(nextResume.source || {}),
    updatedAt: new Date().toISOString()
  };
  return nextResume;
}

export function applyResumeEditorAction(resume, action, section, index) {
  const nextResume = collectResumeFromEditor(resume);
  const meta = SECTION_META[section];
  if (!meta) return nextResume;

  nextResume[section] = Array.isArray(nextResume[section]) ? nextResume[section] : [];
  if (action === "add") nextResume[section].push(meta.empty());
  if (action === "remove") nextResume[section].splice(index, 1);
  return nextResume;
}

function entrySectionHtml(key, rows) {
  const meta = SECTION_META[key];
  const safeRows = Array.isArray(rows) ? rows : [];
  return `
    <section class="resume-editor-section" data-section="${key}">
      <div class="resume-section-title">
        <h3>${escapeHtml(meta.title)}</h3>
        <button class="resume-icon-btn" data-resume-action="add" data-section="${escapeHtml(key)}" type="button">新增</button>
      </div>
      ${safeRows.length ? safeRows.map(meta.render).join("") : emptySectionHint()}
    </section>
  `;
}

function educationHtml(item, index) {
  return `
    <article class="resume-entry" data-entry="education" data-index="${index}">
      ${entryToolbarHtml("education", index)}
      ${compactFields(EDUCATION_FIELDS, item)}
      ${textareaHtml("description", "补充说明", item.description)}
    </article>
  `;
}

function experienceHtml(item, index) {
  return `
    <article class="resume-entry" data-entry="workExperience" data-index="${index}">
      ${entryToolbarHtml("workExperience", index)}
      ${compactFields(EXPERIENCE_FIELDS, item)}
      ${textareaHtml("description", "职责与成果", item.description)}
    </article>
  `;
}

function projectHtml(item, index) {
  return `
    <article class="resume-entry" data-entry="projects" data-index="${index}">
      ${entryToolbarHtml("projects", index)}
      ${compactFields(PROJECT_FIELDS, item)}
      ${textareaHtml("description", "项目内容与成果", item.description)}
    </article>
  `;
}

function listSectionHtml(title, key, items) {
  return `
    <section class="resume-editor-section">
      <div class="resume-section-title">
        <h3>${escapeHtml(title)}</h3>
      </div>
      <textarea data-field="${key}" rows="4">${escapeHtml((items || []).join("\n"))}</textarea>
    </section>
  `;
}

function textSectionHtml(title, key, text) {
  return `
    <section class="resume-editor-section">
      <div class="resume-section-title">
        <h3>${escapeHtml(title)}</h3>
      </div>
      <textarea data-field="${key}" rows="5">${escapeHtml(text)}</textarea>
    </section>
  `;
}

function entryToolbarHtml(section, index) {
  return `
    <div class="resume-entry-toolbar">
      <span>条目 ${index + 1}</span>
      <button class="resume-icon-btn danger" data-resume-action="remove" data-section="${escapeHtml(section)}" data-index="${index}" type="button">删除</button>
    </div>
  `;
}

function emptySectionHint() {
  return '<p class="resume-empty">未识别到内容，可点击“新增”手动补充。</p>';
}

function compactFields(fields, item) {
  return `
    <div class="resume-entry-grid">
      ${fields.map(([key, label]) => keyedInputHtml(key, label, item[key])).join("")}
    </div>
  `;
}

function fieldInputHtml({ field, label, value, placeholder, className = "" }) {
  return `
    <label class="resume-field ${escapeHtml(className)}">
      <span>${escapeHtml(label)}</span>
      <input data-field="${escapeHtml(field)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">
    </label>
  `;
}

function keyedInputHtml(key, label, value) {
  return `
    <label class="resume-field">
      <span>${escapeHtml(label)}</span>
      <input data-key="${escapeHtml(key)}" value="${escapeHtml(value)}">
    </label>
  `;
}

function textareaHtml(key, label, value) {
  const text = Array.isArray(value) ? value.join("\n") : value || "";
  return `
    <label class="resume-field resume-textarea">
      <span>${escapeHtml(label)}</span>
      <textarea data-key="${escapeHtml(key)}" rows="4">${escapeHtml(text)}</textarea>
    </label>
  `;
}

function renderResumeSummary(resume) {
  const source = resume.source || {};
  qs("#resumeSummary").innerHTML = [
    ["来源文件", source.fileName || "-"],
    ["教育经历", `${(resume.education || []).length} 条`],
    ["工作经历", `${(resume.workExperience || []).length} 条`],
    ["项目经历", `${(resume.projects || []).length} 条`],
    ["技能/能力", `${(resume.skills || []).length} 条`]
  ].map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `).join("");
}

function valueOf(field) {
  const node = qs(`[data-field="${field}"]`);
  return node ? node.value.trim() : "";
}

function linesOf(field) {
  return valueOf(field).split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function collectEntries(name, build) {
  return Array.from(document.querySelectorAll(`[data-entry="${name}"]`))
    .map((entry) => build(entry))
    .filter(hasEntryContent);
}

function collectEducationEntry(entry) {
  return {
    school: entryValue(entry, "school"),
    degree: entryValue(entry, "degree"),
    major: entryValue(entry, "major"),
    startDate: entryValue(entry, "startDate"),
    endDate: entryValue(entry, "endDate"),
    description: entryLines(entry, "description"),
    achievements: []
  };
}

function collectExperienceEntry(entry) {
  const description = entryLines(entry, "description");
  return {
    organization: entryValue(entry, "organization"),
    role: entryValue(entry, "role"),
    startDate: entryValue(entry, "startDate"),
    endDate: entryValue(entry, "endDate"),
    description,
    achievements: description.filter(isAchievementLine)
  };
}

function collectProjectEntry(entry) {
  const description = entryLines(entry, "description");
  return {
    name: entryValue(entry, "name"),
    role: entryValue(entry, "role"),
    startDate: entryValue(entry, "startDate"),
    endDate: entryValue(entry, "endDate"),
    description,
    achievements: description.filter(isAchievementLine)
  };
}

function entryValue(entry, key) {
  const node = entry.querySelector(`[data-key="${key}"]`);
  return node ? node.value.trim() : "";
}

function entryLines(entry, key) {
  return entryValue(entry, key).split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function isAchievementLine(line) {
  return ACHIEVEMENT_PATTERN.test(line);
}

function hasEntryContent(entry) {
  return Object.values(entry).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  });
}

function readPath(source, key) {
  return source && source[key] ? source[key] : "";
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function emptyEducationEntry() {
  return { school: "", degree: "", major: "", startDate: "", endDate: "", description: [], achievements: [] };
}

function emptyExperienceEntry() {
  return { organization: "", role: "", startDate: "", endDate: "", description: [], achievements: [] };
}

function emptyProjectEntry() {
  return { name: "", role: "", startDate: "", endDate: "", description: [], achievements: [] };
}
