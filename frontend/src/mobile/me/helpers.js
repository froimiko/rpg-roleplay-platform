/* MobileMe 纯工具 / 常量 —— 从 pages/MobileMe.jsx 拆出,逐字节不变。 */

import i18n from '../../i18n';

/* ── 工具函数 ────────────────────────────────────────────────────── */
const fmtN = (n) => n == null ? '—' : Number(n).toLocaleString();
const fmtWan = (n) => {
  const v = Number(n) || 0;
  if (!v) return '—';
  return v >= 10000 ? (v / 10000).toFixed(1).replace(/\.0$/, '') + i18n.t('mobile.me.stats.wan_unit') : v.toLocaleString();
};
// 统一到 window.__fmt.date(data-loader.js;YYYY-MM-DD),保留本地兜底。
const fmtDate = (iso) => {
  if (window.__fmt && window.__fmt.date) return window.__fmt.date(iso);
  if (!iso) return '—';
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return '—'; }
};
const fmtAgo = (iso) => {
  if (!iso) return '—';
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60_000) return i18n.t('mobile.me.time.just_now');
    if (ms < 3_600_000) return i18n.t('mobile.me.time.minutes_ago', { n: Math.floor(ms / 60_000) });
    if (ms < 86_400_000) return i18n.t('mobile.me.time.hours_ago', { n: Math.floor(ms / 3_600_000) });
    return i18n.t('mobile.me.time.days_ago', { n: Math.floor(ms / 86_400_000) });
  } catch { return '—'; }
};

/* ── 成就分类顺序 ──────────────────────────────────────────────── */
const ACHV_CAT_ORDER = ['启程', '叙事', '探索', '收藏', '坚持', '隐藏'];
const TIER_RANK = { gold: 3, silver: 2, bronze: 1 };
const TIER_COLOR = { gold: '#d4a35c', silver: '#aab0be', bronze: '#b97a5a' };

export { fmtN, fmtWan, fmtDate, fmtAgo, ACHV_CAT_ORDER, TIER_RANK, TIER_COLOR };
