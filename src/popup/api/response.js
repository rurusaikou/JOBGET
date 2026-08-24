export function extractResponseContent(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  if (Array.isArray(payload.output)) {
    return payload.output.map(outputItemToText).filter(Boolean).join("\n").trim();
  }

  return "";
}

function outputItemToText(item) {
  // Responses API 会同时返回 reasoning 和最终 message；页面只应该消费最终答案。
  if (!item || item.type !== "message") return "";
  return contentToText(item.content);
}

function contentToText(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      if (item.type && item.type !== "output_text") return "";
      return contentToText(item.text || item.output_text || item.content);
    }).filter(Boolean).join("\n").trim();
  }
  if (content && typeof content === "object") {
    return contentToText(content.text || content.output_text);
  }
  return "";
}
