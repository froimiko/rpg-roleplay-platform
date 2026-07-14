/* Extracted from pages/MobileSaves.jsx — mechanical split, byte-for-byte. */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';

/* ── 分支节点列表(内嵌) ─────────────────────────────────── */
function BranchListPane({ save, onToast, onContinue }) {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [activating, setActivating] = useState(null);

  const reload = useCallback(async () => {
    if (!save?.id) return;
    setNodes(null);
    try {
      const r = await window.api.branches.list(save.id);
      const aid = r?.active_commit_id || r?.active_branch_node_id;
      setActiveId(aid);
      const ns = (r?.nodes || r?.commits || []).map((n, i) => ({
        id: n.id,
        summary: n.summary || n.message || n.content_preview || t('mobile.saves.branch.node_fallback', { id: n.id }),
        turn: n.turn_index ?? i,
        kind: n.kind || 'round',
        current: n.id === aid,
        short_refs: Array.isArray(n.ref_names)
          ? n.ref_names.map(rn => String(rn).startsWith('refs/') ? String(rn).split('/').slice(2).join('/') : rn)
          : [],
        deleted: !!n.deleted,
      }));
      setNodes(ns);
    } catch (_) { setNodes([]); }
  }, [save?.id]);

  useEffect(() => { reload(); }, [reload]);

  const doActivate = async (n) => {
    setActivating(n.id);
    try {
      await window.api.branches.activate({ save_id: save.id, commit_id: n.id, node_id: n.id });
      onToast(t('mobile.saves.branch.switched'), 'ok');
      await reload();
    } catch (e) { onToast(t('mobile.saves.branch.switch_failed', { msg: e?.message || '' }), 'danger'); }
    setActivating(null);
  };

  if (!nodes) return (
    <div className="pl-empty" style={{ padding: 32 }}>
      <div className="ic"><Icon name="branch" size={22} /></div>
      <p>{t('mobile.saves.branch.loading')}</p>
    </div>
  );
  if (!nodes.length) return (
    <div className="pl-empty" style={{ padding: 32 }}>
      <div className="ic"><Icon name="branch" size={22} /></div>
      <h3>{t('mobile.saves.branch.empty_title')}</h3>
      <p>{t('mobile.saves.branch.empty_desc')}</p>
    </div>
  );

  return (
    <div className="branch-tree">
      {nodes.filter(n => !n.deleted).map((n) => (
        <div key={n.id} className="branch-row">
          <div className="branch-rail">
            <span className={'branch-node ' + (n.current ? 'accent' : (n.kind === 'root' ? 'info' : ''))} />
            <span className="branch-line" />
          </div>
          <button
            className={'branch-card ' + (n.current ? 'current' : '')}
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() => n.current ? onContinue(n) : doActivate(n)}
            disabled={activating === n.id}
          >
            <div className="branch-top">
              <span className="branch-label serif">{n.summary}</span>
              {n.current && (
                <span style={{
                  fontSize: 9.5, padding: '2px 8px', borderRadius: 99,
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                  border: '1px solid var(--accent-edge)', fontWeight: 600, flexShrink: 0,
                }}>HEAD</span>
              )}
              {n.short_refs.length > 0 && !n.current && (
                <span style={{
                  fontSize: 9.5, padding: '2px 7px', borderRadius: 99,
                  background: 'var(--panel-3)', color: 'var(--muted)', border: '1px solid var(--line)', flexShrink: 0,
                }}>{n.short_refs[0]}</span>
              )}
            </div>
            <div className="branch-at">
              turn {n.turn} · {n.kind}
              {activating === n.id ? ` · ${t('mobile.saves.branch.switching')}` : ''}
              {!n.current && ` · ${t('mobile.saves.branch.click_to_switch')}`}
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}

export { BranchListPane };
