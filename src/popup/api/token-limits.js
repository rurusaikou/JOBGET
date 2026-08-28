export const MODEL_INPUT_LIMITS = {
  jobDescriptionChars: 5000,
  resumeChars: 3000
};

export const MODEL_TOKEN_LIMITS = {
  deepAnalysis: {
    outputTokens: 5000
  },
  resumeMatch: {
    outputTokens: 20000
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

export function greetingOutputTokens(maxChars) {
  const config = MODEL_TOKEN_LIMITS.greeting.outputTokens;
  const requestedChars = Number(maxChars);
  const dynamicTokens = Number.isFinite(requestedChars) ? requestedChars * config.perRequestedChar : 0;
  return Math.max(config.min, dynamicTokens);
}
