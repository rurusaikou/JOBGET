/** API 设置保存和连接测试。 */
import { saveSettings, testApiKey } from "../../features/settings/service.js";
import { qs } from "../../shared/ui/dom.js";

export function bindSettingsEvents() {
  qs("#testApiBtn").addEventListener("click", testApiKey);
  qs("#apiForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = qs("#apiStatus");
    try {
      const settings = await saveSettings();
      status.className = "api-status ok";
      status.textContent = settings.provider === "hosted" ? "已恢复使用 JOBGET 服务。" : "已保存，将使用你的 Responses API。";
    } catch (error) {
      status.className = "api-status error";
      status.textContent = error.message || "保存失败，请重试。";
    }
  });
}
