export const DEEP_ANALYSIS_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["essence", "coreRequirements", "hiddenRequirements", "idealCandidate"],
  properties: {
    essence: {
      type: "array",
      description: "岗位本质，1-2 条字符串",
      items: {
        type: "string"
      }
    },
    coreRequirements: {
      type: "array",
      description: "核心要求，1-5 条字符串，按对录用决策影响从高到低排序",
      items: {
        type: "string"
      }
    },
    hiddenRequirements: {
      type: "array",
      description: "隐形要求，0-5 条字符串，每条格式为“结论｜判断依据”",
      items: {
        type: "string"
      }
    },
    idealCandidate: {
      type: "array",
      description: "理想候选人，1 条字符串",
      items: {
        type: "string"
      }
    }
  }
};

export function deepAnalysisMessages(job) {
  // Prompt 保持整段文本，方便产品侧直接编辑；调用层会转换为 Responses API input。
  const prompt = `
你是一位资深 HR 招聘专家，请从招聘方和业务方视角分析 JD。

输入：
公司：${job.company || "未识别"}
岗位：${job.title || "未识别"}
地点：${job.location || "未识别"}
薪资：${job.salary || "未识别"}
经验：${job.experience || "未识别"}
学历：${job.education || "未识别"}
JD：${job.description}

任务：判断岗位真正要解决的问题、筛选候选人的关键标准、最影响竞争力的能力，以及 JD 未明说但有依据的隐形要求。

原则：
- 只保留明显影响录用决策或候选人判断的信息
- 删除通用要求、重复观点、原文改写和依据不足的推测
- 隐形要求必须是 JD 未直接写明、但有明确信息依据且有判断价值
- 结论优先，不展开分析过程；数量按 JD 信息决定，不凑条数

输出必须严格符合 schema，不要 Markdown、代码块、解释或推理过程。隐形要求每条使用“结论｜判断依据”格式。
`.trim();

  return [
    {
      role: "system",
      content: "你只输出符合既定 schema 的可解析 JSON，不输出解释或推理过程。"
    },
    {
      role: "user",
      content: prompt
    }
  ];
}
