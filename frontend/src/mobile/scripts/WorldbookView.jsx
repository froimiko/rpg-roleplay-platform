/* 世界书子视图 —— 从 pages/MobileScripts.jsx 拆出,逐字节不变。 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { EmptyState } from './EmptyState.jsx';

/* ─── 世界书子视图 ─────────────────────────────── */
function WorldbookView({ script, onBack }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!script) return;
    (async () => {
      try {
        const r = await window.api.scripts.worldbook(script.id);
        setEntries(Array.isArray(r) ? r : (r?.items || r?.entries || []));
      } catch (_) { setEntries([]); }
      finally { setLoading(false); }
    })();
  }, [script?.id]);

  return (
    <>
      <div className="pl-head">
        <button className="pl-back" onClick={onBack} aria-label={t('common.back')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title center">
          <strong>{t('mobile.scripts.worldbook.title')}</strong>
          <span className="sub">{script?.title}</span>
        </div>
      </div>
      <div className="pl-body tabbed">
        <div className="pl-pad">
          {loading && <div className="muted" style={{ fontSize: 13 }}>{t('common.loading')}</div>}
          {!loading && (!entries || entries.length === 0) && (
            <EmptyState icon="world" title={t('mobile.scripts.worldbook.empty_title')} desc={t('mobile.scripts.worldbook.empty_desc')} />
          )}
          {!loading && entries && entries.map((e, i) => (
            <div key={e.id || i} className="pl-card" style={{ marginBottom: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, color: 'var(--text)' }}>
                  {e.key || e.keys || e.title || e.keyword || t('mobile.scripts.worldbook.entry_n', { n: i + 1 })}
                </strong>
                <span className={'pill ' + (e.enabled !== false ? 'ok' : '')} style={{ height: 20, fontSize: 10 }}>
                  <span className={'dot ' + (e.enabled !== false ? 'ok' : '')} />
                  {e.enabled !== false ? t('mobile.scripts.worldbook.active') : t('mobile.scripts.worldbook.dormant')}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                {e.content || e.value || e.text || '—'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export { WorldbookView };
