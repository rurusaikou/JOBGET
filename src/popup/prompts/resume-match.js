export const RESUME_MATCH_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overall", "directMatches", "transferableMatches", "gaps", "revisions"],
  properties: {
    overall: {
      type: "object",
      additionalProperties: false,
      required: ["level", "reason"],
      properties: {
        level: {
          type: "string",
          enum: ["高匹配", "中高匹配", "中匹配", "中低匹配", "低匹配"]
        },
        reason: {
          type: "string",
          description: "一句话说明决定匹配等级的主要原因"
        }
      }
    },
    directMatches: {
      type: "array",
      description: "直接匹配，最多 3 条",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requirement", "experience", "proof"],
        properties: {
          requirement: { type: "string" },
          experience: { type: "string" },
          proof: { type: "string" }
        }
      }
    },
    transferableMatches: {
      type: "array",
      description: "可迁移能力，最多 3 条",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requirement", "experience", "ability", "boundary"],
        properties: {
          requirement: { type: "string" },
          experience: { type: "string" },
          ability: { type: "string" },
          boundary: { type: "string" }
        }
      }
    },
    gaps: {
      type: "array",
      description: "关键缺口，最多 3 条",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gap", "impact"],
        properties: {
          gap: { type: "string" },
          impact: { type: "string" }
        }
      }
    },
    revisions: {
      type: "array",
      description: "简历修改建议，最多 3 条",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["summary", "original", "direction", "rewrite"],
        properties: {
          summary: { type: "string" },
          original: { type: "string" },
          direction: { type: "string" },
          rewrite: { type: "string" }
        }
      }
    }
  }
};

export function resumeMatchMessages({ job, resumeText, jdAnalysisText }) {
  // Prompt 保持整段文本，方便产品侧直接编辑；调用层会转换为 Responses API input。
  const prompt = `
你是一位资深 HR 招聘专家，请基于 JD、JD 分析结果和候选人简历，判断岗位匹配并给出简历修改建议。

输入：
公司：${job.company || "未识别"}
岗位：${job.title || "未识别"}
JD：${job.description || "未识别"}
JD分析结果：${jdAnalysisText || "未分析"}
简历：${resumeText || "未识别"}

任务：判断整体匹配等级、直接匹配证据、可迁移能力、关键缺口和简历修改建议。不要重新总结 JD，不泛泛评价整份简历。

原则：
- 只保留明显影响本次投递的信息，按重要性排序
- 区分直接匹配、可迁移能力、真实缺口，一个观点只出现一次
- 允许迁移能力，不允许迁移经历；不得虚构或扩大职责、技能、成果和数据
- 修改建议只能基于简历已有事实，调整表达角度、信息重点和呈现顺序
- 缺口只写无法靠表达优化解决、且影响初筛或面试判断的内容
- 每类最多 3 条；reason 不超过 40 字；普通字段尽量不超过 45 字；rewrite 不超过 80 字

输出必须严格符合 schema，不要 Markdown、解释、推理过程、自我纠错或 JSON 外文字。无内容用空数组，字段无内容用空字符串。
`.trim();

  return [
    {
      role: "system",
      content: "你只输出符合既定 schema 的最终 JSON 对象，不输出解释、推理过程或 Markdown。"
    },
    {
      role: "user",
      content: prompt
    }
  ];
}
