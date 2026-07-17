/* Extracted from pages/MobileCaps.jsx — mechanical split, byte-for-byte. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { Toggle } from '../Toggle.jsx';  // 权威单一实现(语义统一);settings/shared.jsx 同源 re-export

/* ──────────────────────────────────────────────────────────────────
   Shared micro-components
   ────────────────────────────────────────────────────────────────── */

/* 空态占位(pl-empty)—— 五个 caps section(Apis/Feedback/Mcp/Plugins/Skills)逐字节同构,
   仅 icon 名与 i18n key 不同(size 恒 22)。DOM 逐字复制,各处 icon/titleKey/descKey 由调用点传入。 */
function EmptyState({ icon, titleKey, descKey }) {
  const { t } = useTranslation();
  return (
    <div className="pl-empty">
      <div className="ic"><Icon name={icon} size={22} /></div>
      <h3>{t(titleKey)}</h3>
      <p>{t(descKey)}</p>
    </div>
  );
}

function StatusPill({ on, label }) {
  const color = on ? 'ok' : '';
  return (
    <span className={`pill ${color}`} style={{ fontSize: 11 }}>
      <span className={`dot ${color}`} /> {label}
    </span>
  );
}

/* Bottom Sheet(新增/编辑表单)收口到 mobile/Sheet.jsx 的 <Sheet>(语义统一 Batch 6b)。
   通用底抽屉超集:grip + scrim 点关 + title/hint + children body。调用点保留原 zIndex=70/
   maxHeight=88% 以保视觉 1:1。 */

/* Text input field wrapper */
// 语义统一 #36(保留):此 MField 的 desc 用内联 11px/line-height 1.5 的 <span>,与
// mobile/Field.jsx 的 .desc(11.5px/1.55)显示不同 → 强迁会改字号/行高,刻意保留本地实现。
function MField({ label, desc, children }) {
  return (
    <div className="pl-field">
      <label style={{ fontSize: 12.5, color: 'var(--text-quiet)', fontWeight: 500 }}>{label}</label>
      {desc && <span style={{ fontSize: 11, color: 'var(--muted-2)', lineHeight: 1.5 }}>{desc}</span>}
      {children}
    </div>
  );
}

export { Toggle, StatusPill, MField, EmptyState };
