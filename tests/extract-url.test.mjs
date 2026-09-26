import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFromCurrentTab, isSupportedExtractionUrl } from '../src/features/jobs/extract.js';

test('extraction only accepts HTTP(S) URLs on supported domains', () => {
  for (const url of ['https://www.zhipin.com/job_detail/123.html', 'https://jobs.zhaopin.com/123', 'http://liepin.com/job/123']) {
    assert.equal(isSupportedExtractionUrl(url), true, url);
  }
  for (const url of ['chrome://extensions', 'chrome://newtab', 'edge://extensions', 'about:blank', 'file:///tmp/jd.html', 'https://example.com', 'https://fakezhipin.com', 'https://zhipin.com.example.com', 'https://example.com/?url=zhipin.com', undefined, '']) {
    assert.equal(isSupportedExtractionUrl(url), false, String(url));
  }
});

test('unsupported tabs are rejected before messaging or script injection', async () => {
  const previousChrome = globalThis.chrome;
  const previousWindow = globalThis.window;
  let calls = 0;
  let tab = { id: 1, url: 'chrome://extensions' };
  globalThis.chrome = {
    runtime: {},
    tabs: { query: (_options, done) => done([tab]), sendMessage: () => { calls++; } },
    scripting: { executeScript: () => { calls++; } }
  };
  globalThis.window = { chrome: globalThis.chrome };
  try {
    await assert.rejects(extractFromCurrentTab(), /当前网址不支持提取 JD.*手动添加JD/);
    tab = { id: 1, url: 'https://www.zhipin.com', pendingUrl: 'chrome://extensions' };
    await assert.rejects(extractFromCurrentTab(), /当前网址不支持/);
    assert.equal(calls, 0);
  } finally {
    globalThis.chrome = previousChrome;
    globalThis.window = previousWindow;
  }
});
