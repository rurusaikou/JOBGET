# JOBGET

JOBGET 是一个面向求职者的浏览器侧边栏插件。用户在招聘网站浏览职位时，可以直接提取 JD、保存岗位，并结合自己的简历完成：**岗位理解 → 候选人理解 → 人岗匹配 → 简历修改 → 沟通开场白**。

一句话定位：**看到职位后，快速判断“值不值得投、为什么、下一步怎么改”。**

## 面向用户

适合同时浏览多个岗位、需要快速筛选机会，又不想反复复制 JD、简历和 Prompt 的求职者。

自动提取支持：BOSS 直聘、智联招聘、猎聘的职位详情页。官网、公众号、猎头消息等其他渠道的 JD，可通过“手动添加JD”粘贴保存。

推荐使用流程：

```text
提取 JD / 手动添加 JD ─→ Job Profile ─┐
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
- **失败隔离**：Revision 输出截断、JSON 无法解析或返回为空时自动重试一次；最终失败不会破坏 Match，Greeting 也不依赖 Revision 成功。

## 主要功能

- 提取或手动添加职位信息，支持搜索、收藏、清空和 Excel 导出。
- 手动添加只需填写 JD 正文（最多 1000 字符），职位名称、公司 / 地点、岗位信息、薪资选填。
- JD Deep Analysis：岗位本质、核心要求、隐形要求、理想候选人；分析等待期间轮播当前分析主题，降低长推理的等待感，不展示虚假百分比或伪进度。
- PDF / DOCX 本地文本提取。
- AI Resume Understanding：把简历一次性整理成可复用 Resume Profile，重点保留工作与项目证据。
- Job Profile × Resume Profile 匹配：匹配等级与判断依据、直接证据、可迁移能力、关键缺口，不展示无计算依据的百分比或评分条；理解岗位、理解简历及匹配分析期间保留动态加载进度条。
- 匹配结果生成前，状态提示使用卡片完整可用宽度，避免为隐藏的匹配概览预留空白。
- 结合目标岗位名称、简历事实和匹配结论，独立生成对岗位匹配有实际影响的简历修改建议，并在页面显示“事实优化 / 策略强化 / 经历补充”类别标签。
- 修改建议按实际增益筛选和排序，不强求数量；没有建议时显示“暂无修改建议”，不填充固定建议；收起时显示标题、类别和修改理由，展开后查看原内容、修改依据及改写内容。
- 基于岗位本质、核心要求、直接匹配证据和可迁移能力生成可调沟通风格和内容长度的求职开场白。
- 沟通页底部状态栏仅在有复制反馈、生成错误或选项调整提示时显示，无文字时隐藏。
- 默认使用项目方托管 AI 服务，无需填写模型和密钥；仍支持自带 Key 的 OpenAI、DeepSeek 和兼容 Responses API 的服务。

## 目录结构

```text
JDGET/
├── manifest.json
├── src/
│   ├── app/                    # 应用状态、Controller、AI 工作流编排
│   ├── features/
│   │   ├── jobs/               # 提取、手动添加、去重、列表与导出
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
3. 打开 JOBGET 侧边栏；自动提取时需先进入支持的招聘网站职位详情页。
4. 当前为本地联调版，先按 [后端接入说明](docs/backend.md) 启动后端；插件默认使用 JOBGET 托管服务，无需填写模型或密钥。旧用户可在“API 设置”切换到托管服务；也可继续使用自带 Key。
5. 提取 JD 或点击“手动添加JD”粘贴正文并保存，再上传自己的 PDF / DOCX 简历（不提供示例简历入口）。手动保存后返回岗位池，可点击“查看详情”或“深度分析”；收集 JD 本身无需 API Key。
6. 简历上传成功后，JOBGET 会立即生成并缓存 Resume Profile，但**不会自动开始 Match**；简历理解完成后，在“匹配”页点击“开始分析”，系统只补齐仍缺失的 Job Profile / Resume Profile，再进入 Match。
7. Match 成功后继续查看 Revision 或生成 Greeting。
8. 开发调试时运行 `npm test`。

AI 调试：

```js
JOBGET_DEBUG_API.enable()
JOBGET_DEBUG_API.stats()
JOBGET_DEBUG_API.resetStats()
```

项目方 API Key 仅保存在后端；自带 Key 模式的密钥仅保存在浏览器 session storage。岗位、简历与分析结果保存在本地；托管推理时必要文本经后端临时转发至模型。后台只上报随机匿名安装标识和模块执行状态，后端另保留 Token、耗时等调用成本元数据，不保存业务正文。调试日志同样不输出正文。

## 待办

- [x] 降低首次使用门槛：默认托管 AI，已补齐插件接入、后端额度与本地验证；部署与成本评估见 [后端接入说明](docs/backend.md)，公网发布和真实模型体验验收另行进行。
- [ ] 落实本地隐私存储：用户简历、收藏 JD 及后续工作流结果统一保存在本地，服务端不持久化业务内容；模型调用仍涉及必要输入的临时转发。
- [x] 最小化使用统计：已接入匿名安装实例、各模块使用/成功/失败次数，支持执行去重、后台补发及汇总查询，不采集业务内容。

后端现有 `ai_calls` 保留模型、输入字符数、输入/推理/输出 Token、耗时、状态和时间，用于费用核对；`events` 记录匿名模块执行，附加聚合表支持累计与每日统计。Worker、D1、密钥托管和插件转发均已接通本地代码；尚未部署公网。完整范围和验收口径详见 [项目待办](docs/todo.md)。

## 版本迭代

### v2.5.0

- 保存非 JD 内容后，深度分析识别并说明原因，禁用匹配、修改建议和沟通入口，任务层同步拦截下游请求。
- 上传简历提取文本超过 4000 字时显示超限提示，不进入简历理解或后续分析；恰好 4000 字可继续，不截断原文。
- 非简历文档的拒绝结果按内容版本保存，匹配页显示“无法匹配”；重新打开仍拦截，更换文档后重新判定，网络等临时失败可重试。
- JD 分析 Prompt 升级至 v5，增加输入判定字段，旧分析需重新生成；修复隐形要求子对象的严格 Schema 字段不一致问题。
- Deep Analysis 增加分析主题轮播等待态，降低长推理的感知等待时间；不展示虚假进度或完成比例；等待态采用上下两层布局，主状态与动态分析主题分行展示。


### v2.0.0

- 完成代码、文档与版本号的一致性校验，并将正式版本升级为 v2.0.0。
- Greeting 的“精简 / 标准 / 详细”统一定义为内容密度档位：分别最多使用 1 / 2 / 3 个核心匹配证据；模型返回内容完整展示，前端不做字符截断、字数计数或 `maxlength` 限制。
- Greeting 生成结果继续支持直接编辑、复制编辑后内容，并在重新生成前保护用户手动修改。
- 延续 Deep Analysis / Resume Profile / Match / Revision 的当前推理、缓存、Compact Retry 与事实边界策略。

### v1.5.6

- 清理面向用户的内部实现术语：匹配、修改建议、沟通页统一改为用户价值说明；简历理解与匹配加载态不再展示 Job Profile / Resume Profile / 缓存等实现细节。
- 对齐 Greeting 文档与实际实现：UI 仅展示“精简 / 标准 / 详细”，三档用于控制内容密度与 Top Evidence 数量，不展示或强制字符数。
- 完成代码、文档与版本号一致性检查。

### v1.5.5

- 求职开场白长度选项为“精简 / 标准 / 详细”，用于控制内容密度；模型返回内容完整展示，前端不做字符截断。
- Greeting 仅消费按长度档位筛选的 Top Match Evidence（1 / 2 / 3 条），避免生成简历摘要并减少输入 token。
- 求职开场白生成结果支持直接编辑；模型返回内容完整展示，复制使用编辑后的文本，重新生成前会保护未保存的手动修改。

- 优化prompt
- Deep Analysis 首次推理从 medium 调整为 low，并加入字段级表达预算，减少长文本与 reasoning-only 截断
- Deep Analysis 截断时使用 Compact Retry：压缩 JD、关闭额外 reasoning、优先完成完整 JSON
- 优化生成时间

### v1.4.1

- JD 隐形要求拆分为要求与依据，展示、缓存、导出和匹配同步保留两者，兼容旧记录。

- 细化 JD 分析 Prompt，区分硬性门槛、核心能力与加分项，要求推断附依据；首次分析输出预算按当前版本调整为 4000 tokens，并由 Compact Retry 兜底。

- 新增手动添加 JD：四项基本信息选填、正文必填，最多 1000 字符；保存后返回岗位池，支持去重。
- 提取前检查网址，不支持的页面显示中文提示并引导手动添加；提取与添加按钮使用统一的蓝色线条图标。

- 对齐“提前理解、用户触发匹配”的产品流程：上传简历后立即生成并缓存 Resume Profile，但不自动启动 Match。
- 加强 Resume Profile 版本保护：不同 `contentVersion` 的旧 Profile 不允许被带入新简历版本。
- 增加上传流程与缓存失效的一致性测试，避免代码行为再次偏离文档。

### v1.4.0

- 新增 **AI Resume Understanding**，不再依赖章节标题正则来决定哪些经历能进入 Match。
- Resume 上传后生成结构化 **Resume Profile**，并按 `contentVersion` 缓存；同一份简历不会在每次 Match 时重复调用模型。
- Resume Profile 重点保留工作经历、项目/科研经历、职责、技术、量化成果和其他可核验事实，不保存姓名、手机号、邮箱。
- Match 改为严格消费 **Job Profile × Resume Profile**；正常路径不再回退 Raw JD / Raw Resume。
- Resume Match 默认关闭额外 reasoning，并限制各字段表达长度；若结构化结果未完整生成，只进行一次 Compact Retry（3500 → 4500 tokens），优先完成完整 JSON。
- 当 Job Profile 与 Resume Profile 都缺失时，Task Runner 并行准备两者，以减少串行等待时间。
- Resume Profile 使用 `reasoning=none`：只做事实抽取与归一化，减少不必要的推理延迟。

### v1.3.5

- Deep Analysis 成为 Match 的必需数据前置；用户直接点击“匹配”时系统自动补齐，Match 不再回退 Raw JD。

### v1.3.4

- Deep Analysis 增加一次性自动 Retry、技术错误分层和可靠性计数。

### v1.3.0

- 拆分大 Controller；Match / Revision 使用独立四态状态机。

### v1.2.0

- 项目重构为 `app / features / shared` 三层。
