/* MobileCards NPC 卡视图 NpcView —— 从 pages/MobileCards.jsx 拆出,逐字节不变。 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { CardAv } from './shared.jsx';
import { CardEditor } from './CardEditor.jsx';
import { CardDetail } from './CardDetail.jsx';
import { DeleteSheet } from './sheets.jsx';

/* ═══════════════════════════════════════════════════════════════════
   NPC 卡视图
   ═══════════════════════════════════════════════════════════════════ */
function NpcView({ nav }) {
  const { t } = useTranslation();
  const [view, setView] = useState('list');
  const [cards, setCards] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [scriptFilter, setScriptFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newScriptId, setNewScriptId] = useState('');

  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const sr = await window.api.scripts.list();
      const scriptList = Array.isArray(sr) ? sr : (sr?.items || sr?.scripts || []);
      setScripts(scriptList);
      if (!scriptList.length) { setCards([]); setLoading(false); return; }
      const lists = await Promise.all(scriptList.map(async (s) => {
        try {
          const r = await window.api.cards.scriptList(s.id);
          const arr = Array.isArray(r) ? r : (r?.items || r?.cards || []);
          return arr.map((c) => ({
            id: String(c.id),
            name: c.name || t('mobile.cards.unnamed'),
            role: c.identity || c.role || '—',
            save: s.title || t('mobile.cards.npc.script_n', { id: s.id }),
            script_id: s.id,
            bio: c.appearance || c.personality || c.summary || c.description || '',
            tags: Array.isArray(c.tags) ? c.tags : [],
            uses: c.uses || 0,
            updated: window.__fmt?.ago(c.updated_at) || c.updated_at || '—',
            _raw: c,
          }));
        } catch (_) { return []; }
      }));
      setCards(lists.flat());
    } catch (e) {
      setError(e?.message || t('mobile.cards.npc.load_fail'));
      setCards([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const scriptKeys = [...new Set(cards.map((c) => String(c.script_id)))].filter((k) => k && k !== 'null');
  const titleOfScript = (sid) => {
    const s = scripts.find((x) => String(x.id) === String(sid));
    return s?.title || cards.find((c) => String(c.script_id) === String(sid))?.save || t('mobile.cards.npc.script_n', { id: sid });
  };

  let filtered = cards;
  if (scriptFilter !== 'all') filtered = filtered.filter((c) => String(c.script_id) === scriptFilter);
  if (q) filtered = filtered.filter((c) =>
    (String(c.name) + String(c.role) + String(c.bio) + (c.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase())
  );

  const scriptOptions = scripts.map((s) => ({ value: String(s.id), label: s.title || t('mobile.cards.npc.script_n', { id: s.id }) }));

  useEffect(() => {
    const fallback = scriptFilter !== 'all' ? scriptFilter : scripts[0]?.id ? String(scripts[0].id) : '';
    setNewScriptId((prev) => (prev && scripts.some((s) => String(s.id) === prev) ? prev : fallback));
  }, [scripts, scriptFilter]);

  const onSaveNpc = async (vals) => {
    const sid = selected?.script_id || selected?._raw?.script_id || (scriptFilter !== 'all' ? scriptFilter : newScriptId) || (scripts.length === 1 ? String(scripts[0].id) : null);
    if (!sid) { nav.toast(t('mobile.cards.toast.npc_script_required'), 'warn', 'warn'); throw new Error('script_id required'); }
    try {
      const body = { ...vals, id: selected?._raw?.id ?? selected?.id ?? vals?.id };
      const r = await window.api.cards.scriptUpsert(sid, body);
      if (r && r.ok === false) throw new Error(r.error || r.detail || t('mobile.cards.toast.save_fail'));
      nav.toast(vals.id ? t('mobile.cards.toast.saved') : t('mobile.cards.toast.created'), 'ok', 'check');
      setView('list');
      setSelected(null);
      reload();
    } catch (e) {
      nav.toast(t('mobile.cards.toast.save_fail_detail', { msg: e?.message || '' }), 'danger', 'warn');
      throw e;
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    const sid = deleteTarget.script_id || deleteTarget._raw?.script_id;
    if (!sid) { nav.toast(t('mobile.cards.toast.npc_no_script'), 'danger', 'warn'); setDeleteTarget(null); return; }
    try {
      await window.api.cards.scriptDelete(sid, deleteTarget.id);
      nav.toast(t('mobile.cards.toast.deleted', { name: deleteTarget.name }), 'ok', 'trash');
      setDeleteTarget(null);
      setView('list');
      setSelected(null);
      reload();
    } catch (e) {
      nav.toast(t('mobile.cards.toast.delete_fail'), 'danger', 'warn');
    }
  };

  const onPromoteToUser = async (c) => {
    const raw = c._raw || c;
    const body = {
      name: c.name || raw.name || t('mobile.cards.unnamed'),
      identity: c.role || raw.identity || raw.role || '—',
      appearance: raw.appearance || c.bio || '',
      personality: raw.personality || '',
      speech_style: raw.speech_style || '',
      current_status: raw.current_status || '',
      secrets: raw.secrets || '',
      sample_dialogue: Array.isArray(raw.sample_dialogue) ? raw.sample_dialogue : [],
      tags: [...(Array.isArray(c.tags) && c.tags.length ? c.tags : []), t('mobile.cards.npc.promote_tag')],
      enabled: true,
    };
    try {
      const r = await window.api.cards.myUpsert(body);
      if (r && r.ok === false) throw new Error(r.error || r.detail || t('mobile.cards.toast.promote_fail'));
      nav.toast(t('mobile.cards.toast.promoted', { name: body.name }), 'ok', 'check');
      try { window.dispatchEvent(new CustomEvent('rpg-user-cards-updated')); } catch (_) {}
    } catch (e) {
      nav.toast(t('mobile.cards.toast.promote_fail'), 'danger', 'warn');
    }
  };

  // ── 编辑 ──
  if (view === 'edit') {
    return (
      <>
        <CardEditor
          card={selected?._raw || selected}
          isNew={!selected}
          kind="npc"
          onBack={() => setView(selected ? 'detail' : 'list')}
          onSave={onSaveNpc}
          targetScripts={!selected ? scriptOptions : []}
          targetScriptId={!selected ? newScriptId : ''}
          onTargetScriptChange={setNewScriptId}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>
    );
  }

  // ── 详情 ──
  if (view === 'detail' && selected) {
    return (
      <>
        <CardDetail
          card={selected}
          kind="npc"
          onBack={() => setView('list')}
          onEdit={() => setView('edit')}
          onDuplicate={() => {}}
          onDelete={() => setDeleteTarget(selected)}
          onExportTavern={() => {}}
        >
          <button className="pl-btn-ghost" style={{ marginTop: 9 }} onClick={() => onPromoteToUser(selected)}>
            <Icon name="user" size={15} /> {t('mobile.cards.npc.btn_promote')}
          </button>
        </CardDetail>
        <DeleteSheet
          show={!!deleteTarget}
          name={deleteTarget?.name || ''}
          onClose={() => setDeleteTarget(null)}
          onConfirm={onDelete}
        />
      </>
    );
  }

  // ── 列表 ──
  return (
    <>
      <div className="pl-head">
        <div className="pl-head-title">
          <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 20 }}>{t('mobile.cards.npc.title')}</strong>
          <span className="sub">{loading ? t('common.loading') : t('mobile.cards.npc.count', { count: cards.length })}</span>
        </div>
        <div className="pl-head-actions">
          <button className="pl-headbtn" onClick={reload} aria-label={t('common.refresh')}>
            <Icon name="refresh" size={17} />
          </button>
          <button className="pl-headbtn accent" onClick={() => { setSelected(null); setView('edit'); }} aria-label={t('mobile.cards.user.btn_new')}>
            <Icon name="plus" size={20} />
          </button>
        </div>
      </div>

      {/* 搜索 */}
      <div className="pl-toolbar">
        <div className="pl-search">
          <Icon name="search" size={15} style={{ flexShrink: 0 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mobile.cards.npc.search_placeholder')} />
        </div>
      </div>

      {/* 剧本筛选 */}
      <div className="pl-seg-scroll" style={{ paddingTop: 0, paddingBottom: 10 }}>
        <button className={'pl-pill' + (scriptFilter === 'all' ? ' active' : '')} onClick={() => setScriptFilter('all')}>
          {t('mobile.cards.npc.filter_all_scripts')}
        </button>
        {scriptKeys.map((sid) => (
          <button key={sid} className={'pl-pill' + (scriptFilter === sid ? ' active' : '')} onClick={() => setScriptFilter(sid)}>
            {titleOfScript(sid)}
          </button>
        ))}
      </div>

      <div className="pl-body tabbed">
        <div className="pl-pad" style={{ paddingTop: 4 }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>
              <Icon name="warn" size={13} style={{ marginRight: 6 }} />{error}
            </div>
          )}
          {loading && cards.length === 0 && <div className="pl-empty">{t('common.loading')}</div>}
          {!loading && filtered.length === 0 && (
            <div className="pl-empty">
              {q ? t('mobile.cards.npc.empty_search') : scriptFilter !== 'all' ? t('mobile.cards.npc.empty_script') : t('mobile.cards.npc.empty_all')}
            </div>
          )}
          <div className="pl-grid">
            {filtered.map((c) => (
              <button key={c.id} className="pl-charcard" onClick={() => { setSelected(c); setView('detail'); }}>
                <div className="av mc-card-av-wrap" style={{ position: 'relative' }}>
                  <CardAv fill src={c._raw?.avatar_path || c._raw?.avatar_url} name={c.name} />
                </div>
                <div className="cc-body">
                  <div className="cc-name">{c.name}</div>
                  <div className="cc-id">{c.role !== '—' ? c.role : ''}</div>
                  <div className="cc-desc" style={{ minHeight: 34 }}>{c.bio || '—'}</div>
                  <div className="cc-foot">
                    <Icon name="book_open" size={11} />
                    {c.save}
                    <span style={{ flex: 1 }} />
                    {c.uses > 0 ? t('mobile.cards.user.uses_count', { count: c.uses }) : c.updated}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export { NpcView };
