export const qs = (selector) => document.querySelector(selector);
export const qsa = (selector) => Array.from(document.querySelectorAll(selector));

export function setStatus(text) {
  qs("#status").textContent = text;
}

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function copyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function flashButton(button, text) {
  const previous = button.textContent;
  button.textContent = text;
  setTimeout(() => {
    button.textContent = previous;
  }, 900);
}
