import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("岗位池空状态展示三层价值说明并隐藏底部批量操作", async () => {
  const [html, css, controller] = await Promise.all([
    readFile(new URL("src/popup.html", root), "utf8"),
    readFile(new URL("src/popup.css", root), "utf8"),
    readFile(new URL("src/app/controllers/jobs-controller.js", root), "utf8")
  ]);
  const emptyPanel = html.match(/<article id="emptyPanel"[\s\S]*?<\/article>/)?.[0] || "";
  for (const value of ["看懂岗位", "看清差距", "知道怎么投"]) {
    assert.ok(emptyPanel.includes(value));
  }
  assert.match(html, /id="status">今天在看什么机会？ 👋<\/p>/);
  assert.match(emptyPanel, /判断值不值得投，并给出简历和沟通建议。/);
  assert.equal((emptyPanel.match(/class="empty-value-item"/g) || []).length, 3);
  assert.match(css, /\.empty-value-item\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(html, /id="extractBtn" class="primary"[\s\S]*?提取当前岗位/);
  assert.match(html, /id="manualAddBtn" class="soft-btn"[\s\S]*?手动添加岗位/);
  assert.match(html, /id="searchRow"[\s\S]*?id="jobSearch"[\s\S]*?id="count" class="count"/);
  const titleActions = html.match(/<div class="title-actions">[\s\S]*?<\/div>/)?.[0] || "";
  assert.ok(!titleActions.includes('id="count"'));
  assert.match(css, /\.search-row\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 38px/);
  assert.match(css, /\.empty-panel\s*\{[\s\S]*?padding: 14px 2px 12px/);
  assert.ok(!html.includes("JD"), "界面文案不应再混用 JD");
  for (const button of ["JD 结构化", "Excel 导出", "收藏归档", "沟通草稿"]) {
    assert.ok(!emptyPanel.includes(button));
  }
  assert.match(html, /id="bottomActions" class="bottom-actions is-hidden"/);
  assert.match(controller, /#bottomActions[\s\S]*?classList\.toggle\("is-hidden", state\.jobs\.length === 0\)/);
});
