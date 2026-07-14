/* MobileCards 纯工具/常量(clamp 行夹 / 字节格式化)—— 从 pages/MobileCards.jsx 拆出,逐字节不变。 */

/* ── helpers ─────────────────────────────────────────────────────── */
const clamp2 = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', wordBreak: 'break-word' };
const clamp3 = { ...clamp2, WebkitLineClamp: 3 };

// 语义统一 #40(needs-care,保留):falsy → '0 B'(非 window.__fmt.bytes 的 '—'),且无 GB 档,
// 改用统一版会改显示(空值文案 + ≥1GB 档),刻意不动。
function fmtBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

export { clamp2, clamp3, fmtBytes };
