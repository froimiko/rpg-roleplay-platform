/* 章节列表子视图 —— 从 pages/MobileScripts.jsx 拆出,逐字节不变。 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { EmptyState } from './EmptyState.jsx';
import { fmtN } from './helpers.js';

/* ─── 章节列表子视图 ──────────────────────────── */
function ChaptersView({ script, onBack, nav }) {
  const { t } = useTranslation();
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeContent, setActiveContent] = useState('');
  const [activeLoading, setActiveLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!script) return;
    setLoading(true); setErr('');
    (async () => {
      try {
        const r = await window.api.scripts.chapters(script.id, { limit: 5000 });
        setChapters((r && (r.chapters || r.items)) || []);
      } catch (e) {
        setErr(e?.message || t('mobile.scripts.chapters.load_error'));
      } finally { setLoading(false); }
    })();
  }, [script?.id, reloadTick]);

  useEffect(() => {
    if (!script || chapters.length === 0) { setActiveContent(''); return; }
    const cur = chapters[activeIdx];
    if (!cur) { setActiveContent(''); return; }
    const chIdx = cur.chapter_index ?? cur.index ?? activeIdx;
    let cancelled = false;
    setActiveLoading(true);
    (async () => {
      try {
        const r = await window.api.scripts.chapterDetail(script.id, chIdx);
        if (!cancelled) setActiveContent((r?.chapter?.content) || '');
      } catch (_) {
        if (!cancelled) setActiveContent(cur.content_preview || '');
      } finally { if (!cancelled) setActiveLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [script?.id, activeIdx, chapters]);

  const cur = chapters[activeIdx];
  const curIdx = cur ? (cur.chapter_index ?? cur.index ?? activeIdx) : activeIdx;

  const onRename = async () => {
    if (!cur) return;
    const newTitle = await window.__prompt({ title: t('mobile.scripts.chapters.rename_prompt'), default: cur.title || '' });
    if (!newTitle || newTitle === cur.title) return;
    try {
      await window.api.scripts.updateChapter(script.id, curIdx, { title: newTitle });
      nav.toast(t('mobile.scripts.chapters.renamed'), 'ok', 'check');
      setReloadTick(x => x + 1);
    } catch (e) { nav.toast(e?.message || t('mobile.scripts.op_failed'), 'danger', 'warn'); }
  };

  const onMergeNext = async () => {
    if (!cur || activeIdx >= chapters.length - 1) return;
    if (!await window.__confirm({ message: t('mobile.scripts.chapters.confirm_merge_next', { a: activeIdx + 1, b: activeIdx + 2 }), danger: true })) return;
    try {
      const nextCh = chapters[activeIdx + 1];
      const nextIdx = nextCh ? (nextCh.chapter_index ?? nextCh.index ?? (activeIdx + 1)) : (activeIdx + 1);
      await window.api.scripts.mergeChapter(script.id, { first_index: curIdx, second_index: nextIdx });
      nav.toast(t('mobile.scripts.chapters.merged'), 'ok', 'check');
      setReloadTick(x => x + 1);
    } catch (e) { nav.toast(e?.message || t('mobile.scripts.op_failed'), 'danger', 'warn'); }
  };
  // 合并上一章:把前面那章折进当前章,保留当前章标题(序章/前言折进第一章)。
  const onMergePrev = async () => {
    if (!cur || activeIdx <= 0) return;
    if (!await window.__confirm({ message: t('mobile.scripts.chapters.confirm_merge_prev', { a: activeIdx, b: activeIdx + 1 }), danger: true })) return;
    try {
      const prevCh = chapters[activeIdx - 1];
      const prevIdx = prevCh ? (prevCh.chapter_index ?? prevCh.index ?? (activeIdx - 1)) : (activeIdx - 1);
      await window.api.scripts.mergeChapter(script.id, { first_index: prevIdx, second_index: curIdx, keep_title_index: curIdx });
      nav.toast(t('mobile.scripts.chapters.merged'), 'ok', 'check');
      setReloadTick(x => x + 1);
    } catch (e) { nav.toast(e?.message || t('mobile.scripts.op_failed'), 'danger', 'warn'); }
  };

  const onResplit = async () => {
    const rule = await window.__prompt({ title: t('mobile.scripts.chapters.resplit_prompt'), default: 'auto' });
    if (!rule) return;
    try {
      await window.api.scripts.resplit(script.id, { split_rule: rule });
      nav.toast(t('mobile.scripts.chapters.resplit_done'), 'ok', 'check');
      setReloadTick(x => x + 1);
    } catch (e) { nav.toast(e?.message || t('mobile.scripts.op_failed'), 'danger', 'warn'); }
  };

  if (loading) {
    return (
      <>
        <div className="pl-head">
          <button className="pl-back" onClick={onBack} aria-label={t('common.back')}><Icon name="chevron_left" size={20} /></button>
          <div className="pl-head-title"><strong>{t('mobile.scripts.chapters.title')}</strong></div>
        </div>
        <div className="pl-body"><div className="pl-pad"><div className="muted" style={{ fontSize: 13 }}>{t('common.loading')}</div></div></div>
      </>
    );
  }

  return (
    <>
      <div className="pl-head">
        <button className="pl-back" onClick={onBack} aria-label={t('common.back')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title">
          <strong>{t('mobile.scripts.chapters.title')}</strong>
          <span className="sub">{t('mobile.scripts.chapters.subtitle', { total: chapters.length, current: activeIdx + 1 })}</span>
        </div>
        <div className="pl-head-actions">
          <button className="pl-headbtn" onClick={onResplit} title={t('mobile.scripts.chapters.resplit_title')}><Icon name="refresh" size={18} /></button>
        </div>
      </div>
      <div className="pl-body tabbed">
        {err && <div style={{ padding: '12px 16px', color: 'var(--danger)', fontSize: 13 }}>{err}</div>}
        {chapters.length === 0 ? (
          <div className="pl-pad"><EmptyState icon="file" title={t('mobile.scripts.chapters.empty_title')} desc={t('mobile.scripts.chapters.empty_desc')} /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: '100%' }}>
            {/* 章节选择器 */}
            <div style={{ overflowX: 'auto', display: 'flex', gap: 6, padding: '10px 16px 0', borderBottom: '1px solid var(--line-soft)' }} className="scroll">
              {chapters.map((c, i) => (
                <button
                  key={c.chapter_index ?? c.index ?? i}
                  onClick={() => setActiveIdx(i)}
                  style={{
                    flex: 'none', height: 32, padding: '0 12px', borderRadius: 999,
                    fontSize: 12, whiteSpace: 'nowrap',
                    background: i === activeIdx ? 'var(--accent-soft)' : 'var(--panel)',
                    color: i === activeIdx ? 'var(--accent)' : 'var(--muted)',
                    border: `1px solid ${i === activeIdx ? 'var(--accent-edge)' : 'var(--line-soft)'}`,
                  }}
                >
                  <span className="mono" style={{ fontSize: 11 }}>#{String(i + 1).padStart(3, '0')}</span>
                  {' '}
                  <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', verticalAlign: 'middle' }}>
                    {c.title || t('mobile.scripts.no_title')}
                  </span>
                </button>
              ))}
            </div>
            {/* 章节正文 */}
            {cur && (
              <div className="pl-pad" style={{ overflow: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 15 }}>{cur.title || t('mobile.scripts.no_title')}</strong>
                  <span className="mono muted-2" style={{ fontSize: 11 }}>{fmtN(cur.word_count || 0)}{t('mobile.scripts.unit.chars')}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
                    <button className="pl-pill" style={{ minHeight: 44, paddingTop: 6, paddingBottom: 6 }} onClick={onRename}><Icon name="edit" size={13} /> {t('mobile.scripts.chapters.rename_btn')}</button>
                    {activeIdx > 0 && (
                      <button className="pl-pill" style={{ minHeight: 44, paddingTop: 6, paddingBottom: 6 }} onClick={onMergePrev}><Icon name="link" size={13} /> {t('mobile.scripts.chapters.merge_prev_btn')}</button>
                    )}
                    {activeIdx < chapters.length - 1 && (
                      <button className="pl-pill" style={{ minHeight: 44, paddingTop: 6, paddingBottom: 6 }} onClick={onMergeNext}><Icon name="link" size={13} /> {t('mobile.scripts.chapters.merge_next_btn')}</button>
                    )}
                  </div>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-serif)', fontSize: 13.5, lineHeight: 1.75, margin: 0, color: 'var(--text-quiet)' }}>
                  {activeLoading
                    ? (cur.content_preview || '') + '\n\n' + t('mobile.scripts.chapters.loading_full')
                    : ((activeContent || cur.content_preview || '').slice(0, 8000) + ((activeContent?.length > 8000) ? '\n\n' + t('mobile.scripts.chapters.truncated') : ''))}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export { ChaptersView };
