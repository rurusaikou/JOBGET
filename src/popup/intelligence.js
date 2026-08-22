import { JOB_KEYWORDS } from "./data/job-keywords.js";

// 本地规则仍服务于关键词和沟通草稿；深度分析结果只使用模型返回。
export function intelligenceFor(job) {
  const keywords = keywordsFor(job);
  const responsibilities = responsibilitiesFor(job);
  const audience = audienceFor(job, keywords);
  const suggestions = suggestionsFor(job, keywords);
  const greeting = greetingFor(job, keywords);
  const deepAnalysis = job && job.deepAnalysis ? job.deepAnalysis : null;

  return {
    audience,
    keywords,
    responsibilities,
    suggestions,
    greeting,
    analysis: [
      ...audience,
      `关键词集中在：${keywords.slice(0, 8).join("、") || "岗位职责、经验要求、协作能力"}。`,
      "简历修改建议请在“匹配”页查看，那里会结合当前 JD 和已结构化的 Resume JSON 生成。"
    ],
    deepAnalysis
  };
}

export function keywordsFor(job) {
  const text = `${job.title} ${job.description}`.toLowerCase();
  const sourceText = jobSearchTextWithoutKeywords(job);
  const hits = JOB_KEYWORDS.filter((keyword) => text.includes(keyword.toLowerCase()) || sourceText.includes(keyword));
  return hits.length ? hits : [job.sourceSite, job.experience, job.education].filter(Boolean).slice(0, 4);
}

export function suggestionsFor(job, keywords) {
  const suggestions = ["上传并结构化简历后，请到“匹配”页查看针对当前 JD 的修改建议。"];
  if (keywords.some((keyword) => /AI|LLM|Agent|RAG|Prompt/i.test(keyword))) {
    suggestions.push("当前 JD 强调 AI 相关能力，后续匹配时应优先检查简历中是否有场景、指标和结果证据。");
  }
  if (job.experience) {
    suggestions.push(`当前 JD 标注 ${job.experience}，后续匹配时应检查简历经历年限和独立负责程度。`);
  }
  return suggestions.slice(0, 4);
}

export function greetingFor(job, keywords) {
  const title = job.title || "这个岗位";
  const company = job.company || "贵司";
  const keywordText = keywords.slice(0, 4).join("、") || "岗位职责、产品目标和跨团队协作";
  return `你好，我对${company}的${title}岗位很感兴趣。我的经历和岗位中提到的${keywordText}比较匹配，曾参与产品需求拆解、方案推进和上线复盘，也关注用数据验证产品效果。希望有机会进一步沟通这个岗位的目标和团队当前最需要解决的问题。`;
}

function jobSearchTextWithoutKeywords(job) {
  return [job.title, job.company, job.location, job.salary, job.experience, job.education, job.description].join(" ");
}

function responsibilitiesFor(job) {
  const lines = String(job.description || "")
    .split(/\n|。|；|;|\. /)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length >= 8 && line.length <= 120);

  return lines.slice(0, 4).length ? lines.slice(0, 4) : [
    "拆解岗位目标并推动核心工作落地。",
    "与业务、设计、研发等团队协作推进方案。",
    "基于用户反馈和数据表现持续迭代。"
  ];
}

function audienceFor(job, keywords) {
  const title = job.title || "该岗位";
  const text = `${job.title} ${job.description}`;
  const audience = [`${title} 需要能把岗位目标拆成可执行方案，并持续推进落地的人。`];

  if (/AI|LLM|Agent|RAG|算法/i.test(text)) {
    audience.push("需要理解 AI 产品能力边界，能把模型能力转成清晰的用户场景和评估指标。");
  }
  if (/数据|指标|增长|转化|留存|activation|retention|analytics/i.test(text)) {
    audience.push("需要能用数据判断问题优先级，并解释产品动作带来的业务结果。");
  }
  if (/协作|跨团队|研发|设计|engineer|design|stakeholder/i.test(text)) {
    audience.push("需要有跨团队沟通和项目推进能力，能协调不同角色完成上线。");
  }
  if (audience.length < 3 && keywords.length) {
    audience.push(`简历中应突出与 ${keywords.slice(0, 3).join("、")} 相关的证据。`);
  }

  return audience.slice(0, 4);
}
