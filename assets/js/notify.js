/**
 * ErisPulse Builder — 精简版通用 UI / 工具函数
 *
 * 从原 erispulse.github.io/assets/js/core/notify.js 移植而来。
 * 仅保留 builder 用到的：showMessage、escapeHtml。
 * 裁掉了 showActionToast、timeAgo（builder 未使用）。
 */

/**
 * 显示一条短暂的浮动提示消息
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 */
export function showMessage(message, type) {
  const existingMessage = document.querySelector(".message");
  if (existingMessage) {
    existingMessage.remove();
  }

  const messageEl = document.createElement("div");
  messageEl.className = `message message-${type}`;
  messageEl.textContent = message;

  Object.assign(messageEl.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    padding: "12px 20px",
    borderRadius: "var(--radius)",
    color: "white",
    fontWeight: "500",
    zIndex: "1000",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    transform: "translateY(20px)",
    opacity: "0",
    transition: "all 0.3s ease",
    background:
      type === "success"
        ? "var(--primary)"
        : type === "error"
          ? "#ef4444"
          : type === "warning"
            ? "#f59e0b"
            : "#64748b",
  });

  document.body.appendChild(messageEl);

  setTimeout(() => {
    messageEl.style.transform = "translateY(0)";
    messageEl.style.opacity = "1";
  }, 10);

  setTimeout(() => {
    messageEl.style.transform = "translateY(20px)";
    messageEl.style.opacity = "0";
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  }, 3000);
}

/**
 * HTML 转义
 */
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[c];
  });
}
