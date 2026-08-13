export const apiProviderPresets = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini"
  },
  azure: {
    baseUrl: "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
    model: "your-deployment"
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash"
  },
  zhipu: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4/",
    model: "glm-5.2"
  },
  minimax: {
    baseUrl: "https://api.minimaxi.com/v1",
    model: "MiniMax-M2.7"
  },
  qwen: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.7-plus"
  },
  compatible: {
    baseUrl: "https://api.your-provider.com/v1",
    model: "your-model"
  }
};
