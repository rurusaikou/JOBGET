import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from './helpers.mjs';
import { getSettings, saveSettings, testApiKey } from '../src/features/settings/service.js';
import { validateModelSettings } from '../src/shared/ai/client.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; delete globalThis.document; });
function form(baseUrl = '', model = '', apiKey = '') {
  const fields = Object.fromEntries(Object.entries({ baseUrl, modelName: model, apiKey }).map(([id, value]) => [`#${id}`, { value }]));
  fields['#apiStatus'] = { classList: { add() {} } };
  fields['#testApiBtn'] = {};
  globalThis.document = { querySelector: id => fields[id] };
  return fields;
}
test('保存自定义配置，清空恢复托管；Key 不长期落盘', async () => {
  const storage = installStorage();
  form('https://example.test/v1', 'my-model', 'user-test-api-key');
  await saveSettings();
  assert.equal((await getSettings()).provider, 'custom');
  assert.equal(storage.read('rolemi.settings').apiKey, undefined);
  sessionStorage.setItem('rolemi.apiKey.session', '""');
  assert.throws(() => validateModelSettings({ provider: 'custom', baseUrl: 'https://example.test/v1', model: 'my-model', apiKey: '' }), /API Key/);
  assert.equal((await getSettings()).provider, 'custom');
  form();
  await saveSettings();
  assert.equal((await getSettings()).provider, 'hosted');
});
test('部分填写和 Chat Completions 地址均不覆盖已有配置', async () => {
  const storage = installStorage();
  form('https://example.test/v1', '', 'user-test-api-key');
  await assert.rejects(saveSettings(), /模型名称/);
  form('https://example.test/v1/chat/completions', 'model', 'user-test-api-key');
  await assert.rejects(saveSettings(), /仅支持 Responses API/);
  assert.equal(storage.read('rolemi.settings'), null);
});
test('测试自定义 API 直连 responses，验证响应且不保存配置', async () => {
  const storage = installStorage();
  const fields = form('https://example.test/v1', 'my-model', 'user-test-api-key');
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://example.test/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer user-test-api-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'my-model');
    assert.ok(body.input);
    assert.equal(body.messages, undefined);
    return { ok: true, json: async () => ({ status: 'completed', output_text: '{"ok":true}' }) };
  };
  await testApiKey();
  assert.equal(calls, 1);
  assert.match(fields['#apiStatus'].textContent, /通过/);
  assert.equal(storage.read('rolemi.settings'), null);
  globalThis.fetch = async () => { throw new Error('offline'); };
  await testApiKey();
  assert.match(fields['#apiStatus'].textContent, /网络请求失败/);
  assert.equal(fields['#testApiBtn'].disabled, false);
});
