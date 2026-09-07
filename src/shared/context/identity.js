// ID 标识对象，SHA-256 标识完整内容；收藏、文件名和解析时间不参与内容版本。
export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function contentVersion(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canonical(value) {
  if (typeof value === "string") return value.replace(/\r\n?/g, "\n").trim();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value ?? null;
}

export function jobContent(job) {
  return Object.fromEntries(["title", "company", "location", "experience", "education", "salary", "description"]
    .map((key) => [key, job[key] || ""]));
}

export function resumeContent(resume) {
  // 结构化内容也参与版本，防止规则或人工修正后继续使用旧匹配。
  return Object.fromEntries(["rawText", "basicInfo", "education", "workExperience", "projects", "skills", "certifications", "selfEvaluation", "sections"]
    .map((key) => [key, resume[key] ?? null]));
}
