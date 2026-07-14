/* 在线剧本库视图 —— 从 pages/MobileScripts.jsx 拆出,逐字节不变。 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { EmptyState } from './EmptyState.jsx';
import { fmtN, fmtWan } from './helpers.js';

/* ─── 在线剧本库视图 ─────────────────────────── */
function LibraryView({ onBack, nav }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cloningId, setCloningId] = useState(null);
  const [importedIds, setImportedIds] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);

  const reload = useCallback(async (query) => {
    setLoading(true);
    try {
      const r = await window.api.scripts.publicList(query ? { q: query } : undefined);
      setItems(Array.isArray(r?.items) ? r.items : []);
    } catch (e) {
      nav.toast(e?.message || t('mobile.scripts.library.load_error'), 'danger', 'warn');
      setItems([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(''); }, [reload]);

  const onClone = async (s) => {
    setCloningId(s.id);
    try {
      const r = await window.api.scripts.cloneFromPublic(s.id);
      if (r?.ok === false) throw new Error(r.error || t('mobile.scripts.library.clone_error'));
      nav.toast(t('mobile.scripts.library.cloned', { title: s.title }), 'ok', 'check');
      setImportedIds(m => ({ ...m, [s.id]: true }));
      setItems(arr => arr.map(x => x.id === s.id ? { ...x, clone_count: (x.clone_count || 0) + 1 } : x));
      try { window.dispatchEvent(new CustomEvent('rpg-scripts-updated')); } catch (_) {}
    } catch (e) {
      nav.toast(e?.message || t('mobile.scripts.library.clone_error'), 'danger', 'warn');
    } finally { setCloningId(null); }
  };

  if (selectedItem) {
    const s = selectedItem;
    const alreadyImported = s.mine || importedIds[s.id];
    return (
      <>
        <div className="pl-head">
          <button className="pl-back" onClick={() => setSelectedItem(null)} aria-label={t('common.back')}><Icon name="chevron_left" size={20} /></button>
          <div className="pl-head-title">
            <strong style={{ fontSize: 14.5 }}>{s.title}</strong>
            <span className="sub">{t('mobile.scripts.library.title')} · {s.author || s.author_username || t('mobile.scripts.library.unknown_author')}</span>
          </div>
        </div>
        <div className="pl-body tabbed">
          <div className="pl-cover" style={{ height: 120, borderRadius: 0 }}>
            <span className="pl-cover-spine" />
            <div style={{ position: 'relative' }}>
              <h3 style={{ fontSize: 22 }}>{s.title}</h3>
              <div style={{ fontSize: 12, color: 'var(--text-quiet)', marginTop: 5 }}>{s.author || s.author_username || t('mobile.scripts.library.unknown_author')}</div>
            </div>
            {alreadyImported && (
              <span className="pill ok" style={{ position: 'absolute', top: 10, right: 10, height: 20, fontSize: 10 }}>
                <span className="dot ok" />{s.mine ? t('mobile.scripts.library.mine') : t('mobile.scripts.library.imported')}
              </span>
            )}
          </div>
          <div className="pl-pad">
            {s.description && <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--text-quiet)', lineHeight: 1.7 }}>{s.description}</p>}
            <div className="pl-kvgrid" style={{ marginBottom: 14 }}>
              <div className="pl-kv"><div className="k">{t('mobile.scripts.detail.stat_chapters')}</div><div className="v">{fmtN(s.chapter_count || 0)}</div></div>
              <div className="pl-kv"><div className="k">{t('mobile.scripts.detail.stat_words')}</div><div className="v">{fmtWan(s.word_count || 0)}</div></div>
              <div className="pl-kv"><div className="k">{t('mobile.scripts.library.clone_count')}</div><div className="v">{fmtN(s.clone_count || 0)}</div></div>
              <div className="pl-kv"><div className="k">ID</div><div className="v mono" style={{ fontSize: 11 }}>{s.uid || String(s.id).slice(0, 8)}</div></div>
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              {alreadyImported ? (
                <button className="pl-btn-ghost" disabled style={{ color: 'var(--ok)', borderColor: 'rgba(126,184,142,0.3)' }}>
                  <Icon name="check" size={17} /> {s.mine ? t('mobile.scripts.library.already_mine') : t('mobile.scripts.library.imported')}
                </button>
              ) : (
                <button className="pl-btn-primary" onClick={() => onClone(s)} disabled={cloningId === s.id}>
                  <Icon name="download" size={17} />{cloningId === s.id ? t('mobile.scripts.library.cloning') : t('mobile.scripts.library.clone_btn')}
                </button>
              )}
              <button className="pl-btn-ghost" onClick={() => setSelectedItem(null)}>
                <Icon name="chevron_left" size={16} /> {t('mobile.scripts.library.back_btn')}
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
        <button className="pl-back" onClick={onBack} aria-label={t('common.back')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title center">
          <strong>{t('mobile.scripts.library.title')}</strong>
          <span className="sub">{t('mobile.scripts.library.subtitle')}</span>
        </div>
        <div className="pl-head-actions">
          <button className="pl-headbtn" onClick={() => reload(q)} title={t('common.refresh')}>
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </div>
      <div className="pl-toolbar">
        <div className="pl-search">
          <Icon name="search" size={16} />
          <input
            placeholder={t('mobile.scripts.library.search_placeholder')}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && reload(q)}
          />
          {q && <button onClick={() => { setQ(''); reload(''); }}><Icon name="close" size={15} /></button>}
        </div>
        {q && <button className="pl-pill" onClick={() => reload(q)}>{t('mobile.scripts.library.search_btn')}</button>}
      </div>
      <div className="pl-body tabbed">
        <div className="pl-pad">
          {loading && <div className="muted" style={{ fontSize: 13, padding: '20px 0' }}>{t('common.loading')}</div>}
          {!loading && items.length === 0 && (
            <EmptyState icon="globe" title={q ? t('mobile.scripts.library.no_results') : t('mobile.scripts.library.empty_title')} desc={q ? t('mobile.scripts.library.try_other_keyword') : t('mobile.scripts.library.empty_desc')} />
          )}
          {items.map(s => (
            <button
              key={s.id}
              className="pl-cover-card"
              style={{ marginBottom: 13 }}
              onClick={() => setSelectedItem(s)}
            >
              <div className="pl-cover">
                <span className="pl-cover-spine" />
                <h3>{s.title}</h3>
                {(s.mine || importedIds[s.id]) && (
                  <span className="pill ok" style={{ position: 'absolute', top: 8, right: 10, height: 18, fontSize: 9.5 }}>
                    <span className="dot ok" />{s.mine ? t('mobile.scripts.library.in_library') : t('mobile.scripts.library.imported')}
                  </span>
                )}
              </div>
              <div className="pl-cover-body">
                {s.description && <div className="pl-cover-desc">{s.description.slice(0, 80)}{s.description.length > 80 ? '…' : ''}</div>}
                <div className="pl-cover-meta">
                  <Icon name="user" size={11} />
                  {s.author || s.author_username || '—'}
                  <span className="sep">·</span>
                  <Icon name="book_open" size={11} />
                  {fmtN(s.chapter_count || 0)} {t('mobile.scripts.unit.chapter')}
                  <span className="sep">·</span>
                  <Icon name="download" size={11} />
                  {fmtN(s.clone_count || 0)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export { LibraryView };
