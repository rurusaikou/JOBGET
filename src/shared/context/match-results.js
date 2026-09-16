// 旧缓存字段仅在读取边界兼容；业务与新 Prompt 统一使用新字段名。
export function normalizeTransferableMatch(item) {
  const { ability, ...rest } = item || {};
  return { ...rest, transferability: rest.transferability ?? ability ?? "" };
}

export function normalizeRevision(item) {
  const { direction, ...rest } = item || {};
  return { ...rest, category: rest.category || "", reason: rest.reason ?? direction ?? "" };
}
