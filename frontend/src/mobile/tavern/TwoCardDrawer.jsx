/* MobileTavern 双卡抽屉(AI 角色卡 / 我的 persona / 系统提示)—— 从 pages/MobileTavern.jsx 拆出,逐字节不变。 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { cardFormInit, cardFormPayload, CardReadout, PersonaFields } from './card.jsx';

/* ─── 双卡抽屉(右侧滑入 drawer):AI 角色卡 + 我的 persona + 系统提示 ── */
function TwoCardDrawer({ open, character, persona, systemPrompt, immersive, onToggleImmersive, onClose, onSavePersona, onSaveSystemPrompt }) {
  const [tab, setTab] = useState('character');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => cardFormInit(persona));
  const [saving, setSaving] = useState(false);
  const [spVal, setSpVal] = useState(systemPrompt || '');
  const [spEditing, setSpEditing] = useState(false);
  const [spSaving, setSpSaving] = useState(false);

  useEffect(() => { setForm(cardFormInit(persona)); setEditing(false); }, [persona, open]);
  useEffect(() => { setSpVal(systemPrompt || ''); setSpEditing(false); }, [systemPrompt, open]);

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const doSave = async () => {
    setSaving(true);
    try { await onSavePersona(cardFormPayload(form, persona)); setEditing(false); }
    finally { setSaving(false); }
  };
  const doSaveSP = async () => {
    setSpSaving(true);
    try { await (onSaveSystemPrompt && onSaveSystemPrompt(spVal)); setSpEditing(false); }
    finally { setSpSaving(false); }
  };

  const { t } = useTranslation();
  return (
    <>
      <div className={`scrim${open ? ' show' : ''}`} onClick={onClose} />
      <aside className={`drawer drawer-right${open ? ' open' : ''}`}>
        <div className="drawer-head">
          <button className="drawer-x" onClick={onClose}><Icon name="close" size={15} /></button>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{t('mobile.tavern.drawer.heading')}</h2>
        </div>
        {/* 三 Tab 分段 */}
        <div className="tv-m-drawer-tabs">
          <button
            className={`tv-m-drawer-tab${tab === 'character' ? ' active' : ''}`}
            onClick={() => setTab('character')}
          >
            <Icon name="cards" size={13} /> {t('mobile.tavern.drawer.tab_character')}
          </button>
          <button
            className={`tv-m-drawer-tab${tab === 'persona' ? ' active' : ''}`}
            onClick={() => setTab('persona')}
          >
            <Icon name="user" size={13} /> {t('m_tavern_extra.tab_persona')}
          </button>
          <button
            className={`tv-m-drawer-tab${tab === 'system' ? ' active' : ''}`}
            onClick={() => setTab('system')}
          >
            <Icon name="braces" size={13} /> {t('mobile.tavern.drawer.tab_system')}
          </button>
        </div>

        <div className="drawer-body" style={{ padding: '0 14px' }}>
          {/* ── AI 角色卡 ── */}
          {tab === 'character' && (
            <>
              {/* 沉浸式拟人模式开关:让 AI 以真人(角色卡)口吻实时对话、不替玩家说话/行动 */}
              {onToggleImmersive && (
                <div className="tv-m-immersive-row">
                  <div className="tv-m-immersive-tx">
                    <strong>{t('mobile.tavern.immersive.label')}</strong>
                    <span className="muted-2">{t('mobile.tavern.immersive.desc')}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!immersive}
                    className={`tv-m-switch${immersive ? ' on' : ''}`}
                    onClick={() => onToggleImmersive(!immersive)}
                    aria-label={t('mobile.tavern.immersive.label')}
                  >
                    <span className="tv-m-switch-knob" />
                  </button>
                </div>
              )}
              {character
                ? <CardReadout card={character} />
                : <div className="muted-2" style={{ padding: '28px 0', textAlign: 'center', fontSize: 13 }}>{t('mobile.tavern.drawer.no_character')}</div>}
            </>
          )}

          {/* ── Persona ── */}
          {tab === 'persona' && (
            !editing ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 10px' }}>
                  <strong style={{ fontSize: 14, fontFamily: 'var(--font-serif)' }}>
                    {(persona && persona.name) || t('mobile.tavern.drawer.your_persona')}
                  </strong>
                  {persona && (
                    <button
                      className="sheet-btn"
                      style={{ flex: 'none', width: 'auto', height: 34, padding: '0 12px', fontSize: 13 }}
                      onClick={() => setEditing(true)}
                    >
                      <Icon name="edit" size={12} /> {t('common.edit')}
                    </button>
                  )}
                </div>
                {persona
                  ? <CardReadout card={persona} />
                  : <div className="muted-2" style={{ padding: '28px 0', textAlign: 'center', fontSize: 13 }}>{t('mobile.tavern.drawer.no_persona')}</div>
                }
              </>
            ) : (
              <>
                <div style={{ paddingTop: 14 }}>
                  <PersonaFields form={form} u={u} />
                </div>
                <div className="sheet-actions" style={{ marginTop: 14, paddingBottom: 14 }}>
                  <button className="sheet-btn" onClick={() => setEditing(false)} disabled={saving}>{t('common.cancel')}</button>
                  <button className="sheet-btn primary" onClick={doSave} disabled={saving}>
                    <Icon name="check" size={12} /> {saving ? t('mobile.tavern.sysprompt.saving') : t('common.save')}
                  </button>
                </div>
              </>
            )
          )}

          {/* ── 系统提示词 ── */}
          {tab === 'system' && (
            <div style={{ paddingTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong style={{ fontSize: 14 }}>{t('mobile.tavern.sysprompt.title')}</strong>
                {!spEditing && onSaveSystemPrompt && (
                  <button
                    className="sheet-btn"
                    style={{ flex: 'none', width: 'auto', height: 34, padding: '0 12px', fontSize: 13 }}
                    onClick={() => setSpEditing(true)}
                  >
                    <Icon name="edit" size={12} /> {t('common.edit')}
                  </button>
                )}
              </div>
              {!spEditing ? (
                (spVal || '').trim()
                  ? <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, color: 'var(--text-quiet)' }}>{spVal}</div>
                  : <div className="muted-2" style={{ fontSize: 13, lineHeight: 1.7 }}>{t('mobile.tavern.drawer.no_sysprompt')}</div>
              ) : (
                <>
                  <textarea
                    className="tv-m-input"
                    value={spVal}
                    onChange={e => setSpVal(e.target.value)}
                    rows={10}
                    placeholder={t('mobile.tavern.sysprompt.placeholder_short')}
                    style={{ resize: 'vertical', minHeight: 160 }}
                  />
                  <div className="sheet-actions" style={{ marginTop: 12, paddingBottom: 14 }}>
                    <button className="sheet-btn" onClick={() => { setSpVal(systemPrompt || ''); setSpEditing(false); }} disabled={spSaving}>{t('common.cancel')}</button>
                    <button className="sheet-btn primary" onClick={doSaveSP} disabled={spSaving}>
                      <Icon name="check" size={12} /> {spSaving ? t('mobile.tavern.sysprompt.saving') : t('common.save')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export { TwoCardDrawer };
