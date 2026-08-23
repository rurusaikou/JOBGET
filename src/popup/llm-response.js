export function extractResponseContent(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.output_text === "string") return payload.output_text.trim();

  const choice = payload.choices && payload.choices[0] ? payload.choices[0] : null;
  const message = choice && choice.message ? choice.message : null;
  const candidates = [
    message && message.content,
    message && message.reasoning_content,
    choice && choice.text
  ];

  for (const candidate of candidates) {
    const text = contentToText(candidate);
    if (text) return text;
  }

  if (Array.isArray(payload.output)) {
    return payload.output.map((item) => contentToText(item && item.content)).filter(Boolean).join("\n").trim();
  }

  return "";
}

function contentToText(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      return contentToText(item.text || item.output_text || item.content);
    }).filter(Boolean).join("\n").trim();
  }
  if (content && typeof content === "object") {
    return contentToText(content.text || content.output_text || content.content);
  }
  return "";
}
