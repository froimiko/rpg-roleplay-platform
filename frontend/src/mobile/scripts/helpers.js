/* MobileScripts 纯工具 / 常量 —— 从 pages/MobileScripts.jsx 拆出,逐字节不变。 */

import i18n from '../../i18n';

/* ─── 小工具 ─────────────────────────────────────── */
const fmtWan = (w) => {
  const n = Number(w) || 0;
  return n >= 10000
    ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + i18n.t('mobile.scripts.unit.wan_chars')
    : n > 0 ? n + i18n.t('mobile.scripts.unit.chars') : '—';
};
const fmtN = (n) => (n == null ? '—' : Number(n).toLocaleString());

const ACTIVE_STATUSES = new Set(['queued', 'pending', 'running', 'processing', 'importing', 'started']);
const TERMINAL_STATUSES = new Set(['done', 'done_with_errors', 'partial', 'failed', 'cancelled']);
const getSplitRules = () => [
  { id: 'auto',       label: i18n.t('mobile.scripts.split_rule.auto') },
  { id: 'corpus',     label: i18n.t('mobile.scripts.split_rule.corpus') },
  { id: 'chapter_cn', label: i18n.t('mobile.scripts.split_rule.chapter_cn') },
  { id: 'chapter_en', label: i18n.t('mobile.scripts.split_rule.chapter_en') },
  { id: 'number_dot', label: i18n.t('mobile.scripts.split_rule.number_dot') },
  { id: 'paren_num',  label: i18n.t('mobile.scripts.split_rule.paren_num') },
  { id: 'custom',     label: i18n.t('mobile.scripts.split_rule.custom') },
];

function isPlayBlocked(s) {
  if (!s) return '';
  const status = String(
    s.import_status || s.job_status || s.active_job?.status || s.readiness?.active_job?.status || ''
  ).toLowerCase();
  if (status && ACTIVE_STATUSES.has(status) && !TERMINAL_STATUSES.has(status)) return i18n.t('mobile.scripts.play_block.importing');
  const missing = Array.isArray(s.readiness?.missing) ? s.readiness.missing : [];
  const BLOCKING = new Set(['chunks', 'anchors']);
  const blocked = missing.filter(k => BLOCKING.has(k));
  if (blocked.length) return i18n.t('mobile.scripts.play_block.missing_data', { items: blocked.join(', ') });
  if (Number(s.chapter_count || 0) <= 0) return i18n.t('mobile.scripts.play_block.no_chapters');
  return '';
}

export { fmtWan, fmtN, ACTIVE_STATUSES, TERMINAL_STATUSES, getSplitRules, isPlayBlocked };
