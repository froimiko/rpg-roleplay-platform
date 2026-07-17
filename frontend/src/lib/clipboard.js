/* clipboard.js — 复制到剪贴板的统一实现(navigator.clipboard 优先，execCommand('copy') 兜底)。
 * 提炼自 components/game/GameChatMessages.jsx 的 doCopy —— 全仓唯一带 execCommand 兜底的实现，
 * 另外 8 处调用点此前都是裸 navigator.clipboard.writeText（无隐私模式/旧浏览器兜底）。
 * 不含 toast —— 调用方各自保留自己的成功/失败提示文案与 i18n key，只把复制动作换成这个函数。
 */

/**
 * 复制文本到剪贴板。
 * @param {string} text
 * @returns {Promise<boolean>} 是否复制成功
 */
export async function copyText(text) {
  const txt = text == null ? '' : String(text);
  let ok = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(txt);
      ok = true;
    }
  } catch (e) {}
  if (!ok) {
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {}
  }
  return ok;
}
