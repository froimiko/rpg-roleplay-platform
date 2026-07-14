/* 时间线子视图 —— 从 pages/MobileScripts.jsx 拆出,逐字节不变。 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { EmptyState } from './EmptyState.jsx';

/* ─── 时间线子视图 ────────────────────────────── */
function TimelineView({ script, onBack }) {
  const { t } = useTranslation();
  const [phases, setPhases] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!script) return;
    (async () => {
      try {
        const r = await window.api.scripts.timeline(script.id);
        setPhases(r?.phases || []);
      } catch (_) { setPhases([]); }
      finally { setLoading(false); }
    })();
  }, [script?.id]);

  return (
    <>
      <div className="pl-head">
        <button className="pl-back" onClick={onBack} aria-label={t('common.back')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title center">
          <strong>{t('mobile.scripts.timeline.title')}</strong>
          <span className="sub">{script?.title}</span>
        </div>
      </div>
      <div className="pl-body tabbed">
        <div className="pl-pad">
          {loading && <div className="muted" style={{ fontSize: 13 }}>{t('common.loading')}</div>}
          {!loading && (!phases || phases.length === 0) && (
            <EmptyState icon="timeline" title={t('mobile.scripts.timeline.empty_title')} desc={t('mobile.scripts.timeline.empty_desc')} />
          )}
          {!loading && phases && phases.map((p, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 9 }}>
                <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 14 }}>{p.phase_label}</strong>
                <span className="mono muted-2" style={{ fontSize: 11, marginLeft: 8 }}>
                  {t('mobile.scripts.timeline.chapter_range', { min: p.chapter_min, max: p.chapter_max })}
                </span>
              </div>
              {p.summary && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{p.summary}</p>}
              <div className="branch-tree">
                {(p.anchors || []).map((a) => (
                  <div key={a.anchor_id} className="branch-row">
                    <div className="branch-rail">
                      <span className="branch-node accent" />
                      <span className="branch-line" />
                    </div>
                    <div className="branch-card" style={{ width: '100%' }}>
                      <div className="branch-top">
                        <span className="branch-label serif">{a.story_time_label || t('mobile.scripts.timeline.chapter_range', { min: a.chapter_min, max: a.chapter_max })}</span>
                      </div>
                      {a.sample_summary && (
                        <div className="branch-msg" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {String(a.sample_summary).replace(/\s+/g, ' ').trim().slice(0, 200)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export { TimelineView };
