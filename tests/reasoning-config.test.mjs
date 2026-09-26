import test from "node:test";
import assert from "node:assert/strict";
import { MODEL_REASONING_EFFORT } from "../src/shared/ai/token-limits.js";

test("AI 任务按价值分层配置 reasoning effort", () => {
  assert.deepEqual(MODEL_REASONING_EFFORT, {
    deepAnalysis: "low",
    deepAnalysisRetry: "none",
    resumeProfile: "none",
    resumeMatch: "none",
    resumeMatchRetry: "none",
    resumeRevision: "none",
    resumeRevisionRetry: "none",
    greeting: "none"
  });
});
