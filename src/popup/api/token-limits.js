export const MODEL_TOKEN_LIMITS = {
  deepAnalysis: {
    inputChars: {
      jobDescription: 12000
    },
    outputTokens: 5000
  },
  resumeMatch: {
    inputChars: {
      jobDescription: 12000,
      jdAnalysis: 2500,
      resume: 16000
    },
    outputTokens: 20000
  },
  greeting: {
    inputChars: {
      jobDescription: 500,
      jdAnalysis: 500,
      resumeEvidence: 700,
      matchSummary: 900
    },
    outputTokens: {
      min: 2500,
      perRequestedChar: 12
    }
  },
  settingsTest: {
    outputTokens: 40
  }
};

export function compactText(text, maxLength) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

export function greetingOutputTokens(maxChars) {
  const config = MODEL_TOKEN_LIMITS.greeting.outputTokens;
  const requestedChars = Number(maxChars);
  const dynamicTokens = Number.isFinite(requestedChars) ? requestedChars * config.perRequestedChar : 0;
  return Math.max(config.min, dynamicTokens);
}
