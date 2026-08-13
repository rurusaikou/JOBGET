export const matches = [
  {
    title: "AI 产品经验",
    state: "表达不足",
    tone: "orange",
    body: "如果岗位强调 AI、LLM 或 Agent，简历需要补足产品目标、用户场景、评估指标和上线结果。"
  },
  {
    title: "数据分析能力",
    state: "已匹配",
    tone: "positive",
    body: "简历中已有量化结果时，可以继续补充指标定义、分析过程和产品决策依据。"
  },
  {
    title: "跨团队协作能力",
    state: "已匹配",
    tone: "positive",
    body: "招聘方通常会关注你如何协调研发、算法、设计和运营，并推进方案上线。"
  },
  {
    title: "商业化思维",
    state: "暂无证据",
    tone: "gray",
    body: "如果 JD 提到增长、转化、客户价值或收入，需要在简历中补充相关证据。"
  }
];

export const baseSuggestions = [
  {
    id: "建议 01",
    title: "补充项目目标",
    priority: "高优先级",
    body: "把功能动作写成业务目标、用户对象、指标变化和最终结果。"
  },
  {
    id: "建议 02",
    title: "补充数据闭环",
    priority: "中优先级",
    body: "说明如何发现问题、选择指标、推动迭代，以及数据变化如何影响产品决策。"
  },
  {
    id: "建议 03",
    title: "强化协作过程",
    priority: "中优先级",
    body: "写清楚你如何协调上下游，包括评审机制、优先级判断、上线和复盘。"
  }
];
