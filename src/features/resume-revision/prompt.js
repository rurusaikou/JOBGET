const shortString = (description, maxLength = 120) => ({ type: "string", description, maxLength });

export const RESUME_REVISION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["revisions"],
  properties: {
    revisions: {
      type: "array",
      description: "简历修改建议，最多 3 条",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["summary", "original", "direction", "rewrite"],
        properties: {
          summary: shortString("修改目的", 80),
          original: shortString("简历原句", 180),
          direction: shortString("修改方向", 120),
          rewrite: shortString("基于原有事实的改写", 220)
        }
      }
    }
  }
};

export function resumeRevisionMessages({ job, resumeProfile, jobSummary, resumeMode }, matchResult) {
  const prompt = `
你是一位资深简历顾问。请根据已经完成的岗位匹配结论，给出最多 3 条最重要的简历修改建议。

公司：${job.company || "未识别"}
岗位：${job.title || "未识别"}
简历输入类型：${resumeMode}
Resume Profile：${resumeProfile ? JSON.stringify(resumeProfile) : "未识别"}
匹配结论：${JSON.stringify({
    level: matchResult.level,
    reason: matchResult.reason,
    directMatches: matchResult.directMatches,
    transferableMatches: matchResult.transferableMatches,
    gaps: matchResult.gaps
  })}

原则：
- 只处理最影响本次投递的内容，最多 3 条
- original 必须引用 Resume Profile 中 details / otherEvidence 的事实原句；没有原句时留空
- 只能调整表达角度、重点和顺序，不得虚构职责、技能、成果或数据
- rewrite 必须保留原事实，不超过 100 字
- 不重复输出匹配等级、匹配项或缺口
- 直接基于匹配结论选择需要改写的简历原句，不重新分析整个岗位

输出必须严格符合 schema，不要 Markdown、解释、推理过程、自我检查或 JSON 外文字。
`.trim();

  return [
    { role: "system", content: "你只输出符合既定 schema 的最终 JSON 对象。" },
    { role: "user", content: prompt }
  ];
}
