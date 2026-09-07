import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/app/controllers/resume-controller.js', import.meta.url);

test('简历上传后前置生成 Resume Profile，但不会自动启动完整 Match', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const uploadBlock = source.match(/resumeFile"\)\.addEventListener\("change"[\s\S]*?\n  \}\);/)?.[0] || '';
  const exampleBlock = source.match(/exampleResumeBtn"\)\.addEventListener\("click"[\s\S]*?\n  \}\);/)?.[0] || '';

  assert.match(uploadBlock, /runResumeUnderstanding\(/);
  assert.doesNotMatch(uploadBlock, /startResumeMatchAnalysis\(/);
  assert.match(exampleBlock, /runResumeUnderstanding\(/);
  assert.doesNotMatch(exampleBlock, /startResumeMatchAnalysis\(/);
});
