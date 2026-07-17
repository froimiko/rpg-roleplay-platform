// download.js — Blob→createObjectURL→<a download>→click→revokeObjectURL 样板收口。
//
// 从 components/platform/UsagePage.jsx(byModel/recent 两处 CSV 导出)与
// components/admin/logs-section.jsx(系统日志导出)三处逐字节相同的「造 blob→
// 建 <a>→点击→立即 revoke」流程提炼,纯机械收口,行为零变化。
//
// 注:components/platform/CapPages.jsx 的下载另有 appendChild/removeChild +
// 延迟(1000ms)revoke + try/catch 兜底 toast,与此不等价,未收进来,保持独立实现。
export function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

export default downloadBlob;
