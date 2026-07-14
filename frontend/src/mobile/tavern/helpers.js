/* MobileTavern 纯工具(相对时间 / 时间戳)—— 从 pages/MobileTavern.jsx 拆出,逐字节不变。 */



/* ─── 工具函数 ─────────────────────────────────────────────────────── */
// 桶算法委托 data-loader.js 规范 window.__fmt.ago(语义统一 #25);本端「空/坏值 → ''」语义保留。
function relTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const ago = (typeof window !== 'undefined' && window.__fmt && window.__fmt.ago);
  return ago ? ago(ts) : d.toLocaleDateString();
}

function tvNow() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export { relTime, tvNow };
