/* NPC 子视图 —— 从 pages/MobileScripts.jsx 拆出,逐字节不变。 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { EmptyState } from './EmptyState.jsx';

/* ─── NPC 子视图 ──────────────────────────────── */
function NpcView({ script, onBack }) {
  const { t } = useTranslation();
  const [npcs, setNpcs] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!script) return;
    (async () => {
      try {
        const r = await window.api.cards.scriptList(script.id);
        setNpcs(Array.isArray(r) ? r : (r?.items || r?.cards || []));
      } catch (_) { setNpcs([]); }
      finally { setLoading(false); }
    })();
  }, [script?.id]);

  return (
    <>
      <div className="pl-head">
        <button className="pl-back" onClick={onBack} aria-label={t('common.back')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title center">
          <strong>{t('mobile.scripts.npc.title')}</strong>
          <span className="sub">{script?.title}</span>
        </div>
      </div>
      <div className="pl-body tabbed">
        <div className="pl-pad">
          {loading && <div className="muted" style={{ fontSize: 13 }}>{t('common.loading')}</div>}
          {!loading && (!npcs || npcs.length === 0) && (
            <EmptyState icon="cards" title={t('mobile.scripts.npc.empty_title')} desc={t('mobile.scripts.npc.empty_desc')} />
          )}
          {!loading && npcs && npcs.map((c, i) => (
            <div key={c.id || i} className="pl-card" style={{ marginBottom: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'var(--panel-3)', border: '1px solid var(--line)', fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--accent)' }}>
                  {(c.name || '?').slice(0, 1)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, color: 'var(--text)' }}>
                    {c.name || t('mobile.scripts.npc.unnamed')}
                    {c.metadata?.is_protagonist && (
                      <span className="pill accent" style={{ marginLeft: 7, height: 18, fontSize: 9.5 }}>{t('mobile.scripts.npc.protagonist')}</span>
                    )}
                    {c.enabled === false && (
                      <span className="pill" style={{ marginLeft: 5, height: 18, fontSize: 9.5 }}>{t('mobile.scripts.npc.disabled')}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 2 }}>
                    {c.identity || c.role || 'NPC'}
                    {c.first_revealed_chapter > 1 && <span className="mono" style={{ marginLeft: 6 }}>{t('mobile.scripts.npc.first_appears', { ch: c.first_revealed_chapter })}</span>}
                  </div>
                </div>
              </div>
              {(c.content || c.description || c.bio) && (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {c.content || c.description || c.bio}
                </p>
              )}
              {Array.isArray(c.aliases) && c.aliases.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                  {c.aliases.slice(0, 4).map((a, j) => <span key={j} className="pl-tag sm">{a}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export { NpcView };
