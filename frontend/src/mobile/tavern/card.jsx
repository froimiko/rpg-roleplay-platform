/* MobileTavern 角色卡 / persona 字段与只读视图 —— 从 pages/MobileTavern.jsx 拆出,逐字节不变。 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

// 不复用电脑端 cards.jsx 的 UI 组件 —— 移动原生重写卡片读视图/persona 表单 + 纯数据 helper。
// 注:此处 cardFormInit/cardFormPayload 字段集刻意比 pages/cards.jsx 窄(酒馆 persona 用
// language_style/secret,无 full_name/importance/first_revealed_chapter/token_budget/
// priority/enabled/scope),与 _CARD_FIELDS/_CARD_MULTILINE/CardReadout/PersonaFields 强耦合,
// 字段集未对齐 → 不复用桌面版,保留本地实现(语义统一 #3 GUARD:不齐则保留并注释)。
function _cardFields() {
  return [
    ['name', i18n.t('mobile.tavern.card_field.name')],
    ['identity', i18n.t('mobile.tavern.card_field.identity')],
    ['background', i18n.t('mobile.tavern.card_field.background')],
    ['appearance', i18n.t('mobile.tavern.card_field.appearance')],
    ['personality', i18n.t('mobile.tavern.card_field.personality')],
    ['language_style', i18n.t('mobile.tavern.card_field.language_style')],
    ['current_status', i18n.t('mobile.tavern.card_field.current_status')],
    ['secret', i18n.t('mobile.tavern.card_field.secret')],
    ['sample_dialogue', i18n.t('mobile.tavern.card_field.sample_dialogue')],
  ];
}
const _CARD_MULTILINE = new Set(['background', 'appearance', 'personality', 'current_status', 'secret', 'sample_dialogue']);
function cardFormInit(c) {
  c = c || {};
  const o = {};
  for (const [k] of _cardFields()) o[k] = c[k] || (k === 'identity' ? (c.role || '') : '');
  o.tags = Array.isArray(c.tags) ? c.tags.join(', ') : (c.tags || '');
  o.aliases = Array.isArray(c.aliases) ? c.aliases.join(', ') : (c.aliases || '');
  return o;
}
function cardFormPayload(f, base) {
  const splitList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  const o = { ...(base || {}) };
  for (const [k] of _cardFields()) o[k] = f[k] || '';
  o.tags = splitList(f.tags); o.aliases = splitList(f.aliases);
  return o;
}
function CardReadout({ card }) {
  if (!card) return null;
  return (
    <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {_cardFields().map(([k, l]) => {
        const v = card[k] || (k === 'identity' ? card.role : '');
        return v ? (
          <div key={k}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--muted-2)', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-quiet)', whiteSpace: 'pre-wrap' }}>{v}</div>
          </div>
        ) : null;
      })}
      {Array.isArray(card.tags) && card.tags.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {card.tags.map((t, i) => <span key={i} className="mono" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--panel-3)', color: 'var(--muted)' }}>{t}</span>)}
        </div>
      ) : null}
    </div>
  );
}
function PersonaFields({ form, u }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {_cardFields().map(([k, l]) => (
        <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{l}</span>
          {_CARD_MULTILINE.has(k)
            ? <textarea className="tv-m-input" rows={3} value={form[k] || ''} onChange={(e) => u(k, e.target.value)} />
            : <input className="tv-m-input" value={form[k] || ''} onChange={(e) => u(k, e.target.value)} />}
        </label>
      ))}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('mobile.tavern.card_field.tags_label')}</span>
        <input className="tv-m-input" value={form.tags || ''} onChange={(e) => u('tags', e.target.value)} />
      </label>
    </div>
  );
}

export { cardFormInit, cardFormPayload, CardReadout, PersonaFields };
