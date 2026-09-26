import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

test("统一菜单提供设置、帮助和反馈入口", async () => {
  const [html, navigation] = await Promise.all([
    readFile(new URL("src/popup.html", root), "utf8"),
    readFile(new URL("src/app/controllers/navigation-controller.js", root), "utf8")
  ]);
  for (const id of ["moreMenuBtn", "headerMenu", "settingsBtn", "helpBtn", "feedbackBtn", "helpView", "feedbackView"]) {
    assert.ok(html.includes(`id="${id}"`), `缺少 ${id}`);
  }
  assert.match(navigation, /openUtilityView\("help"\)/);
  assert.match(navigation, /openUtilityView\("feedback"\)/);
  assert.match(navigation, /state\.navigation\.view === view/);
  assert.match(navigation, /utilityReturnView = state\.navigation\.view/);
  assert.match(html, /id="helpBtn"[\s\S]*?class="menu-icon"/);
});

test("使用帮助按四组进入功能详情", async () => {
  const [html, controller] = await Promise.all([
    readFile(new URL("src/popup.html", root), "utf8"),
    readFile(new URL("src/app/controllers/help-controller.js", root), "utf8")
  ]);
  for (const title of ["开始使用", "分析岗位", "准备投递", "管理岗位", "提取当前 JD", "手动添加 JD", "岗位分析", "简历匹配", "修改建议", "沟通草稿", "收藏", "Excel 导出"]) {
    assert.ok(html.includes(title));
  }
  assert.ok(html.includes('id="helpDetailView"'));
  assert.equal((html.match(/class="help-link"/g) || []).length, 8);
  assert.match(controller, /setView\("helpDetail"\)/);
  assert.ok(!html.includes('class="help-steps"'));
});

test("反馈可提交关联岗位工作流快照", async () => {
  const [html, controller, css] = await Promise.all([
    readFile(new URL("src/popup.html", root), "utf8"),
    readFile(new URL("src/app/controllers/feedback-controller.js", root), "utf8"),
    readFile(new URL("src/popup.css", root), "utf8")
  ]);
  assert.match(html, /id="feedbackContent"[^>]*maxlength="500"/);
  assert.match(html, /id="feedbackJob"[^>]*name="jobId"/);
  assert.match(html, /不关联岗位/);
  assert.match(html, /value="analysis_inaccurate"/);
  assert.ok(!html.includes("feedbackFile"));
  assert.ok(!html.includes("feedbackIncludeContext"));
  assert.ok(!html.includes("feedbackCancelBtn"));
  assert.match(controller, /backendUrl\("\/api\/feedback"\)/);
  assert.match(controller, /jd_content/);
  assert.match(controller, /deep_analysis_result/);
  assert.match(controller, /match_result/);
  assert.match(controller, /revision_result/);
  assert.match(controller, /greeting_result/);
  assert.match(controller, /state\.jobs\.map/);
  assert.match(controller, /感谢反馈，我们已收到。/);
  assert.match(controller, /job\?\.description/);
  assert.ok(!controller.includes("resumeState"));
  assert.match(controller, /job\?\.deepAnalysis/);
  assert.match(css, /\.feedback-types\s*\{[\s\S]*?grid-template-columns: repeat\(2/);
  assert.match(css, /\.feedback-content textarea\s*\{[\s\S]*?min-height: 96px/);
  assert.match(css, /\.feedback-submit\s*\{[\s\S]*?width: 100%/);
});

test("岗位分析状态卡在不同宽度保持指定对齐", async () => {
  const css = await readFile(new URL("src/popup.css", root), "utf8");
  assert.match(css, /#analysisStatusCard\s*\{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(css, /\.analysis-state \.soft-btn\s*\{[\s\S]*?justify-self: end/);
  assert.match(css, /#analysisStatusCard\.loading > div\s*\{[\s\S]*?align-self: stretch;[\s\S]*?width: 100%/);
  assert.match(css, /#analysisStatusCard\.loading h2\s*\{[\s\S]*?justify-content: flex-start/);
  assert.match(css, /#analysisStatusCard > div\s*\{[\s\S]*?text-align: left/);
  assert.match(css, /#analysisStatusCard h2\s*\{[\s\S]*?text-align: left/);
  assert.match(css, /#analysisStatusCard p\s*\{[\s\S]*?text-align: left/);
});
