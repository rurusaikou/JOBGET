const shortString = (description, maxLength = 160) => ({ type: "string", description, maxLength });
const stringArray = (description, maxItems, maxLength = 160) => ({
  type: "array",
  description,
  maxItems,
  items: shortString(description, maxLength)
});

const experienceEntry = {
  type: "object",
  additionalProperties: false,
  required: ["organization", "role", "period", "details", "technologies"],
  properties: {
    organization: shortString("公司、学校、实验室或组织名称；原文没有则为空", 100),
    role: shortString("职位或角色；原文没有则为空", 80),
    period: shortString("时间范围；保持原文语义", 60),
    details: stringArray("来自简历的事实证据；保留职责、动作、成果和量化信息，不补写不存在的事实", 8, 180),
    technologies: stringArray("该经历中简历明确出现的技术、工具、平台或方法", 12, 60)
  }
};

export const RESUME_PROFILE_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "jobIntent",
    "location",
    "education",
    "workExperience",
    "projects",
    "skills",
    "certifications",
    "languages",
    "otherEvidence"
  ],
  properties: {
    jobIntent: shortString("简历明确写出的求职意向；没有则为空", 100),
    location: shortString("简历明确写出的所在地；没有则为空", 80),
    education: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["school", "degree", "major", "period", "details"],
        properties: {
          school: shortString("学校", 100),
          degree: shortString("学历或学位", 60),
          major: shortString("专业", 100),
          period: shortString("时间范围", 60),
          details: stringArray("成绩、研究方向等教育事实", 5, 140)
        }
      }
    },
    workExperience: {
      type: "array",
      description: "雇主级工作经历。项目型工作可在 projects 中再次按项目维度展开。",
      maxItems: 8,
      items: experienceEntry
    },
    projects: {
      type: "array",
      description: "所有有名称或可明确识别的工作项目、科研项目、课程/实践项目；即使位于工作经历章节中也要提取。",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "role", "period", "organization", "details", "technologies"],
        properties: {
          name: shortString("项目或课题名称", 140),
          role: shortString("项目角色；原文没有则为空", 80),
          period: shortString("时间范围；原文没有则为空", 60),
          organization: shortString("所属公司、学校或组织；无法确定则为空", 100),
          details: stringArray("项目中的原始事实证据，优先保留需求、方案、协作、交付、技术和量化成果", 10, 180),
          technologies: stringArray("项目中简历明确出现的技术、工具、平台或方法", 15, 60)
        }
      }
    },
    skills: stringArray("简历明确列出的技能，不做能力扩写", 40, 60),
    certifications: stringArray("证书、资格或奖项", 20, 100),
    languages: stringArray("语言能力", 12, 80),
    otherEvidence: stringArray("无法归入以上字段但会影响岗位匹配的事实，例如论文、排名、产品实践、培训或交付经历", 15, 180)
  }
};

export function resumeProfileMessages(rawText) {
  const prompt = `
你是简历结构化抽取器。请把下面的简历全文整理成可复用的 Resume Profile。

目标不是“总结得更短”，而是“尽量完整地保存会影响岗位匹配的事实”。

规则：
- 只提取简历明确存在的信息；禁止补写、猜测、扩张职责或成果
- 不输出姓名、手机号、邮箱等个人联系方式
- workExperience 表示雇主/任职层级；projects 表示具体项目/课题层级，两者允许从不同角度引用同一段经历
- 任何明确的工作项目、科研项目、知识库、平台建设、迁移、研究课题都应尽量进入 projects，不要因为章节标题不标准而丢失
- details 用简历中的事实表达，优先保留动作、对象、结果、量化数据和交付内容
- technologies 只能写简历中明确出现的技术、工具、平台或方法
- 不要把“熟悉/了解”扩写成“精通/负责”
- 原文没有的字段用空字符串或空数组
- 输出必须严格符合 schema，不要 Markdown、解释、推理过程或 JSON 外文字

简历全文：
${rawText}
`.trim();

  return [
    {
      role: "system",
      content: "你只做忠实的简历事实抽取与结构化，不创造候选人经历，并且只输出符合既定 schema 的最终 JSON。"
    },
    { role: "user", content: prompt }
  ];
}
