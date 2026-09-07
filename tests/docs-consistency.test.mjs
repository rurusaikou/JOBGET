import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CONTEXT_VERSION, PROMPT_VERSIONS, RESUME_PROFILE_VERSION, SUMMARY_VERSION } from "../src/shared/context/cache.js";
import { MODEL_INPUT_LIMITS, MODEL_REASONING_EFFORT, MODEL_TOKEN_LIMITS } from "../src/shared/ai/token-limits.js";

const root = new URL("../", import.meta.url);

test("文档与 v1.4 Resume Understanding / Match Pipeline 保持一致", async () => {
  const [manifestText, readme, featureSpec, aiPipeline, architecture, dataModel, codeGuide, troubleshooting] = await Promise.all([
    readFile(new URL("manifest.json", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL("docs/feature-spec.md", root), "utf8"),
    readFile(new URL("docs/ai-pipeline.md", root), "utf8"),
    readFile(new URL("docs/architecture.md", root), "utf8"),
    readFile(new URL("docs/data-model.md", root), "utf8"),
    readFile(new URL("docs/code-guide.md", root), "utf8"),
    readFile(new URL("docs/troubleshooting.md", root), "utf8")
  ]);
  const manifest = JSON.parse(manifestText);

  assert.ok(readme.includes(`### v${manifest.version}`));
  assert.ok(featureSpec.includes(`当前版本：v${manifest.version}`));
  assert.ok(featureSpec.includes(`CONTEXT_VERSION = ${CONTEXT_VERSION}`));
  assert.ok(featureSpec.includes(`SUMMARY_VERSION = ${SUMMARY_VERSION}`));
  assert.ok(featureSpec.includes(`RESUME_PROFILE_VERSION = ${RESUME_PROFILE_VERSION}`));
  assert.ok(featureSpec.includes(`JD 分析 ${PROMPT_VERSIONS.deep_analysis}`));
  assert.ok(featureSpec.includes(`Resume Profile ${PROMPT_VERSIONS.resume_profile}`));
  assert.ok(featureSpec.includes(`简历匹配 ${PROMPT_VERSIONS.resume_match}`));
  assert.ok(featureSpec.includes(`开场白 ${PROMPT_VERSIONS.greeting}`));

  assert.ok(featureSpec.includes(`contextChars: ${MODEL_INPUT_LIMITS.contextChars}`));
  assert.ok(featureSpec.includes(`resumeProfileChars: ${MODEL_INPUT_LIMITS.resumeProfileChars}`));
  assert.ok(featureSpec.includes(`deepAnalysisRetryDescriptionChars: ${MODEL_INPUT_LIMITS.deepAnalysisRetryDescriptionChars}`));
  assert.ok(featureSpec.includes(`Deep Analysis 第一次预算为 \`${MODEL_TOKEN_LIMITS.deepAnalysis.outputTokens}\``));
  assert.ok(featureSpec.includes(`Retry 预算为 \`${MODEL_TOKEN_LIMITS.deepAnalysis.retryOutputTokens}\``));
  assert.ok(featureSpec.includes(`Resume Profile = \`${MODEL_TOKEN_LIMITS.resumeProfile.outputTokens}\``));

  for (const [label, effort] of [
    ["JD 深度分析", MODEL_REASONING_EFFORT.deepAnalysis],
    ["Resume Profile", MODEL_REASONING_EFFORT.resumeProfile],
    ["Resume Match", MODEL_REASONING_EFFORT.resumeMatch],
    ["Resume Revision", MODEL_REASONING_EFFORT.resumeRevision],
    ["Greeting", MODEL_REASONING_EFFORT.greeting]
  ]) {
    assert.match(featureSpec, new RegExp(`${label}[^\\n]*\`${effort}\``));
  }

  const docs = [readme, featureSpec, aiPipeline, architecture, dataModel, codeGuide, troubleshooting].join("\n");
  assert.match(docs, /Resume Understanding/);
  assert.match(docs, /Resume Profile/);
  assert.match(featureSpec, /Match 不回退 JD 原文，也不回退 Resume 原文/);
  assert.match(aiPipeline, /Match 不回退 Raw JD，也不回退 Raw Resume/);
  assert.match(architecture, /两者都缺失.*并行|并行准备/);
  assert.match(readme, /不会自动开始 Match/);
  assert.match(aiPipeline, /不会自动启动 Match/);
  assert.match(dataModel, /resumeProfileId/);
  assert.match(featureSpec, /API Key 保存于 `chrome\.storage\.session`/);
  assert.match(featureSpec, /Resume Profile 不保存姓名、手机号、邮箱/);
  assert.match(aiPipeline, /Resume Profile 不保存姓名、手机号、邮箱/);
  assert.match(troubleshooting, /jobget\.resume\.profile\.projects/);

  // README 保持产品化，不暴露内部版本键细节。
  for (const implementationTerm of ["CONTEXT_VERSION", "RESUME_PROFILE_VERSION", "previous_response_id", "contextChars"]) {
    assert.ok(!readme.includes(implementationTerm));
  }
});
