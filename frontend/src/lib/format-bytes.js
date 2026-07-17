/* format-bytes.js — 导出体积估算的纯数值判定，收口自：
 *   components/saves/SavesList.jsx 的 _fmtBytes(桌面导出弹窗)
 *   mobile/saves/ExportSheet.jsx  的 fmtBytes(移动端导出弹窗)
 * 两处同算法(mb>=0.1 切换 MB/KB 档位、mb<10 时保留 1 位小数)。此处只做纯计算，不含 i18n/
 * 文案拼接 —— 调用方按返回的 tier 挑自己的 i18n key（saves.detail.export_size_mb/export_size_kb）。
 */

/**
 * @param {number} bytes
 * @returns {{ tier: 'mb'|'kb', n: number|string }}
 */
export function formatBytesTier(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 0.1) return { tier: 'mb', n: mb < 10 ? mb.toFixed(1) : Math.round(mb) };
  const kb = bytes / 1024;
  return { tier: 'kb', n: Math.round(kb) };
}
