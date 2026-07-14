/* TavernCharacterSelect — self-contained "选择角色" panel mechanically extracted
   from pages/tavern.jsx (byte-identical body, zero behavior change). */

import React from 'react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import CSButton from '@cloudscape-design/components/button';

/* 专门的「选择角色」面板 —— 点一张卡即建对话并进入聊天。
 * 与「角色卡」编辑页(UserCardsView)分离:这里只负责"挑谁聊",不做增删改。 */
export default function TavernCharacterSelect({ onPick, onCreateNew, onImport }) {
  const { t } = useTranslation();
  const [cards, setCards] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    window.api.cards.myList()
      .then((r) => {
        const list = Array.isArray(r) ? r : (r?.cards || r?.items || []);
        if (alive) setCards(list);
      })
      .catch(() => { if (alive) setCards([]); });
    return () => { alive = false; };
  }, []);
  const pick = async (c) => {
    if (busy) return;
    setBusy(true);
    try { await onPick(c); } finally { setBusy(false); }
  };
  return (
    <div className="tvp-select-wrap">
      <div className="tvp-select-head">
        <h2 className="tvp-select-title serif">{t('tavern_page.select.heading')}</h2>
        <div className="tvp-select-actions">
          <CSButton iconName="add-plus" onClick={onCreateNew}>{t('tavern_page.select.new_card_btn')}</CSButton>
          <CSButton iconName="upload" onClick={onImport}>{t('tavern_page.select.import_card_btn')}</CSButton>
        </div>
      </div>
      {cards == null && <div className="muted-2 tvp-select-empty">{t('common.loading')}</div>}
      {cards != null && cards.length === 0 && (
        <div className="tvp-select-empty muted-2">
          {t('tavern_page.select.empty_hint')}
        </div>
      )}
      {cards != null && cards.length > 0 && (
        <div className="tvp-select-grid">
          {cards.map((c) => (
            <button
              key={c.id} className="tvp-select-card" disabled={busy}
              onClick={() => pick(c)} title={t('tavern_page.select.card_title', { name: c.name || t('tavern_page.char_fallback') })}
            >
              <span className="tvp-select-avatar" aria-hidden="true">{(c.name || '?').trim().slice(0, 1)}</span>
              <span className="tvp-select-name">{c.name || t('tavern_page.select.unnamed_card')}</span>
              {c.identity ? <span className="tvp-select-identity muted-2">{c.identity}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
