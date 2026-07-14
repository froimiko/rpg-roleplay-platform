/* Extracted from pages/MobileSaves.jsx — mechanical split, byte-for-byte. */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { ConfirmSheet } from '../Sheet.jsx';
import { normSave } from './helpers.js';

/* ── 分支树页 (saves-branches) ───────────────────────────── */
function BranchesPage({ nav }) {
  const { t } = useTranslation();
  const [saves, setSaves] = useState([]);
  const [savesLoaded, setSavesLoaded] = useState(false);
  const [selectedSave, setSelectedSave] = useState(null);
  const [treePayload, setTreePayload] = useState(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeErr, setTreeErr] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [activating, setActivating] = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // 拉 saves 列表
  useEffect(() => {
    (async () => {
      try {
        const r = await window.api.saves.list();
        // 存档 = 游戏模式专属;酒馆会话(save_kind='tavern')不进存档列表(它们在酒馆页)。
        const list = (Array.isArray(r) ? r : (r?.items || r?.saves || []))
          .filter(s => (s && (s.save_kind || 'game')) !== 'tavern')
          .map(normSave);
        setSaves(list);
        if (list.length) setSelectedSave(prev => prev && list.some(s => s.id === prev) ? prev : list[0].id);
      } catch (_) {}
      setSavesLoaded(true);
    })();
  }, []);

  // 拉 branch tree
  const reloadTree = useCallback(async () => {
    if (!selectedSave) { setTreePayload(null); return; }
    setTreeLoading(true); setTreeErr('');
    try {
      const r = await window.api.branches.list(selectedSave);
      const aid = r?.active_commit_id || r?.active_branch_node_id;
      const nodes = (r?.nodes || r?.commits || []).map((n, i) => {
        const refNames = Array.isArray(n.ref_names) ? n.ref_names : [];
        const shortRefs = refNames.map(rn => String(rn).startsWith('refs/') ? String(rn).split('/').slice(2).join('/') : rn);
        return {
          id: n.id,
          summary: n.summary || n.message || n.content_preview || t('mobile.saves.branch.node_fallback', { id: n.id }),
          turn: n.turn_index ?? i,
          kind: n.kind || 'round',
          ref_names: refNames,
          short_refs: shortRefs,
          current: n.id === aid,
          deleted: !!n.deleted,
        };
      });
      setTreePayload({ nodes, refs: r?.refs || [], active_commit_id: aid });
    } catch (e) { setTreeErr(e?.message || t('mobile.saves.branches_page.load_failed')); setTreePayload(null); }
    setTreeLoading(false);
  }, [selectedSave]);

  useEffect(() => { reloadTree(); }, [reloadTree]);

  const doActivate = async (nodeId) => {
    setActivating(nodeId);
    try {
      await window.api.branches.activate({ save_id: selectedSave, commit_id: nodeId, node_id: nodeId });
      nav.toast(t('mobile.saves.branch.switched'), 'ok');
      await reloadTree();
    } catch (e) { nav.toast(t('mobile.saves.branches_page.switch_failed'), 'danger'); }
    setActivating(null);
  };

  const doDelete = async () => {
    if (!delTarget) return;
    const cid = delTarget.id;
    setDeleting(true);
    try {
      await window.api.branches.delete({ save_id: selectedSave, node_id: cid, commit_id: cid });
      nav.toast(t('mobile.saves.branches_page.node_deleted'), 'ok');
      setDelTarget(null);
      await reloadTree();
    } catch (e) { nav.toast(t('mobile.saves.branches_page.delete_failed'), 'danger'); }
    setDeleting(false);
  };

  const doContinue = () => {
    const save = saves.find(s => s.id === selectedSave);
    if (save) nav.openGame(save);
  };

  const nodes = treePayload?.nodes || [];

  // 空态
  if (savesLoaded && saves.length === 0) {
    return (
      <>
        <div className="pl-head">
          <button className="pl-back" onClick={() => nav.go('saves')}><Icon name="chevron_left" size={20} /></button>
          <div className="pl-head-title center"><strong>{t('mobile.saves.branches_page.title')}</strong></div>
        </div>
        <div className="pl-body tabbed">
          <div className="pl-pad">
            <div className="pl-empty">
              <div className="ic"><Icon name="branch" size={24} /></div>
              <h3>{t('mobile.saves.list.empty_title')}</h3>
              <p>{t('mobile.saves.branches_page.no_saves_desc')}</p>
              <button className="pl-btn-primary" style={{ marginTop: 16, maxWidth: 200 }} onClick={() => nav.go('saves')}>
                <Icon name="save" size={17} />{t('mobile.saves.branches_page.go_saves_btn')}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pl-head">
        <button className="pl-back" onClick={() => nav.go('saves')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title">
          <strong>{t('mobile.saves.branches_page.title')}</strong>
          <span className="sub">{t('mobile.saves.branches_page.node_count', { count: nodes.length })}</span>
        </div>
        <div className="pl-head-actions">
          <button className="pl-headbtn" onClick={reloadTree}><Icon name="refresh" size={18} /></button>
          <button className="pl-headbtn accent" onClick={doContinue}><Icon name="play" size={18} /></button>
        </div>
      </div>

      {/* 存档选择器 */}
      {saves.length > 1 && (
        <div style={{ padding: '8px 16px 0' }}>
          <select
            value={selectedSave || ''}
            onChange={e => setSelectedSave(Number(e.target.value))}
            style={{
              width: '100%', height: 40, borderRadius: 11,
              border: '1px solid var(--line-soft)', background: 'var(--panel)',
              color: 'var(--text)', fontSize: 16, padding: '0 12px', outline: 'none',
            }}
          >
            {saves.map(s => <option key={s.id} value={s.id}>{s.title || t('mobile.saves.save_fallback', { id: s.id })}</option>)}
          </select>
        </div>
      )}

      <div className="pl-body tabbed">
        <div className="pl-pad">
          {treeLoading && (
            <div className="pl-empty" style={{ padding: 32 }}>
              <div className="ic"><Icon name="branch" size={22} /></div>
              <p>{t('common.loading')}</p>
            </div>
          )}
          {!treeLoading && treeErr && (
            <div className="pl-empty">
              <div className="ic"><Icon name="warn" size={22} /></div>
              <h3>{t('mobile.saves.branches_page.load_failed')}</h3>
              <p>{treeErr}</p>
              <button className="pl-btn-ghost" style={{ marginTop: 14, maxWidth: 160 }} onClick={reloadTree}>
                <Icon name="refresh" size={16} />{t('mobile.saves.branches_page.retry_btn')}
              </button>
            </div>
          )}
          {!treeLoading && !treeErr && nodes.length === 0 && (
            <div className="pl-empty">
              <div className="ic"><Icon name="branch" size={22} /></div>
              <h3>{t('mobile.saves.branch.empty_title')}</h3>
              <p>{t('mobile.saves.branches_page.empty_desc')}</p>
            </div>
          )}
          {!treeLoading && !treeErr && nodes.length > 0 && (
            <>
              <div className="branch-tree">
                {nodes.filter(n => !n.deleted).map(n => (
                  <div key={n.id} className={'branch-row ' + (n.id === selectedNode ? 'sel' : '')}>
                    <div className="branch-rail">
                      <span className={'branch-node ' + (n.current ? 'accent' : (n.kind === 'root' ? 'info' : ''))} />
                      <span className="branch-line" />
                    </div>
                    <div style={{ display: 'grid', gap: 5 }}>
                      <button
                        className={'branch-card ' + (n.current ? 'current' : '')}
                        style={{ width: '100%', textAlign: 'left' }}
                        onClick={() => setSelectedNode(n.id === selectedNode ? null : n.id)}
                      >
                        <div className="branch-top">
                          <span className="branch-label serif">{n.summary}</span>
                          {n.current && <span className="branch-ref">HEAD</span>}
                          {n.short_refs.filter(r => r !== 'HEAD').slice(0, 1).map(r => (
                            <span key={r} className="branch-ref" style={{ background: 'var(--info-soft)', color: 'var(--info)', borderColor: 'rgba(122,166,194,.3)' }}>{r}</span>
                          ))}
                        </div>
                        <div className="branch-at">turn {n.turn} · {n.kind}</div>
                      </button>

                      {/* 展开操作 */}
                      {n.id === selectedNode && (
                        <div style={{ display: 'flex', gap: 7, paddingBottom: 4 }}>
                          <button
                            style={{
                              flex: 1, height: 34, borderRadius: 9,
                              border: '1px solid var(--accent-edge)', background: 'var(--accent-soft)',
                              color: 'var(--accent)', fontSize: 12.5, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            }}
                            onClick={() => n.current ? doContinue() : doActivate(n.id)}
                            disabled={activating === n.id}
                          >
                            <Icon name="play" size={14} />
                            {n.current ? t('mobile.saves.branches_page.continue_from') : (activating === n.id ? t('mobile.saves.branch.switching') : t('mobile.saves.branches_page.switch_to'))}
                          </button>
                          {!n.current && (
                            <button
                              style={{
                                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                                border: '1px solid rgba(200,103,93,0.3)', background: 'var(--danger-soft)',
                                color: 'var(--danger)', display: 'grid', placeItems: 'center',
                              }}
                              onClick={() => setDelTarget(n)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="pl-note" style={{ marginTop: 14 }}>
                {t('mobile.saves.branches_page.git_note_prefix')}<span className="mono" style={{ fontSize: 11 }}>refs/trash</span>{t('mobile.saves.branches_page.git_note_suffix')}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 删除节点确认 */}
      <ConfirmSheet
        open={!!delTarget}
        title={t('mobile.saves.branches_page.del_node_title', { id: delTarget?.id })}
        body={t('mobile.saves.branches_page.del_node_body', { summary: delTarget?.summary || t('mobile.saves.branches_page.this_node') })}
        danger
        confirmLabel={t('mobile.saves.branches_page.del_node_btn')}
        onCancel={() => setDelTarget(null)}
        onConfirm={doDelete}
        loading={deleting}
      />
    </>
  );
}

export { BranchesPage };
