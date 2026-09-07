// 输入限制按去除首尾空白后的 UTF-16 字符串长度计算，独立于输出 token 预算。
export const MODEL_INPUT_LIMITS = {
  jobDescriptionChars: 5000,
  resumeChars: 3000,
  // Resume Understanding 是一次性预处理，允许读取更完整的简历原文；结果按 contentVersion 缓存。
  resumeProfileChars: 16000,
  // 固定任务上下文的总字符预算，包含结构化字段开销；常规请求超限拒绝，不偷偷截断。
  contextChars: 12000,
  // Deep Analysis 发生输出截断时，Retry 会使用确定性压缩后的 JD；不额外调用模型做摘要。
  deepAnalysisRetryDescriptionChars: 3200
};

// 正常请求保持较紧预算；只有 Deep Analysis 检测到“输出未完整生成”时，
// 才允许一次更高预算的 Retry，避免把高预算变成所有请求的默认成本。
export const MODEL_TOKEN_LIMITS = {
  deepAnalysis: {
    outputTokens: 3000,
    retryOutputTokens: 6000
  },
  resumeProfile: {
    outputTokens: 5000
  },
  resumeMatch: {
    outputTokens: 3500,
    revisionOutputTokens: 3000
  },
  greeting: {
    outputTokens: {
      min: 2500,
      perRequestedChar: 12
    }
  },
  settingsTest: {
    outputTokens: 40
  }
};

// 不同任务需要的推理深度不同：
// - 深度分析需要从 JD 推断岗位本质、优先级和隐形要求，因此使用 medium；
// - Resume Profile 只做事实抽取与结构化，使用 low，避免过度推断；
// - Match 需要比较 Job Profile 与 Resume Profile 并判断可迁移能力，因此使用 low；
// - Revision / Greeting 主要消费已有结论做受约束生成，因此关闭额外推理。
// Provider 不支持 reasoning 参数时，由 API 适配层自动去参重试。
export const MODEL_REASONING_EFFORT = {
  deepAnalysis: "medium",
  resumeProfile: "low",
  resumeMatch: "low",
  resumeRevision: "none",
  greeting: "none"
};

export function greetingOutputTokens(maxChars) {
  const config = MODEL_TOKEN_LIMITS.greeting.outputTokens;
  const requestedChars = Number(maxChars);
  const dynamicTokens = Number.isFinite(requestedChars) ? requestedChars * config.perRequestedChar : 0;
  return Math.max(config.min, dynamicTokens);
}
