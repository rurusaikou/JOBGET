# JOBGET

JOBGET 是一个面向求职者的浏览器侧边栏插件。用户在招聘网站浏览职位时，可以直接提取 JD、保存岗位，并结合自己的简历完成：**岗位理解 → 候选人理解 → 人岗匹配 → 简历修改 → 沟通开场白**。

一句话定位：**看到职位后，快速判断“值不值得投、为什么、下一步怎么改”。**

## 面向用户

适合同时浏览多个岗位、需要快速筛选机会，又不想反复复制 JD、简历和 Prompt 的求职者。

当前支持：BOSS 直聘、智联招聘、猎聘。

推荐使用流程：

```text
招聘网站职位 ─→ 提取 JD ─→ Job Profile ─┐
                                       ├─→ Match ─→ Revision / Greeting
上传 PDF / DOCX ─→ Resume Profile ─────┘
```

这里有两个重要的自动前置：

- **Job Profile** 由 Deep Analysis 生成。用户直接点击“匹配”时，如果还没有有效 Job Profile，JOBGET 会自动先完成 Deep Analysis。
- **Resume Profile** 在简历上传后生成并按简历版本缓存。同一份简历用于多个岗位时，不会每次 Match 都重新理解一遍。

因此 Match 的职责很单一：**比较已经理解好的 Job Profile 与 Resume Profile**，而不是重新阅读两份长原文。

## 产品亮点

- **嵌入求职现场**：不离开招聘页面即可完成收集、分析和匹配。
- **理解结果可复用**：岗位理解按 JD 版本复用，简历理解按 Resume 版本复用。
- **项目经历不靠标题正则猜**：本地 Parser 负责读文件，AI Resume Understanding 负责识别工作、科研、平台建设等语义结构。
- **证据优先**：Resume Profile 保留项目职责、成果、技术和量化事实；Match 不允许把可迁移能力写成真实经历。
- **减少重复输入**：正常 Match 不重新发送 Raw JD / Raw Resume。
- **失败隔离**：Revision 失败不会破坏 Match；Greeting 也不依赖 Revision 成功。

## 主要功能

- 提取并保存职位信息，支持搜索、收藏、清空和 Excel 导出。
- JD Deep Analysis：岗位本质、核心要求、隐形要求、理想候选人。
- PDF / DOCX 本地文本提取。
- AI Resume Understanding：把简历一次性整理成可复用 Resume Profile，重点保留工作与项目证据。
- Job Profile × Resume Profile 匹配：整体匹配、直接证据、可迁移能力、关键缺口。
- 独立生成最多 3 个简历修改建议。
- 基于最多 3 个匹配亮点生成可调语气和长度的求职开场白。
- 支持 OpenAI、DeepSeek 预设，以及兼容 Responses API 的自定义模型服务。

## 目录结构

```text
JDGET/
├── manifest.json
├── src/
│   ├── app/                    # 应用状态、Controller、AI 工作流编排
│   ├── features/
│   │   ├── jd-analysis/        # Job Understanding
│   │   ├── resume/             # 文件读取 + Resume Understanding + 缓存
│   │   ├── resume-match/
│   │   ├── resume-revision/
│   │   └── greeting/
│   ├── shared/                 # AI、Context、Storage、UI 等公共基础设施
│   ├── background.js
│   ├── content.js
│   └── popup.js                # 极薄入口
├── docs/
└── tests/
```

第一次看项目建议：`docs/README.md → product.md → architecture.md → ai-pipeline.md → code-guide.md`。

## 如何使用

1. 在 Chrome / Edge 扩展管理页开启“开发者模式”。
2. 选择“加载已解压的扩展程序”，加载本项目目录。
3. 打开支持的招聘网站职位页面并打开 JOBGET 侧边栏。
4. 在“API 设置”中填写 Provider、Base URL、模型名和 API Key，并执行连接测试。
5. 提取 JD，上传 PDF / DOCX 简历。
6. 简历上传成功后，JOBGET 会立即生成并缓存 Resume Profile，但**不会自动开始 Match**；用户点击“匹配”时，系统只补齐仍缺失的 Job Profile / Resume Profile，再进入 Match。
7. Match 成功后继续查看 Revision 或生成 Greeting。
8. 开发调试时运行 `npm test`。

AI 调试：

```js
JOBGET_DEBUG_API.enable()
JOBGET_DEBUG_API.stats()
JOBGET_DEBUG_API.resetStats()
```

API Key 仅保存在浏览器 session storage；岗位、简历与派生 Profile 保存在浏览器本地 storage。

## 版本迭代

### v1.4.1

- 对齐“提前理解、用户触发匹配”的产品流程：上传简历后立即生成并缓存 Resume Profile，但不自动启动 Match。
- 加强 Resume Profile 版本保护：不同 `contentVersion` 的旧 Profile 不允许被带入新简历版本。
- 增加上传流程与缓存失效的一致性测试，避免代码行为再次偏离文档。

### v1.4.0

- 新增 **AI Resume Understanding**，不再依赖章节标题正则来决定哪些经历能进入 Match。
- Resume 上传后生成结构化 **Resume Profile**，并按 `contentVersion` 缓存；同一份简历不会在每次 Match 时重复调用模型。
- Resume Profile 重点保留工作经历、项目/科研经历、职责、技术、量化成果和其他可核验事实，不保存姓名、手机号、邮箱。
- Match 改为严格消费 **Job Profile × Resume Profile**；正常路径不再回退 Raw JD / Raw Resume。
- 当 Job Profile 与 Resume Profile 都缺失时，Task Runner 并行准备两者，以减少串行等待时间。
- Resume Profile 使用 `reasoning=low`：目标是事实抽取，不做过度推断。

### v1.3.5

- Deep Analysis 成为 Match 的必需数据前置；用户直接点击“匹配”时系统自动补齐，Match 不再回退 Raw JD。

### v1.3.4

- Deep Analysis 增加一次性自动 Retry、技术错误分层和可靠性计数。

### v1.3.0

- 拆分大 Controller；Match / Revision 使用独立四态状态机。

### v1.2.0

- 项目重构为 `app / features / shared` 三层。
