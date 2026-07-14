/* 版本历史 Drawer(从 ScriptDetail.jsx 二次拆出,纯机械搬家零行为变化)。 */

import React from 'react';
import { useState as useStatePL, useEffect as useEffectPL } from 'react';
import { useTranslation } from 'react-i18next';
import CSTable from '@cloudscape-design/components/table';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSButton from '@cloudscape-design/components/button';
import CSBox from '@cloudscape-design/components/box';
import CSBadge from '@cloudscape-design/components/badge';

/* ─── 版本历史 Drawer ────────────────────────────────────────────
   GET /api/scripts/{id}/commits?limit=30&cursor=X
   支持 cursor 翻页;当前 head_commit_id 行标 "current" badge;
   owner 可点回滚,非 owner disabled。 */
function VersionHistoryDrawer({ script, currentUserId, onClose }) {
  const { t } = useTranslation();
  const [commits, setCommits] = useStatePL([]);
  const [loading, setLoading] = useStatePL(false);
  const [cursor, setCursor] = useStatePL(null);
  const [hasMore, setHasMore] = useStatePL(false);
  const [rollingBack, setRollingBack] = useStatePL(null);

  const loadCommits = React.useCallback(async (c = null) => {
    if (!script) return;
    setLoading(true);
    try {
      const params = { limit: 30 };
      if (c) params.cursor = c;
      const r = await window.api.scripts.commits(script.id, params);
      const list = Array.isArray(r) ? r : (r?.items || r?.commits || []);
      const nextCursor = r?.next_cursor || null;
      if (c) {
        setCommits(prev => [...prev, ...list]);
      } else {
        setCommits(list);
      }
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch (_) {
      window.__apiToast?.(t('scripts.version.load_fail'), { kind: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [script?.id]);

  useEffectPL(() => {
    if (script) loadCommits(null);
  }, [script?.id, loadCommits]);

  const isOwner = script && currentUserId && script.owner_id === currentUserId;

  const onRollback = async (commit) => {
    if (!await window.__confirm({
      title: t('scripts.version.rollback_confirm', { id: String(commit.id ?? '').slice(0, 8) }),
      danger: true,
      confirmText: t('scripts.version.rollback_btn'),
    })) return;
    setRollingBack(commit.id);
    try {
      await window.api.scripts.checkout(script.id, commit.id);
      window.__apiToast?.(t('scripts.version.rollback_ok', { id: String(commit.id ?? '').slice(0, 8) }), { kind: 'ok' });
      try { window.dispatchEvent(new CustomEvent('rpg-scripts-updated')); } catch (_) {}
      onClose && onClose();
    } catch (e) {
      window.__apiToast?.(t('scripts.version.rollback_fail'), { kind: 'danger', detail: e?.message });
    } finally {
      setRollingBack(null);
    }
  };

  // ESC 关闭 + 点 backdrop 关闭
  useEffectPL(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!script) return null;

  return (
    <>
    {/* 半透明 backdrop:点击关闭 + 阻止鼠标事件穿透到下层主页面 */}
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.35)', zIndex: 899,
    }} />
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 92vw)',
      background: 'var(--panel, #1a1d22)', borderLeft: '1px solid var(--line-soft)',
      zIndex: 900, display: 'flex', flexDirection: 'column', overflowY: 'auto',
      boxShadow: '-4px 0 16px rgba(0,0,0,0.35)',
    }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <CSBox variant="h3" padding="n">{t('scripts.version.drawer_title')} · {script.title}</CSBox>
        <CSButton variant="normal" iconName="close" onClick={onClose}>{t('common.close')}</CSButton>
      </div>
      <div style={{ flex: 1, padding: '12px 16px' }}>
        <CSTable
          variant="embedded"
          loading={loading && commits.length === 0}
          loadingText={t('common.loading')}
          items={commits}
          trackBy="id"
          columnDefinitions={[
            {
              id: 'commit', header: t('scripts.version.col_commit'), width: 110,
              cell: (c) => (
                <CSSpaceBetween direction="horizontal" size="xxs" alignItems="center">
                  <span className="mono" style={{ fontSize: 12 }}>{String(c.id || '').slice(0, 8)}</span>
                  {script.head_commit_id && c.id === script.head_commit_id && (
                    <CSBadge color="green">{t('scripts.version.badge_current')}</CSBadge>
                  )}
                </CSSpaceBetween>
              ),
            },
            {
              id: 'message', header: t('scripts.version.col_message'),
              cell: (c) => <CSBox fontSize="body-s">{c.message || '—'}</CSBox>,
            },
            {
              id: 'kind', header: t('scripts.version.col_kind'), width: 90,
              cell: (c) => <CSBox fontSize="body-s" color="text-body-secondary">{c.kind || '—'}</CSBox>,
            },
            {
              id: 'date', header: t('scripts.version.col_date'), width: 130,
              cell: (c) => <CSBox fontSize="body-s" color="text-body-secondary">{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</CSBox>,
            },
            {
              id: 'action', header: '', width: 120,
              cell: (c) => (
                <CSButton
                  variant="inline-link"
                  disabled
                  title={t('scripts.version.checkout_unavailable')}
                  onClick={() => onRollback(c)}
                >{t('scripts.version.rollback_btn')}</CSButton>
              ),
            },
          ]}
          empty={<CSBox textAlign="center" padding={{ vertical: 'l' }} color="inherit">{t('scripts.version.empty')}</CSBox>}
        />
        {hasMore && (
          <div style={{ paddingTop: 12, textAlign: 'center' }}>
            <CSButton loading={loading} onClick={() => loadCommits(cursor)}>{t('common.load_more', { defaultValue: '加载更多' })}</CSButton>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export { VersionHistoryDrawer };
