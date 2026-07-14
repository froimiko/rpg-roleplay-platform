/* Admin 共享工具:fmtTime。纯机械从 pages/admin.jsx 搬出,零行为变化。 */

/* ── 通用工具 ─────────────────────────────────────────────────── */
// 统一到 window.__fmt.time(data-loader.js;zh-CN 24h 制),保留本地别名免改调用点。
export function fmtTime(iso) {
  if (window.__fmt && window.__fmt.time) return window.__fmt.time(iso);
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('zh-CN', { hour12: false }); } catch (_) { return iso; }
}
