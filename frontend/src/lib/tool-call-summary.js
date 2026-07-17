// 工具调用折叠块的共享纯逻辑 —— 桌面(components/ToolCallBlock.jsx)与移动
// (mobile/tavern/blocks.jsx)两皮肤共用。以桌面版 ToolCallBlock 为蓝本逐字提出:
//   - fmtToolValue:args/result 值格式化(桌面 _fmtToolValue 逐字复制)
//   - computeToolSummary:折叠行摘要文案(结构两皮肤一致,仅 i18n key 因皮肤而异→作参数传入)
// 两侧 JSX 皮肤(DOM/className)仍留在各自文件里,互不影响。

// 值格式化(逐字复制自桌面版 _fmtToolValue)
export function fmtToolValue(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 2); } catch (_) { return String(v); }
}

// 折叠行摘要文案。keys = { fallback, one, many } 由各皮肤传入自己的 i18n key。
export function computeToolSummary(ops, t, keys) {
  const n = ops.length;
  const firstName = (ops[0] && ops[0].tool) || t(keys.fallback);
  return n === 1
    ? t(keys.one, { name: firstName })
    : t(keys.many, { count: n, name: firstName });
}
