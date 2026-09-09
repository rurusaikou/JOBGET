export const MANUAL_JD_MAX_LENGTH = 1000;

export function createManualJob(fields) {
  const description = String(fields.description || "").trim();
  if (!description) throw new Error("请粘贴 JD 内容");
  if (String(fields.description || "").length > MANUAL_JD_MAX_LENGTH) throw new Error("JD 内容不能超过 1000 字");
  return {
    title: String(fields.title || "").trim(),
    company: String(fields.company || "").trim(),
    experience: String(fields.experience || "").trim(),
    salary: String(fields.salary || "").trim(),
    description,
    sourceSite: "手动添加",
    sourceUrl: ""
  };
}
