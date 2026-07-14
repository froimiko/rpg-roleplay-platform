/* scripts 页公共常量与纯工具(从 pages/scripts.jsx 拆出,零行为变化)。
   play-block 判定 / 导入状态集 / 分章规则表 —— 被 ScriptsList / ScriptsImport / ScriptDetail 共用。 */

const IMPORT_JOB_TERMINAL_STATUSES = new Set(["done", "done_with_errors", "partial", "failed", "cancelled"]);
const ACTIVE_IMPORT_STATUSES = new Set(["queued", "pending", "running", "processing", "importing", "started"]);
const PLAY_BLOCKING_READINESS_KEYS = new Set(["chunks", "anchors"]);

function readinessLabel(key, t) {
  return t(`scripts.my.readiness_label_${key}`, { defaultValue: key });
}

function activeJobPlayBlockReason(payload, t) {
  const job = payload?.job || payload?.active_job || payload;
  const status = String(job?.status || payload?.status || "").trim().toLowerCase();
  if (status && ACTIVE_IMPORT_STATUSES.has(status) && !IMPORT_JOB_TERMINAL_STATUSES.has(status)) {
    return t('scripts.my.play_block_importing');
  }
  if (payload?.active === true && (!status || !IMPORT_JOB_TERMINAL_STATUSES.has(status))) {
    return t('scripts.my.play_block_importing');
  }
  return "";
}

function scriptPlayBlockReason(script, t) {
  if (!script) return "";
  const status = String(
    script.import_status
    || script.job_status
    || script.active_job?.status
    || script.readiness?.active_job?.status
    || ""
  ).trim().toLowerCase();
  if (status && ACTIVE_IMPORT_STATUSES.has(status) && !IMPORT_JOB_TERMINAL_STATUSES.has(status)) {
    return t('scripts.my.play_block_importing');
  }
  const missing = Array.isArray(script.readiness?.missing) ? script.readiness.missing : [];
  const blocking = missing.filter((key) => PLAY_BLOCKING_READINESS_KEYS.has(key));
  if (blocking.length > 0) {
    return t('scripts.my.play_block_missing', { items: blocking.map((key) => readinessLabel(key, t)).join('、') });
  }
  if (Number(script.chapter_count || 0) <= 0) {
    return t('scripts.my.play_block_missing', { items: readinessLabel('chunks', t) });
  }
  return "";
}

const SPLIT_RULES = [
  { id: "auto",       labelKey: "scripts.import.rule_auto" },
  { id: "corpus",     labelKey: "scripts.import.rule_corpus" },
  { id: "chapter_cn", labelKey: "scripts.import.rule_chapter_cn" },
  { id: "chapter_en", labelKey: "scripts.import.rule_chapter_en" },
  { id: "number_dot", labelKey: "scripts.import.rule_number_dot" },
  { id: "paren_num",  labelKey: "scripts.import.rule_paren_num" },
  { id: "custom",     labelKey: "scripts.import.rule_custom" },
];

export { scriptPlayBlockReason, activeJobPlayBlockReason, SPLIT_RULES, IMPORT_JOB_TERMINAL_STATUSES };
