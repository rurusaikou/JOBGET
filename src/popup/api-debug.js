const DEBUG_API_STORAGE_KEY = "jobget.debugApi";

installDebugApiControls();

export function logApiRequest(label, { url, body }) {
  if (!isApiDebugEnabled()) return;
  console.groupCollapsed(`[JOBGET API request] ${label}`);
  console.log("url", url);
  console.log("body", cloneForLog(body));
  console.groupEnd();
}

export function logApiResponse(label, payload) {
  if (!isApiDebugEnabled()) return;
  console.groupCollapsed(`[JOBGET API response] ${label}`);
  console.log(cloneForLog(payload));
  console.groupEnd();
}

export function logApiError(label, errorPayload) {
  if (!isApiDebugEnabled()) return;
  console.groupCollapsed(`[JOBGET API error] ${label}`);
  console.log(cloneForLog(errorPayload));
  console.groupEnd();
}

function installDebugApiControls() {
  if (!window || window.JOBGET_DEBUG_API) return;
  window.JOBGET_DEBUG_API = {
    enable() {
      window.localStorage.setItem(DEBUG_API_STORAGE_KEY, "true");
      console.info("[JOBGET API debug] enabled");
    },
    disable() {
      window.localStorage.removeItem(DEBUG_API_STORAGE_KEY);
      console.info("[JOBGET API debug] disabled");
    },
    status() {
      const enabled = isApiDebugEnabled();
      console.info(`[JOBGET API debug] ${enabled ? "enabled" : "disabled"}`);
      return enabled;
    }
  };
  console.info("[JOBGET API debug] run JOBGET_DEBUG_API.enable() to log API requests and responses.");
}

function isApiDebugEnabled() {
  try {
    return window.localStorage.getItem(DEBUG_API_STORAGE_KEY) === "true";
  } catch (_error) {
    return false;
  }
}

function cloneForLog(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return value;
  }
}
