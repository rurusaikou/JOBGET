/**
 * 服务商预设表：提供托管与自定义连接的默认值，供配置兼容及请求适配使用。
 */
export const apiProviderPresets = {
  hosted: { baseUrl: "", model: "" },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini"
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash"
  },
  custom: {
    baseUrl: "https://api.your-provider.com/v1",
    model: "your-model"
  }
};
