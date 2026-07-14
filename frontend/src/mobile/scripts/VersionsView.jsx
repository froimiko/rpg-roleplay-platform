/* 版本历史子视图 —— 从 pages/MobileScripts.jsx 拆出,逐字节不变。 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { EmptyState } from './EmptyState.jsx';

/* ─── 版本历史子视图 ───────────────────────────── */
function VersionsView({ script, currentUserId, onBack, nav }) {
  const { t } = useTranslation();
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [rollingBack, setRollingBack] = useState(null);

  const loadCommits = useCallback(async (c = null) => {
    if (!script) return;
    setLoading(true);
    try {
      const params = { limit: 30 };
      if (c) params.cursor = c;
      const r = await window.api.scripts.commits(script.id, params);
      const list = Array.isArray(r) ? r : (r?.items || r?.commits || []);
      if (c) setCommits(prev => [...prev, ...list]);
      else setCommits(list);
      const nextCursor = r?.next_cursor || null;
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch (_) { nav.toast(t('mobile.scripts.versions.load_error'), 'danger', 'warn'); }
    finally { setLoading(false); }
  }, [script?.id]);

  useEffect(() => { loadCommits(null); }, [loadCommits]);

  const isOwner = script && currentUserId && script.owner_id === currentUserId;

  const onRollback = async (commit) => {
    if (!await window.__confirm({ message: t('mobile.scripts.versions.confirm_rollback', { id: (commit.id || '').slice(0, 8) }), danger: true })) return;
    setRollingBack(commit.id);
    try {
      await window.api.scripts.checkout(script.id, commit.id);
      nav.toast(t('mobile.scripts.versions.rolled_back'), 'ok', 'check');
      try { window.dispatchEvent(new CustomEvent('rpg-scripts-updated')); } catch (_) {}
      onBack();
    } catch (e) {
      nav.toast(e?.message || t('mobile.scripts.versions.rollback_error'), 'danger', 'warn');
    } finally { setRollingBack(null); }
  };

  return (
    <>
      <div className="pl-head">
        <button className="pl-back" onClick={onBack} aria-label={t('common.back')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title center">
          <strong>{t('mobile.scripts.versions.title')}</strong>
          <span className="sub">{script?.title}</span>
        </div>
      </div>
      <div className="pl-body tabbed">
        <div className="pl-pad">
          {loading && commits.length === 0 && <div className="muted" style={{ fontSize: 13 }}>{t('common.loading')}</div>}
          {!loading && commits.length === 0 && (
            <EmptyState icon="history" title={t('mobile.scripts.versions.empty_title')} />
          )}
          <div className="branch-tree">
            {commits.map((c, i) => (
              <div key={c.id || i} className="branch-row">
                <div className="branch-rail">
                  <span className={'branch-node ' + (c.id === script?.head_commit_id ? 'accent' : '')} />
                  <span className="branch-line" />
                </div>
                <div className="branch-card" style={{ width: '100%' }}>
                  <div className="branch-top">
                    <span className="branch-label serif">{c.message || c.kind || '—'}</span>
                    {c.id === script?.head_commit_id && (
                      <span className="branch-ref">{t('mobile.scripts.versions.current')}</span>
                    )}
                  </div>
                  <div className="branch-msg mono">{(c.id || '').slice(0, 8)} · {c.kind || ''}</div>
                  <div className="branch-at">{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</div>
                  {isOwner && c.id !== script?.head_commit_id && (
                    <button
                      onClick={() => onRollback(c)}
                      disabled
                      title={t('mobile.scripts.versions.checkout_unavailable')}
                      style={{
                        marginTop: 8, minHeight: 44, padding: '6px 12px', borderRadius: 8,
                        fontSize: 12, color: 'var(--accent)', border: '1px solid var(--accent-edge)',
                        background: 'var(--accent-soft)', opacity: 0.6, cursor: 'not-allowed',
                      }}
                    >
                      {t('mobile.scripts.versions.rollback_btn')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <button className="pl-btn-ghost" style={{ marginTop: 14 }} onClick={() => loadCommits(cursor)}>
              {loading ? t('common.loading') : t('common.load_more')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export { VersionsView };
