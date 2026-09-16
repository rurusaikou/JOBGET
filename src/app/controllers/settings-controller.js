/**
 * 模型 Provider 配置、连通性测试和设置保存。
 * Controller 只连接 DOM、State 与业务动作，不包含 Prompt / Provider 细节。
 */
import { applyProviderPreset, saveSettings, testApiKey } from "../../features/settings/service.js";
import { qs } from "../../shared/ui/dom.js";

export function bindSettingsEvents() {
  qs("#apiProvider").addEventListener("change", (event) => applyProviderPreset(event.target.value));
  qs("#testApiBtn").addEventListener("click", testApiKey);
  qs("#apiForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSettings();
    qs("#apiStatus").className = "api-status ok";
    qs("#apiStatus").textContent = "非敏感配置已保存，API Key 已保存到当前浏览器会话。";
  });
}
