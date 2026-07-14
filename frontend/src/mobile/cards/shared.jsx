/* MobileCards 共用子组件(SubHead / CardAv / Tag / ProseBlock / Field / ScopeSelect)
   —— 从 pages/MobileCards.jsx 拆出,逐字节不变。本地 Field(内置 input/textarea,desc 用 <div>)刻意窄于
   mobile/Field.jsx 的通用 Field,保留本地实现(语义统一 #36,防误合)。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import AvatarImg from '../../components/AvatarImg.jsx';

/* ── shared sub-components ──────────────────────────────────────── */

/** 顶部 back 头 */
function SubHead({ title, sub, onBack, actions }) {
  const { t } = useTranslation();
  return (
    <div className="pl-head">
      <button className="pl-back" onClick={onBack} aria-label={t('mobile.cards.back')}>
        <Icon name="chevron_left" size={20} />
      </button>
      <div className="pl-head-title">
        <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{title}</strong>
        {sub && <span className="sub">{sub}</span>}
      </div>
      {actions && <div className="pl-head-actions">{actions}</div>}
    </div>
  );
}

/** 角色 avatar — 有 src 则渲图片(AvatarImg 内部 onError 自动回退)，无 src 则首字母色块
 *  fill 模式:网格卡用全幅 92px banner(mc-card-av-wrap/img/letter CSS 控制尺寸),
 *  渲与原内联手写 img→onError→首字母完全等价的两元素结构(行为零变化),
 *  badge(off-dot/pinned/public)由调用方作为兄弟节点叠加。 */
function CardAv({ src, name, enabled, size = 72, radius = 20, colorClass = 'accent', zoomable = false, fill = false }) {
  const initial = (name || '?').trim().slice(0, 1);

  if (fill) {
    return (
      <>
        {src ? (
          <img
            src={src}
            alt={name}
            loading="lazy"
            className="mc-card-av-img"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling && (e.currentTarget.nextSibling.style.display = 'grid'); }}
          />
        ) : null}
        <div className="mc-card-av-letter" style={{ display: src ? 'none' : 'grid' }}>
          {(name || '').slice(0, 1)}
        </div>
      </>
    );
  }

  const shapeStyle = { width: size, height: size, borderRadius: radius, flexShrink: 0 };

  if (src) {
    return (
      <div style={{ ...shapeStyle, position: 'relative', overflow: 'hidden' }}>
        <AvatarImg
          src={src}
          name={name}
          size={size}
          shape="square"
          zoomable={zoomable}
          className="mc-card-av-img"
        />
        {enabled === false && (
          <span style={{ position: 'absolute', top: 7, right: 7, width: 9, height: 9, borderRadius: 999, background: 'var(--muted-3)', zIndex: 1 }} />
        )}
      </div>
    );
  }

  return (
    <div style={{
      ...shapeStyle,
      display: 'grid', placeItems: 'center', position: 'relative',
      font: `600 ${Math.round(size * 0.42)}px var(--font-serif)`,
      background: colorClass === 'accent'
        ? 'linear-gradient(140deg, rgba(201,100,66,0.26), rgba(201,100,66,0.05))'
        : colorClass === 'info'
          ? 'linear-gradient(140deg, rgba(122,166,194,0.24), rgba(122,166,194,0.05))'
          : 'linear-gradient(140deg, var(--panel-3), var(--panel-2))',
      color: colorClass === 'accent' ? 'var(--accent)' : colorClass === 'info' ? 'var(--info)' : 'var(--text)',
    }}>
      {initial}
      {enabled === false && (
        <span style={{ position: 'absolute', top: 7, right: 7, width: 9, height: 9, borderRadius: 999, background: 'var(--muted-3)' }} />
      )}
    </div>
  );
}

/** 标签 pill */
function Tag({ label, color }) {
  const map = {
    green: { color: 'var(--ok)', border: 'rgba(126,184,142,0.3)', bg: 'var(--ok-soft)' },
    accent: { color: 'var(--accent)', border: 'var(--accent-edge)', bg: 'var(--accent-soft)' },
    default: { color: 'var(--text-quiet)', border: 'var(--line-soft)', bg: 'var(--bg)' },
  };
  const s = map[color] || map.default;
  return (
    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 7, border: `1px solid ${s.border}`, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

/** 只读档案文字块 */
function ProseBlock({ label, value }) {
  if (!value) return null;
  return (
    <div className="pl-prose-block">
      <div className="lbl">{label}</div>
      <div className="tx serif" style={{ whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}

/** 表单字段(input / textarea) */
// 语义统一 #36(保留):此 Field 内置 input/textarea 控件(非通用 children 控件),且 desc 用
// <div className="desc">(mobile/Field.jsx 的 Field 用 <span className="desc">)→ 形态不同,保留本地实现。
function Field({ label, value, rows, placeholder, desc, onChange, type = 'text' }) {
  return (
    <div className="pl-field">
      <label>{label}</label>
      {desc && <div className="desc">{desc}</div>}
      {rows
        ? <textarea className="pl-input" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input className="pl-input" type={type} inputMode={type === 'number' ? 'numeric' : undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      }
    </div>
  );
}

/** Scope 选择器 */
function ScopeSelect({ value, onChange, isNpc = false }) {
  const { t } = useTranslation();
  const opts = isNpc
    ? [{ v: 'script', l: t('mobile.cards.scope.script') }, { v: 'private', l: t('mobile.cards.scope.private') }, { v: 'public', l: t('mobile.cards.scope.public') }]
    : [{ v: 'private', l: t('mobile.cards.scope.private') }, { v: 'public', l: t('mobile.cards.scope.public') }];
  return (
    <div className="pl-field">
      <label>{t('mobile.cards.scope.label')}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {opts.map((o) => (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            flex: 1, height: 40, borderRadius: 11, fontSize: 13.5,
            border: `1px solid ${value === o.v ? 'var(--accent-edge)' : 'var(--line-soft)'}`,
            background: value === o.v ? 'var(--accent-soft)' : 'var(--bg-deep)',
            color: value === o.v ? 'var(--accent)' : 'var(--muted)',
            fontWeight: value === o.v ? 600 : 400,
          }}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}

export { SubHead, CardAv, Tag, ProseBlock, Field, ScopeSelect };
