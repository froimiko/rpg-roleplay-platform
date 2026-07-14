/* MobileCards 我的角色卡(user)列表/详情/编辑视图 UserView —— 从 pages/MobileCards.jsx 拆出,逐字节不变。 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { CardAv } from './shared.jsx';
import { CardEditor } from './CardEditor.jsx';
import { CardDetail } from './CardDetail.jsx';
import { ImportSheet, DeleteSheet } from './sheets.jsx';

/* ═══════════════════════════════════════════════════════════════════
   我的角色卡(user)列表视图
   ═══════════════════════════════════════════════════════════════════ */
function UserView({ nav }) {
  const { t } = useTranslation();
  const [view, setView] = useState('list'); // 'list' | 'detail' | 'edit'
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'pinned' | 'public'
  const [selected, setSelected] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = useCallback(async () => {
    try {
      const r = await window.api.cards.myList();
      const list = Array.isArray(r) ? r : (r?.cards || r?.items || []);
      setCards(list.map((c) => ({
        id: String(c.id),
        name: c.name || t('mobile.cards.unnamed'),
        role: c.identity || c.role || '—',
        origin: c.origin || '—',
        bio: c.description || c.summary || c.bio || c.personality || c.current_status || c.appearance || '',
        tags: c.tags || [],
        pinned: !!c.pinned,
        is_public: !!c.is_public,
        uses: c.uses || 0,
        updated: window.__fmt?.ago(c.updated_at) || c.updated_at || '—',
        _raw: c,
      })));
    } catch (_) {
      // 匿名/离线下忽略
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const h = () => reload();
    window.addEventListener('rpg-user-cards-updated', h);
    return () => window.removeEventListener('rpg-user-cards-updated', h);
  }, [reload]);

  let filtered = cards;
  if (filter === 'pinned') filtered = filtered.filter((c) => c.pinned);
  if (filter === 'public') filtered = filtered.filter((c) => c.is_public);
  if (q) filtered = filtered.filter((c) =>
    (c.name + c.role + c.bio + (c.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase())
  );

  const onSave = async (vals) => {
    try {
      await window.api.cards.myUpsert(vals);
      nav.toast(vals.id ? t('mobile.cards.toast.saved') : t('mobile.cards.toast.created'), 'ok', 'check');
      setView('list');
      setSelected(null);
      reload();
    } catch (e) {
      nav.toast(t('mobile.cards.toast.save_fail'), 'danger', 'warn');
    }
  };

  const onImport = async (payload) => {
    try {
      if (payload.type === 'card' && payload.file) {
        await window.api.cards.importTavern(payload.file, { aiSplit: payload.aiSplit });
      } else if (payload.type === 'card_json' && payload.json_string) {
        await window.api.cards.importJson({ json_string: payload.json_string, ai_split: payload.aiSplit });
      } else if (payload.type === 'chat' && payload.jsonl) {
        const title = payload.charName ? t('mobile.cards.import.chat_save_title', { name: payload.charName }) : undefined;
        await window.api.chats.importTavern({ jsonl: payload.jsonl, title });
        nav.toast(t('mobile.cards.toast.chat_imported'), 'ok', 'check');
        setShowImport(false);
        return;
      }
      nav.toast(t('mobile.cards.toast.imported'), 'ok', 'check');
      setShowImport(false);
      reload();
    } catch (e) {
      nav.toast(t('mobile.cards.toast.import_fail', { msg: e?.message || '' }), 'danger', 'warn');
    }
  };

  const onDuplicate = async (c) => {
    try {
      const src = c._raw || {};
      const body = { ...src, id: undefined, slug: undefined, name: (src.name || c.name) + t('mobile.cards.toast.duplicate_suffix') };
      await window.api.cards.myUpsert(body);
      nav.toast(t('mobile.cards.toast.duplicated'), 'ok', 'copy');
      reload();
    } catch (e) {
      nav.toast(t('mobile.cards.toast.duplicate_fail'), 'danger', 'warn');
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await window.api.cards.myDelete(deleteTarget.id);
      nav.toast(t('mobile.cards.toast.deleted', { name: deleteTarget.name }), 'ok', 'trash');
      setDeleteTarget(null);
      setView('list');
      setSelected(null);
      reload();
    } catch (e) {
      nav.toast(t('mobile.cards.toast.delete_fail'), 'danger', 'warn');
    }
  };

  const onExportTavern = (c) => {
    const url = window.api.cards.exportTavern(c.id);
    window.open(url, '_blank');
  };

  const onSetPublic = async (c, pub) => {
    try {
      await window.api.cards.setPublic(c.id, pub);
      nav.toast(pub ? t('mobile.cards.toast.published') : t('mobile.cards.toast.unpublished'), 'ok', 'check');
      reload();
    } catch (e) {
      nav.toast(t('mobile.cards.toast.op_fail'), 'danger', 'warn');
    }
  };

  // ── 编辑子视图 ──
  if (view === 'edit') {
    return (
      <>
        <CardEditor
          card={selected?._raw || selected}
          isNew={!selected}
          kind="user"
          onBack={() => setView(selected ? 'detail' : 'list')}
          onSave={onSave}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </>
    );
  }

  // ── 详情子视图 ──
  if (view === 'detail' && selected) {
    return (
      <>
        <CardDetail
          card={selected}
          kind="user"
          onBack={() => setView('list')}
          onEdit={() => setView('edit')}
          onDuplicate={() => onDuplicate(selected)}
          onDelete={() => setDeleteTarget(selected)}
          onExportTavern={() => onExportTavern(selected)}
        />
        <DeleteSheet
          show={!!deleteTarget}
          name={deleteTarget?.name || ''}
          onClose={() => setDeleteTarget(null)}
          onConfirm={onDelete}
        />
      </>
    );
  }

  // ── 列表视图 ──
  return (
    <>
      <div className="pl-head">
        <div className="pl-head-title">
          <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 20 }}>{t('mobile.cards.user.title')}</strong>
          <span className="sub">{t('mobile.cards.user.count', { count: cards.length })}</span>
        </div>
        <div className="pl-head-actions">
          <button className="pl-headbtn" onClick={() => setShowImport(true)} aria-label={t('mobile.cards.user.btn_import')}>
            <Icon name="upload" size={17} />
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
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mobile.cards.user.search_placeholder')} />
        </div>
      </div>

      {/* 筛选 pill */}
      <div className="pl-seg-scroll" style={{ paddingTop: 0, paddingBottom: 10 }}>
        {[{ id: 'all', l: t('common.all') }, { id: 'pinned', l: t('mobile.cards.user.filter_pinned') }, { id: 'public', l: t('mobile.cards.user.filter_public') }].map((tb) => (
          <button key={tb.id} className={'pl-pill' + (filter === tb.id ? ' active' : '')} onClick={() => setFilter(tb.id)}>
            {tb.l}
          </button>
        ))}
      </div>

      <div className="pl-body tabbed">
        <div className="pl-pad" style={{ paddingTop: 4 }}>
          {loading && cards.length === 0 && (
            <div className="pl-empty">{t('common.loading')}</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="pl-empty">
              {q ? t('mobile.cards.user.empty_search') : filter !== 'all' ? t('mobile.cards.user.empty_filter') : t('mobile.cards.user.empty_all')}
            </div>
          )}
          {/* 卡网格 */}
          <div className="pl-grid">
            {filtered.map((c) => (
              <button key={c.id} className="pl-charcard" onClick={() => { setSelected(c); setView('detail'); }}>
                <div className="av accent mc-card-av-wrap" style={{ position: 'relative' }}>
                  <CardAv fill src={c._raw?.avatar_path || c._raw?.avatar_url} name={c.name} />
                  {c.enabled === false && <span className="off-dot" />}
                  {c.pinned && <span style={{ position: 'absolute', top: 7, left: 7, fontSize: 10, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 5px', borderRadius: 6, zIndex: 1 }}>{t('mobile.cards.user.badge_pinned')}</span>}
                  {c.is_public && <span style={{ position: 'absolute', bottom: 7, right: 7, fontSize: 9, color: 'var(--ok)', background: 'var(--ok-soft)', padding: '2px 5px', borderRadius: 6, zIndex: 1 }}>{t('mobile.cards.user.badge_public')}</span>}
                </div>
                <div className="cc-body">
                  <div className="cc-name">{c.name}</div>
                  <div className="cc-id">{c.role !== '—' ? c.role : ''}</div>
                  <div className="cc-desc" style={{ minHeight: 34 }}>{c.bio || '—'}</div>
                  <div className="cc-foot">
                    <Icon name="layers" size={11} />
                    {c.origin !== '—' ? c.origin : t('mobile.cards.user.origin_generic')}
                    <span style={{ flex: 1 }} />
                    {c.uses > 0 ? t('mobile.cards.user.uses_count', { count: c.uses }) : c.updated}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <ImportSheet show={showImport} onClose={() => setShowImport(false)} onConfirm={onImport} />
    </>
  );
}

export { UserView };
