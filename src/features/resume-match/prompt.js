const shortString = (description, maxLength = 120) => ({ type: "string", description, maxLength });

export const RESUME_MATCH_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overall", "directMatches", "transferableMatches", "gaps"],
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
          ...shortString("一句话说明决定匹配等级的主要原因", 80)
        }
      }
    },
    directMatches: {
      type: "array",
      description: "直接匹配，最多 3 条",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requirement", "experience", "proof"],
        properties: {
          requirement: shortString("岗位要求"),
          experience: shortString("简历中的相关经历"),
          proof: shortString("简历中的事实证据")
        }
      }
    },
    transferableMatches: {
      type: "array",
      description: "可迁移能力，最多 3 条",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requirement", "experience", "ability", "boundary"],
        properties: {
          requirement: shortString("岗位要求"),
          experience: shortString("相关经历"),
          ability: shortString("可迁移能力"),
          boundary: shortString("不能扩大描述的边界")
        }
      }
    },
    gaps: {
      type: "array",
      description: "关键缺口，最多 3 条",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gap", "impact"],
        properties: {
          gap: shortString("缺口"),
          impact: shortString("对投递的影响")
        }
      }
    }
  }
};

export function resumeMatchMessages({ job, resumeProfile, jobSummary, resumeMode }) {
  // Prompt 保持整段文本，方便产品侧直接编辑；调用层会转换为 Responses API input。
  const prompt = `
你是一位资深 HR 招聘专家，请基于 JD、JD 分析结果和候选人简历判断岗位匹配。

输入：
公司：${job.company || "未识别"}
岗位：${job.title || "未识别"}
岗位基础信息：${JSON.stringify(job)}
Job Profile（Deep Analysis 结果，含少量 JD 证据）：${jobSummary ? JSON.stringify(jobSummary) : "未提供"}
简历输入类型：${resumeMode}
Resume Profile（从简历原文一次性抽取并缓存的事实档案）：${resumeProfile ? JSON.stringify(resumeProfile) : "未识别"}

任务：只判断整体匹配等级、直接匹配证据、可迁移能力和关键缺口。不要提供简历修改建议，不要重新总结 JD。

原则：
- 只保留明显影响本次投递的信息，按重要性排序
- 区分直接匹配、可迁移能力、真实缺口，一个观点只出现一次
- inferredRequirements 是推断，不得当作硬性门槛；未找到证据不等于候选人没有能力
- Resume Profile 中的 details / otherEvidence 是候选人事实证据；只能依据这些事实判断
- 允许迁移能力，不允许迁移经历；不得虚构或扩大职责、技能、成果和数据
- 缺口只写无法靠表达优化解决、且影响初筛或面试判断的内容
- 每类最多 3 条；reason 不超过 40 字；其他字段尽量不超过 60 字

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

