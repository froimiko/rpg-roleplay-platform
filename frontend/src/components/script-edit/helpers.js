/* Shared pure helper for the script-edit views
   (mechanically extracted from script-edit-canon.jsx; byte-identical body). */

export function snippet(s, len = 50) {
  if (!s) return '—';
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > len ? t.slice(0, len) + '…' : t;
}
