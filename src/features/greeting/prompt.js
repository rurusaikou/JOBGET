export const GREETING_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["greeting"],
  properties: {
    greeting: {
      type: "string",
      description: "招聘平台首次沟通开场白"
    }
  }
};

export function greetingMessages({ job, highlights, toneLabel, maxChars }) {
  const prompt = `
你是一位资深招聘专家，请为候选人本人生成招聘平台首次沟通开场白。

输入：
公司：${job.company || "未识别"}
岗位：${job.title || "未识别"}
可使用的匹配亮点：${highlights && highlights.length ? JSON.stringify(highlights) : "没有可验证的匹配亮点，只表达申请岗位及沟通意愿，不声称具备特定经验"}
语气：${toneLabel}
字数上限：${maxChars} 字

任务：不要重新分析 JD 或简历。综合提供的多个匹配亮点及其边界，生成一段开场白。

要求：
- 使用第一人称，自然说明申请岗位
- 根据字数空间选择 1-3 个互补亮点，优先覆盖最重要的直接匹配
- 将亮点组织成自然、连贯的表达，不逐项罗列，不重复同一事实
- 缺少直接经验时，只提炼真实可迁移能力，不虚构、不拔高
- 不写“我的核心优势是”“高度匹配”“完整闭环”“沉淀能力”“技术与业务的翻译者”
- 不提“根据匹配分析”“根据 JD 分析”等工具痕迹
- 语言符合“${toneLabel}”，自然、克制、具体，结尾简单表达沟通意愿
- 不超过 ${maxChars} 个汉字
- 只生成开场白，不解释选择依据

输出必须严格符合 schema，不要 Markdown、解释、推理过程或 JSON 外文字。
`.trim();

  return [
    {
      role: "system",
      content: "你只输出符合既定 schema 的可解析 JSON，不输出解释、推理过程或 Markdown。"
    },
    {
      role: "user",
      content: prompt
    }
  ];
}
