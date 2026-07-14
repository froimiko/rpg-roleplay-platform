/* new-game/shared.jsx — MobileNewGame 向导的共用小件(StepDots / ErrBar / Loading / FieldLabel)。
   从 pages/MobileNewGame.jsx 纯机械搬出(区块逐字节等价,DOM/视觉/行为零变化)。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';

/* ================================================================
   Step 进度条
   ================================================================ */
function StepDots({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flex: 1 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          height: 3, flex: 1, borderRadius: 99,
          background: i < step ? 'var(--accent)' : i === step ? 'rgba(201,100,66,.5)' : 'var(--line)',
          transition: 'background .2s',
        }} />
      ))}
      <span style={{ fontSize: 10, color: 'var(--muted-2)', whiteSpace: 'nowrap', marginLeft: 4, fontFamily: 'var(--font-mono)' }}>
        {step + 1}/{total}
      </span>
    </div>
  );
}

/* ================================================================
   错误条
   ================================================================ */
function ErrBar({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      color: 'var(--danger)', padding: '9px 12px',
      border: '1px solid rgba(200,103,93,.3)', borderRadius: 10,
      fontSize: 12.5, background: 'var(--danger-soft)', lineHeight: 1.5,
    }}>
      {msg}
    </div>
  );
}

/* ================================================================
   加载占位
   ================================================================ */
function Loading({ text }) {
  const { t } = useTranslation();
  return (
    <div className="pl-empty" style={{ padding: '28px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
        <Icon name="spinner" size={14} className="spin" /> {text || t('common.loading')}
      </div>
    </div>
  );
}

/* ================================================================
   FieldLabel
   ================================================================ */
// 语义统一 #36(保留):FieldLabel 只渲染「标签 + hint」块、不含控件 children,与
// mobile/Field.jsx 的 Field(label+desc+控件)不同形,且为纯内联样式 → 不收口,保留本地实现。
function FieldLabel({ children, hint }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-quiet)' }}>{children}</div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 2, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

export { StepDots, ErrBar, Loading, FieldLabel };
