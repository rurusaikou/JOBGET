/** 使用帮助首页与详情页交互；详情内容仅解释现有功能，不触发业务动作。 */
import { qs, qsa } from "../../shared/ui/dom.js";
import { setView } from "./navigation-controller.js";

const HELP_TOPICS = {
  extract: { title: "提取当前岗位", summary: "从支持的招聘网站保存当前岗位。", what: "自动读取当前职位详情页中的岗位信息，并加入本地岗位池。", steps: ["打开 BOSS 直聘、智联招聘或猎聘的职位详情页。", "打开 RoleMI，点击“提取当前岗位”。", "确认岗位出现在岗位池后再进行分析。"] },
  manual: { title: "手动添加岗位", summary: "保存其他渠道获得的岗位描述。", what: "当网页无法自动提取时，可手动粘贴职位描述并补充岗位信息。", steps: ["在岗位池点击“手动添加岗位”。", "粘贴岗位描述，并按需填写职位、公司和薪资。", "保存后从岗位池打开该岗位。"] },
  analysis: { title: "岗位分析", summary: "理解岗位真正需要什么样的人。", what: "基于岗位描述整理岗位本质、核心要求、隐含要求和理想候选人。", steps: ["从岗位池打开目标岗位。", "进入“深度分析”并开始分析。", "等待完成后查看各项岗位结论。"] },
  match: { title: "简历匹配", summary: "判断已有经历与岗位要求的关系。", what: "结合岗位分析与简历，区分直接匹配、可迁移能力和关键缺口。", steps: ["先完成岗位分析。", "进入“匹配”并上传 PDF 或 DOCX 简历。", "点击开始分析并查看匹配结论。"] },
  revision: { title: "修改建议", summary: "围绕目标岗位优化简历表达。", what: "在不虚构经历的前提下，给出针对当前岗位的简历表达建议。", steps: ["先完成简历匹配。", "进入“修改建议”。", "逐条核对建议，并只采用符合真实经历的内容。"] },
  greeting: { title: "沟通草稿", summary: "生成可继续编辑的首次沟通内容。", what: "结合岗位重点和个人匹配证据，生成不同内容密度的沟通草稿。", steps: ["完成岗位分析和简历匹配。", "进入“沟通”，选择内容密度。", "生成后编辑、核对并复制使用。"] },
  favorite: { title: "收藏", summary: "集中管理值得继续跟进的岗位。", what: "为重点岗位添加收藏标记，并在收藏页统一查看。", steps: ["在岗位卡片或详情页点击收藏图标。", "切换到“收藏”查看已标记岗位。", "再次点击收藏图标可取消收藏。"] },
  export: { title: "Excel 导出", summary: "导出岗位池用于整理和备份。", what: "把本地岗位池中的岗位信息与已有分析结果整理成 Excel 文件。", steps: ["回到岗位池。", "点击导出按钮。", "在下载目录中打开生成的 Excel 文件。"] }
};

export function bindHelpEvents() {
  qsa(".help-link").forEach((button) => button.addEventListener("click", () => openHelpDetail(button.dataset.helpTopic)));
  qs("#helpDetailBackBtn").addEventListener("click", () => setView("help"));
}

function openHelpDetail(topicKey) {
  const topic = HELP_TOPICS[topicKey];
  if (!topic) return;
  qs("#helpDetailTitle").textContent = topic.title;
  qs("#helpDetailSummary").textContent = topic.summary;
  qs("#helpDetailWhat").textContent = topic.what;
  qs("#helpDetailSteps").replaceChildren(...topic.steps.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  setView("helpDetail");
}
