/* 剧本列表 / 在线剧本库 / 章节管理弹窗 / overrides 弹窗。
   从 pages/scripts.jsx 拆出,JSX / props 流逐字节不变。 */

import React from 'react';
import { useState as useStatePL, useEffect as useEffectPL } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../game-icons.jsx';
import Modal from '../Modal.jsx';
import { PromptModal, usePlatformData, ResizableSplit } from '../../platform-app.jsx';
import { NewGameModal } from '../../pages/saves.jsx';
import { ScriptReview } from '../../pages/script-review.jsx';
import { ModuleRebuildPanel } from '../../pages/script-modules-panel.jsx';
import AvatarImg from '../AvatarImg.jsx';
import { ScriptDetailPanel } from './ScriptDetail.jsx';
import { ScriptsImportView } from './ScriptsImport.jsx';
import { scriptPlayBlockReason, activeJobPlayBlockReason, SPLIT_RULES } from './shared.js';
import CSHeader from '@cloudscape-design/components/header';
import CSTable from '@cloudscape-design/components/table';
import CSContainer from '@cloudscape-design/components/container';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSButton from '@cloudscape-design/components/button';
import CSButtonDropdown from '@cloudscape-design/components/button-dropdown';
import CSBox from '@cloudscape-design/components/box';
import CSBadge from '@cloudscape-design/components/badge';
import CSStatusIndicator from '@cloudscape-design/components/status-indicator';
import CSCards from '@cloudscape-design/components/cards';
import CSTextFilter from '@cloudscape-design/components/text-filter';
import CSPagination from '@cloudscape-design/components/pagination';

/* 在线剧本库 — 浏览并导入其他用户公开分享的剧本。
   GET /api/scripts/public · POST /api/scripts/public/{id}/clone */
function ScriptsLibraryView() {
  const { t } = useTranslation();
  const [items, setItems] = useStatePL([]);
  const [loading, setLoading] = useStatePL(true);
  const [q, setQ] = useStatePL("");
  const [cloningId, setCloningId] = useStatePL(null);
  const [importedIds, setImportedIds] = useStatePL({}); // 本会话内已导入的 source id

  const reload = React.useCallback(async (query) => {
    setLoading(true);
    try {
      const r = await window.api.scripts.publicList(query ? { q: query } : undefined);
      setItems(Array.isArray(r?.items) ? r.items : []);
    } catch (e) {
      window.__apiToast?.(t('scripts.public.load_fail'), { kind: "danger", detail: e?.message });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffectPL(() => { reload(""); }, [reload]);

  const onSearch = () => reload(q);

  const onClone = async (s) => {
    setCloningId(s.id);
    try {
      const r = await window.api.scripts.cloneFromPublic(s.id);
      if (r && r.ok === false) throw new Error(r.error || t('scripts.toast.import_fail'));
      window.toast?.(t('scripts.public.clone_ok'), {
        kind: "ok",
        detail: `${s.title} · script #${r?.script_id ?? "?"}`,
        duration: 3000,
      });
      setImportedIds((m) => ({ ...m, [s.id]: true }));
      setItems((arr) => arr.map((x) => x.id === s.id ? { ...x, clone_count: (x.clone_count || 0) + 1 } : x));
      try { window.dispatchEvent(new CustomEvent("rpg-scripts-updated")); } catch (_) {}
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.import_fail'), { kind: "danger", detail: e?.message || String(e) });
    } finally {
      setCloningId(null);
    }
  };

  return (
    <CSSpaceBetween size="l">
      <CSHeader
        variant="h1"
        counter={`(${items.length})`}
        description={t('scripts.public.description')}
        actions={<CSButton iconName="refresh" onClick={() => reload(q)}>{t('common.refresh')}</CSButton>}
      >{t('scripts.public.title')}</CSHeader>

      <CSCards
        items={items}
        loading={loading}
        loadingText={t('scripts.public.loading')}
        trackBy="id"
        cardsPerRow={[{ cards: 1 }, { minWidth: 480, cards: 2 }, { minWidth: 920, cards: 3 }]}
        filter={
          <div style={{ minWidth: 320 }}>
            <CSTextFilter filteringText={q} filteringPlaceholder={t('scripts.public.search_placeholder')}
              onChange={({ detail }) => setQ(detail.filteringText)}
              onDelayedChange={onSearch} />
          </div>
        }
        empty={<CSBox textAlign="center" color="inherit" padding={{ vertical: 'l' }}>
          {loading ? t('common.loading') : (q ? t('scripts.public.empty_search') : t('scripts.public.empty'))}
        </CSBox>}
        cardDefinition={{
          header: (s) => (
            <CSSpaceBetween direction="horizontal" size="xs" alignItems="center">
              <CSBox key="t" variant="h3" padding="n">{s.title}</CSBox>
              {(s.mine || importedIds[s.id]) && <CSBadge key="b" color="green">{s.mine ? t('scripts.public.mine_badge') : t('scripts.public.imported_badge')}</CSBadge>}
            </CSSpaceBetween>
          ),
          sections: [
            { id: 'cover', content: (s) => s.cover_image_url ? (
              <AvatarImg
                src={s.cover_image_url}
                name={s.title}
                size={140}
                shape="rounded"
                aspectRatio="16/9"
                zoomable
              />
            ) : null },
            { id: 'author', content: (s) => (
              <CSBox fontSize="body-s" color="text-body-secondary">{t('scripts.public.shared_by', { author: s.author || s.author_username || t('scripts.public.anon') })}</CSBox>
            ) },
            { id: 'stats', content: (s) => (
              <CSSpaceBetween direction="horizontal" size="xs">
                <CSBadge key="ch">{t('scripts.public.stat_chapters', { n: (s.chapter_count || 0).toLocaleString() })}</CSBadge>
                <CSBadge key="wd">{t('scripts.public.stat_words', { n: ((s.word_count || 0) / 10000).toFixed(0) })}</CSBadge>
                <CSBadge key="cl" color="grey">{t('scripts.public.stat_clones', { n: s.clone_count || 0 })}</CSBadge>
              </CSSpaceBetween>
            ) },
            { id: 'desc', content: (s) => s.description
              ? <CSBox color="text-body-secondary">{s.description}</CSBox> : null },
            { id: 'actions', content: (s) => (
              (s.mine || importedIds[s.id])
                ? <CSButton disabled iconName="check">{s.mine ? t('scripts.public.is_mine') : t('scripts.public.imported_badge')}</CSButton>
                : <CSButton variant="primary" iconName="download"
                    loading={cloningId === s.id} disabled={!!cloningId}
                    onClick={() => onClone(s)}>{t('scripts.public.import_btn')}</CSButton>
            ) },
          ],
        }}
      />
    </CSSpaceBetween>
  );
}

function ScriptsListView() {
  // task 19: 永远以 /api/scripts 真实回包为准；空列表也覆盖 mock，不再混 MOCK_PLATFORM.scripts。
  // task 51：之前 onClick 里用了 `platform?.saves` 但 ScriptsListView 没拿过 platform，
  // 永远是 ReferenceError → 整个按钮 throw 后被 React 静默吞掉 → 用户点了无反应。
  const { t } = useTranslation();
  const { saves: platSaves = [] } = usePlatformData();
  const [scripts, setScripts] = useStatePL([]);
  const [loaded, setLoaded] = useStatePL(false);
  const [busyId, setBusyId] = useStatePL(null);
  // Codex P0-2 修复:没有现成存档时,不再传 fake save {id:null}。
  // 改成弹 NewGameModal,默认填好 script_id,走 saves.create 原子流。
  const [newModalScriptId, setNewModalScriptId] = useStatePL(null);
  // B1: export pack
  const [exportingId, setExportingId] = useStatePL(null);
  // B2: import pack
  const importPackRef = React.useRef(null);
  const [importPackBusy, setImportPackBusy] = useStatePL(false);
  // B3: overrides editor
  const [overridesScript, setOverridesScript] = useStatePL(null);
  // task 51: vector embedding 状态 per script (key: script_id → {running, chunks, cards, worldbook, model})
  const [embedStatus, setEmbedStatus] = useStatePL({});
  // 选中行 + 搜索(对齐存档页:选中 → 下方详情面板)
  const [selectedId, setSelectedId] = useStatePL(null);
  // "状态"列下拉跳转用:点 "去补 worldbook" → 选中剧本 + 详情面板默认到 world tab
  const [pendingTab, setPendingTab] = useStatePL(null);
  const [query, setQuery] = useStatePL("");
  const [scriptPage, setScriptPage] = useStatePL(1);
  const SCRIPT_PAGE_SIZE = 50;

  // 收敛处置②:triggerEmbed(POST /api/scripts/{id}/embed,后端自认废弃 alias)已删——
  // 触发入口收敛到知识库中心(ModuleRebuildPanel → rebuild/embeddings)。这里只保留
  // GET /embed/status 的只读轮询,喂概览 tab 的"向量索引"只读进度子卡。
  // task 51: 自动 poll 所有 running 状态的 script,每 3s 刷一次 progress
  useEffectPL(() => {
    const runningIds = Object.entries(embedStatus).filter(([, v]) => v && v.running).map(([k]) => k);
    if (runningIds.length === 0) return;
    const iv = setInterval(async () => {
      for (const sid of runningIds) {
        try {
          const r = await fetch(`${window.__API_BASE || ""}/api/scripts/${sid}/embed/status`, { credentials: "include" });
          if (!r.ok) continue;
          const j = await r.json();
          if (j.ok && j.status) {
            setEmbedStatus(s => ({ ...s, [sid]: j.status }));
            if (!j.status.running) {
              window.toast?.(t('scripts.toast.embed_done'), {
                kind: "ok",
                detail: `chunks ${j.status.chunks.done} · cards ${j.status.cards.done} · worldbook ${j.status.worldbook.done}`,
                duration: 4000,
              });
            }
          }
        } catch (_) {}
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [embedStatus]);

  const reload = React.useCallback(async () => {
    try {
      const r = await window.api.scripts.list();
      const list = Array.isArray(r) ? r : (r?.items || r?.scripts || []);
      const normed = list.map(window.__normalizeScript || ((x) => x));
      setScripts(normed);
      // task 51: 拉每个剧本的 embed 进度,UI 显示已建索引的剧本(check icon)
      // 失败不影响列表加载(各自 catch)
      Promise.all(normed.map(async (s) => {
        try {
          const sr = await fetch(`${window.__API_BASE || ""}/api/scripts/${s.id}/embed/status`, { credentials: "include" });
          const sj = await sr.json();
          if (sj.ok && sj.status) {
            setEmbedStatus(es => ({ ...es, [s.id]: sj.status }));
          }
        } catch (_) {}
      })).catch(() => {});
    } catch (_) {
      setScripts([]);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffectPL(() => {
    reload();
    const refresh = () => reload();
    // 兼容老事件名 + task 17 新事件名
    window.addEventListener("rpg:scripts:changed", refresh);
    window.addEventListener("rpg-scripts-updated", refresh);
    return () => {
      window.removeEventListener("rpg:scripts:changed", refresh);
      window.removeEventListener("rpg-scripts-updated", refresh);
    };
  }, [reload]);

  const onDelete = async (s) => {
    if (!await window.__confirm({ title: t('scripts.confirm.delete_title'), message: t('scripts.confirm.delete_msg', { title: s.title }), danger: true, confirmText: t('common.delete') })) return;
    setBusyId(s.id);
    try {
      const result = await window.api.scripts.delete(s.id, { force: true });
      if (!result || result.ok !== true || result.deleted !== true) {
        throw new Error(result?.error || result?.detail || t('scripts.toast.delete_fail'));
      }
      window.__apiToast?.(t('scripts.toast.deleted'), { kind: "ok" });
      reload();
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.delete_fail'), { kind: "danger", detail: e?.message });
    } finally {
      setBusyId(null);
    }
  };

  const onUnsubscribe = async (s) => {
    if (!await window.__confirm({ title: t('scripts.confirm.unsubscribe_title'), message: t('scripts.confirm.unsubscribe_msg', { title: s.title }), danger: false, confirmText: t('scripts.confirm.unsubscribe_btn') })) return;
    setBusyId(s.id);
    try {
      const result = await window.api.scripts.unsubscribe(s.id);
      if (!result || result.ok !== true) {
        throw new Error(result?.error || result?.detail || t('scripts.toast.unsubscribe_fail'));
      }
      window.__apiToast?.(t('scripts.toast.unsubscribed'), { kind: "ok" });
      reload();
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.unsubscribe_fail'), { kind: "danger", detail: e?.message });
    } finally {
      setBusyId(null);
    }
  };

  const onImportPackFile = async (file) => {
    if (!file) return;
    setImportPackBusy(true);
    try {
      const result = await window.api.scripts.importPack(file);
      if (result && result.ok === false) throw new Error(result.error || result.detail || t('scripts.toast.import_fail'));
      const sid = result?.script_id;
      const warnings = result?.warnings;
      window.__apiToast?.(
        t('scripts.toast.pack_import_ok'),
        { kind: "ok", detail: warnings?.length ? t('scripts.toast.pack_warnings', { msg: warnings.join("; ") }) : (sid ? `script #${sid}` : "") }
      );
      reload();
    } catch (e) {
      const detail = e?.payload?.detail || e?.message || t('scripts.toast.unknown_error');
      window.__apiToast?.(t('scripts.toast.import_fail'), { kind: "danger", detail });
    } finally {
      setImportPackBusy(false);
      if (importPackRef.current) importPackRef.current.value = "";
    }
  };

  const onExportPack = async (s) => {
    setExportingId(s.id);
    try {
      const filename = (s.title || "script").replace(/[\\/:*?"<>|]/g, "_") + "_pack.zip";
      await window.api.scripts.exportPack(s.id, filename);
      window.__apiToast?.(t('scripts.toast.export_ok'), { kind: "ok", detail: filename });
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.export_fail'), { kind: "danger", detail: e?.message });
    } finally {
      setExportingId(null);
    }
  };

  // task 52：之前 onPreview 只 alert 第一章前 400 字，章节多了无法浏览/编辑。
  // 改成开 ChaptersModal —— 真正展示章节列表 + 内容预览 + 重命名 + 重切分。
  const [chaptersOpen, setChaptersOpen] = useStatePL(null); // script row
  const [reviewScript, setReviewScript] = useStatePL(null); // Phase E.1: KB 复核 modal
  const [importOpen, setImportOpen] = useStatePL(false); // 导入剧本全页覆盖(替代侧栏 #scripts-import)

  // 每行操作下拉项(收敛处置①:去 action_review/embed——复核入口唯一化到详情面板顶部按钮,
  // 嵌入收敛到知识库中心;列表下拉只保留列表级动作)
  const rowActions = (s) => {
    return [
      { id: 'chapters', text: t('scripts.my.action_chapters'), iconName: 'file' },
      { id: 'overrides', text: t('scripts.my.action_overrides'), iconName: 'edit' },
      { id: 'visibility', text: s.is_public ? t('scripts.my.action_unpublish') : t('scripts.my.action_publish'), iconName: s.is_public ? 'lock-private' : 'share' },
      { id: 'export', text: t('scripts.my.action_export'), iconName: 'download', disabled: exportingId === s.id },
      s.is_subscribed
        ? { id: 'unsubscribe', text: t('scripts.my.action_unsubscribe'), iconName: 'remove', disabled: busyId === s.id }
        : { id: 'delete', text: t('scripts.my.action_delete'), iconName: 'remove', disabled: busyId === s.id },
    ];
  };
  const onRowAction = (s, id) => {
    if (id === 'chapters') setChaptersOpen(s);
    else if (id === 'overrides') setOverridesScript(s);
    else if (id === 'export') onExportPack(s);
    else if (id === 'visibility') onToggleVisibility(s);
    else if (id === 'delete') onDelete(s);
    else if (id === 'unsubscribe') onUnsubscribe(s);
  };
  const onToggleVisibility = async (s) => {
    const next = !s.is_public;
    if (next) {
      // 发布到公开库前的设定核对闸:未核对直接引导去「设定核对」,不发请求。
      if ((s.review_status || 'unreviewed') !== 'reviewed') {
        window.__apiToast?.(t('scripts.page.publish_review_required'), { kind: 'warn', detail: t('scripts.page.publish_review_required_detail'), duration: 5500 });
        setReviewScript(s);
        return;
      }
      if (!await window.__confirm({ title: t('scripts.confirm.publish_title'), message: t('scripts.confirm.publish_msg', { title: s.title }), confirmText: t('scripts.confirm.publish_btn') })) return;
    }
    try {
      const r = await window.api.scripts.setVisibility(s.id, next);
      if (r && r.ok === false) throw new Error(r.message || r.error || t('scripts.toast.op_fail'));
      window.__apiToast?.(next ? t('scripts.toast.published') : t('scripts.toast.unpublished'), { kind: 'ok', duration: 2000 });
      setScripts((arr) => arr.map((x) => x.id === s.id ? { ...x, is_public: next } : x));
    } catch (e) {
      // 后端核对闸兜底(前端 review_status 陈旧时返回 409 REVIEW_REQUIRED)
      if (e?.payload?.error === 'REVIEW_REQUIRED') {
        window.__apiToast?.(t('scripts.page.publish_review_required'), { kind: 'warn', detail: e?.payload?.message || t('scripts.page.publish_review_required_fallback'), duration: 5500 });
        setReviewScript(s);
        return;
      }
      window.__apiToast?.(t('scripts.toast.op_fail'), { kind: 'danger', detail: e?.message });
    }
  };
  // 反馈#3:开始游戏不再「有存档就直接进后台」,改成下拉让用户选——继续某个存档 / 开新游戏。
  const onContinueSave = (sv) => { if (sv) window.__openContinue?.(sv); };
  const onNewGame = async (s) => {
    const localBlock = scriptPlayBlockReason(s, t);
    if (localBlock) {
      window.__apiToast?.(t('scripts.my.play_block_title'), { kind: 'warn', detail: localBlock, duration: 6500 });
      return;
    }
    setBusyId(s.id);
    try {
      const active = await window.api.scripts.activeJob(s.id).catch(() => null);
      const liveBlock = activeJobPlayBlockReason(active, t);
      if (liveBlock) {
        window.__apiToast?.(t('scripts.my.play_block_title'), { kind: 'warn', detail: liveBlock, duration: 6500 });
        await reload();
        return;
      }
      setNewModalScriptId(s.id);
    } finally {
      setBusyId(null);
    }
  };
  // 兼容:列表行等单按钮入口仍走「有存档继续最近,无则开新」的一键默认
  const onPlay = async (s) => {
    const sv = platSaves.find(x => x.script_id === s.id);
    if (sv) { onContinueSave(sv); return; }
    await onNewGame(s);
  };

  const visibleScripts = query
    ? scripts.filter((s) => (`${s.title} ${s.uid}`).toLowerCase().includes(query.toLowerCase()))
    : scripts;

  // 分页切片(每页 50 条)
  const scriptPageCount = Math.max(1, Math.ceil(visibleScripts.length / SCRIPT_PAGE_SIZE));
  const pagedScripts = visibleScripts.slice((scriptPage - 1) * SCRIPT_PAGE_SIZE, scriptPage * SCRIPT_PAGE_SIZE);
  // 查询变化时重置到第 1 页
  React.useEffect(() => { setScriptPage(1); }, [query]);

  const selected = scripts.find((x) => x.id === selectedId) || null;

  // [内部] 前缀 = 开发中占位剧本,显示"敬请期待"而非常规详情
  const isInternalPlaceholder = (s) => s && typeof s.title === 'string' && s.title.startsWith('[内部]');

  const detailEl = selected ? (
    isInternalPlaceholder(selected) ? (
      <CSContainer header={<CSHeader variant="h2">{selected.title}</CSHeader>}>
        <div style={{ padding: '36px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.7 }}>🚧</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t('scripts.page.placeholder_coming_soon')}</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 480, margin: '0 auto 8px' }}>
            {t('scripts.page.placeholder_dnd_desc')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 16 }}>{t('scripts.page.placeholder_eta')}</div>
        </div>
      </CSContainer>
    ) : (
      <ScriptDetailPanel
        script={selected}
        savesCount={platSaves.filter((x) => x.script_id === selected.id).length}
        scriptSaves={platSaves.filter((x) => x.script_id === selected.id)}
        embedStatus={embedStatus}
        currentUserId={window.RPG_AUTH?.user_id ?? null}
        pendingTab={pendingTab}
        onPendingTabConsumed={() => setPendingTab(null)}
        onPlay={onPlay}
        onContinueSave={onContinueSave}
        onNewGame={onNewGame}
        onChapters={setChaptersOpen}
        onReview={setReviewScript}
        onExtractDone={reload}
        onExport={onExportPack}
        onToggleVisibility={onToggleVisibility}
        onDelete={onDelete}
        onUnsubscribe={onUnsubscribe}
        onEditOverrides={setOverridesScript}
        onReload={(newId) => { reload(); if (newId) setSelectedId(newId); }}
      />
    )
  ) : null;

  const tableEl = (
    <CSTable
      variant="container"
      trackBy="id"
      selectionType="single"
      loadingText={t('scripts.my.loading')}
      loading={!loaded}
      items={pagedScripts}
      selectedItems={selected ? [selected] : []}
      onSelectionChange={({ detail }) => { const x = detail.selectedItems[0]; if (x) setSelectedId(x.id); }}
      onRowClick={({ detail }) => setSelectedId(detail.item.id)}
      empty={<CSBox textAlign="center" color="inherit" padding={{ vertical: 'l' }}>{query ? t('scripts.my.empty_search') : t('scripts.my.empty')}</CSBox>}
      pagination={
        scriptPageCount > 1
          ? <CSPagination currentPageIndex={scriptPage} pagesCount={scriptPageCount} onChange={({ detail }) => setScriptPage(detail.currentPageIndex)} />
          : undefined
      }
      columnDefinitions={[
        { id: 'title', header: t('scripts.my.col_script'), cell: (s) => (
          isInternalPlaceholder(s) ? (
            <div style={{ opacity: 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CSBox fontWeight="bold" color="text-status-inactive">{s.title}</CSBox>
                <CSBadge color="grey">{t('scripts.page.placeholder_coming_soon')}</CSBadge>
              </div>
              <CSBox fontSize="body-s" color="text-status-inactive">{s.uid} · {t('scripts.page.placeholder_unavailable')}</CSBox>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <CSBox fontWeight="bold">{s.title}</CSBox>
                {s.sharing_mode === 'floating-latest' && <CSBadge color="blue">{t('scripts.share.badge_floating')}</CSBadge>}
                {s.sharing_mode === 'pinned-snapshot' && <CSBadge color="grey">{t('scripts.share.badge_pinned', { id: (s.current_pin_commit_id || '').slice(0, 7) })}</CSBadge>}
                {s.sharing_mode === 'public' && <CSBadge color="green">{t('scripts.share.badge_public')}</CSBadge>}
                {s.forked_from_script_id && <CSBadge color="severity-neutral">fork</CSBadge>}
              </div>
              <CSBox fontSize="body-s" color="text-body-secondary">{s.uid} · {t('scripts.my.updated')} {s.updated_at}</CSBox>
            </div>
          )
        ) },
        { id: 'chapters', header: t('scripts.my.chapters'), cell: (s) => isInternalPlaceholder(s) ? <CSBox color="text-status-inactive">—</CSBox> : (s.chapter_count || 0).toLocaleString() },
        { id: 'words', header: t('scripts.my.words'), cell: (s) => isInternalPlaceholder(s) ? <CSBox color="text-status-inactive">—</CSBox> : `${((s.word_count || 0) / 10000).toFixed(1)} ${t('scripts.my.wan')}` },
        { id: 'mode', header: t('scripts.my.split_mode'), cell: (s) => isInternalPlaceholder(s) ? <CSBox color="text-status-inactive">—</CSBox> : (s.import_report?.mode_label || '—') },
        { id: 'problem', header: t('scripts.my.problem'), cell: (s) => {
          if (isInternalPlaceholder(s)) return <CSStatusIndicator type="pending">{t('scripts.page.placeholder_in_dev')}</CSStatusIndicator>;
          const r = s.readiness || null;
          // phase_rebuild_panel: 没 readiness 字段就不撒谎"就绪",改返 unknown 占位 — 别让破壳数据冒充 ready
          if (!r) {
            if (s.import_report?.problem_label && s.import_report.problem_label !== t('scripts.my.no_problem')) {
              return <CSStatusIndicator type="warning">{s.import_report.problem_label}</CSStatusIndicator>;
            }
            return <CSBox color="text-status-inactive">—</CSBox>;
          }
          if (r.ok) return <CSStatusIndicator type="success">{t('scripts.my.readiness_ready')}</CSStatusIndicator>;
          // 缺项 → ButtonDropdown,每条 = 一个缺失维度,点击 = 选中剧本 + 跳对应 tab
          // key 到 detail panel tab id 的映射:chunks→overview, embeddings→extract,
          // canon→canon-editor (P0 #2: 拆 NPC 与知识库人物), worldbook→world, anchors→timeline
          const tabFor = { chunks: 'overview', embeddings: 'overview', canon: 'canon-editor', worldbook: 'world', anchors: 'timeline' };
          const items = (r.items || []).filter(it => !it.ok).map(it => ({
            id: it.key,
            text: t(`scripts.my.readiness_jump_${it.key}`),
            description: it.total > 0
              ? `${t(`scripts.my.readiness_label_${it.key}`)} ${it.count}/${it.total}`
              : t(`scripts.my.readiness_label_${it.key}`),
          }));
          return (
            <CSButtonDropdown
              variant="inline-icon"
              expandToViewport
              items={items}
              onItemClick={({ detail }) => {
                setSelectedId(s.id);
                const tab = tabFor[detail.id];
                if (tab) setPendingTab(tab);
              }}
              ariaLabel={t('scripts.my.problem')}
            >
              <CSStatusIndicator type="warning">
                {t('scripts.my.readiness_missing', { n: (r.missing || []).length })}
              </CSStatusIndicator>
            </CSButtonDropdown>
          );
        } },
        { id: 'saves', header: t('scripts.my.saves'), cell: (s) => {
          if (isInternalPlaceholder(s)) return <CSBox color="text-status-inactive">—</CSBox>;
          const n = platSaves.filter((x) => x.script_id === s.id).length;
          return n > 0 ? <CSBadge color="green">{t('scripts.my.saves_count', { n })}</CSBadge> : <CSBox color="text-status-inactive">—</CSBox>;
        } },
        { id: 'public', header: t('scripts.my.share'), cell: (s) => s.is_public ? <CSStatusIndicator type="success">{t('scripts.my.is_public')}</CSStatusIndicator> : <CSBox color="text-status-inactive">—</CSBox> },
        { id: 'go', header: '', cell: (s) => {
          if (isInternalPlaceholder(s)) return <CSButton variant="inline-link" iconName="status-pending" disabled>{t('scripts.my.play')}</CSButton>;
          const block = scriptPlayBlockReason(s, t);
          // 反馈#3:列表「开始」也改下拉——选存档继续 / 开新游戏,不再一键直进后台
          const svs = platSaves.filter((x) => x.script_id === s.id);
          return (
            <CSButtonDropdown variant="normal" expandToViewport disabled={busyId === s.id || !!block}
              items={[
                ...(svs.length ? [{
                  text: t('scripts.my.play_continue_group'),
                  items: svs.map((sv) => ({ id: 'continue:' + sv.id, text: sv.title || ('#' + sv.id), iconName: 'caret-right-filled' })),
                }] : []),
                { id: 'new', text: t('scripts.my.play_new_game'), iconName: 'add-plus' },
              ]}
              onItemClick={({ detail }) => {
                if (detail.id === 'new') { onNewGame(s); return; }
                if (typeof detail.id === 'string' && detail.id.startsWith('continue:')) {
                  const sv = svs.find((x) => String(x.id) === detail.id.slice('continue:'.length));
                  if (sv) onContinueSave(sv);
                }
              }}
            >{block ? t('scripts.my.play_blocked') : t('scripts.my.play')}</CSButtonDropdown>
          );
        } },
      ]}
    />
  );

  return (
    <CSSpaceBetween size="l">
      {/* hidden file input lives outside SpaceBetween so it doesn't create a 27px slot-div */}
      <input ref={importPackRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={(e) => onImportPackFile(e.target.files?.[0])} />
      <CSHeader
        variant="h1"
        counter={`(${scripts.length})`}
        description={t('scripts.my.description')}
        actions={
          <CSSpaceBetween direction="horizontal" size="xs">
            <CSButton iconName="download" loading={importPackBusy} onClick={() => importPackRef.current?.click()}>{t('scripts.my.import_pack')}</CSButton>
            <CSButton variant="primary" iconName="upload" onClick={() => setImportOpen(true)}>{t('scripts.my.import_script')}</CSButton>
          </CSSpaceBetween>
        }
      >{t('scripts.my.title')}</CSHeader>

      <div style={{ maxWidth: 360 }}>
        <CSTextFilter filteringText={query} filteringPlaceholder={t('scripts.my.search_placeholder')}
          onChange={({ detail }) => setQuery(detail.filteringText)} />
      </div>

      {selected
        ? <ResizableSplit storageKey="scripts" top={tableEl} bottom={detailEl} />
        : tableEl}

      <ChaptersModal script={chaptersOpen} onClose={() => setChaptersOpen(null)} onChanged={reload} />
      {importOpen && (
        <div style={{ position: 'fixed', top: 53, left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'var(--bg, #1a1817)', overflow: 'auto' }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 3, background: '#131211', borderBottom: '1px solid #36322d' }}>
            <div style={{ maxWidth: 1240, margin: '0 auto', padding: '13px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 18, fontWeight: 600, color: '#ebe7df' }}>{t('scripts.my.import_script')}</div>
              <CSButton iconName="close" variant="link" onClick={() => { setImportOpen(false); reload(); }}>{t('common.close')}</CSButton>
            </div>
          </div>
          <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 24px 80px' }}>
            <ScriptsImportView embedded onClose={() => { setImportOpen(false); reload(); }} />
          </div>
        </div>
      )}
      <OverridesModal script={overridesScript} onClose={() => setOverridesScript(null)} />
      {reviewScript && (
        <Modal
          open
          eyebrow={t('scripts.review.eyebrow')}
          title={reviewScript.title || t('scripts.review.script_id', { id: reviewScript.id })}
          width={900}
          panelStyle={{ maxHeight: "85vh", overflow: "auto" }}
          onClose={() => setReviewScript(null)}
        >
            <ScriptReview
              scriptId={reviewScript.id}
              initialStatus={reviewScript.review_status}
              onReviewedChange={(sid, rs) => {
                // 复核状态变更 → 同步剧本列表 + 当前 reviewScript,卡片/发布闸读到的是最新值
                setScripts((arr) => arr.map((x) => x.id === sid ? { ...x, review_status: rs } : x));
                setReviewScript((cur) => cur && cur.id === sid ? { ...cur, review_status: rs } : cur);
              }}
            />
        </Modal>
      )}
      {/* Codex P0-2 修复:基于此剧本"新建存档"流。无现成 save 时弹这个 modal,
          走 window.__createAndEnterSave 原子流 (POST /api/saves → activate → 跳页),
          不再走 ContinuePicker 假 save 跳过建档的旧路径。 */}
      <NewGameModal
        open={!!newModalScriptId}
        onClose={() => setNewModalScriptId(null)}
        defaultScriptId={newModalScriptId}
        onConfirm={async (payload) => {
          await window.__createAndEnterSave({
            ...payload,
            script_id: payload.script_id || newModalScriptId,
          });
        }}
      />
    </CSSpaceBetween>
  );
}

/* B3: overrides editor — GET/POST /api/v1/scripts/{id}/overrides (JSONB)。
   显示当前 script_overrides 的 raw JSON，支持 edit/save。 */
function OverridesModal({ script, onClose }) {
  const { t } = useTranslation();
  const [raw, setRaw] = useStatePL("");
  const [loading, setLoading] = useStatePL(false);
  const [saving, setSaving] = useStatePL(false);
  const [err, setErr] = useStatePL("");
  const [dirty, setDirty] = useStatePL(false);

  React.useEffect(() => {
    if (!script) return;
    setLoading(true); setErr(""); setRaw(""); setDirty(false);
    (async () => {
      try {
        const r = await window.api.scripts.getOverrides(script.id);
        const data = r?.data ?? r ?? {};
        setRaw(JSON.stringify(data, null, 2));
      } catch (e) {
        setErr(e?.message || t('scripts.editor.load_fail'));
        setRaw("{}");
      } finally {
        setLoading(false);
      }
    })();
  }, [script?.id]);

  if (!script) return null;

  const onSave = async () => {
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) {
      window.__apiToast?.(t('scripts.editor.json_error'), { kind: "danger", detail: e.message });
      return;
    }
    setSaving(true);
    try {
      await window.api.scripts.saveOverrides(script.id, parsed);
      window.__apiToast?.(t('scripts.toast.saved'), { kind: "ok" });
      setDirty(false);
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.save_fail'), { kind: "danger", detail: e?.message });
    } finally {
      setSaving(false);
    }
  };

  let jsonValid = true;
  try { JSON.parse(raw); } catch (_) { jsonValid = false; }

  return (
    // 收口到共享 <Modal>(产同构 DOM,零视觉变化):panelStyle 保 width/maxHeight/flex,
    // footerStyle 保原 marginTop:12,eyebrow/title/close 与原手写一致。
    <Modal
      open
      onClose={onClose}
      eyebrow={<>{t('scripts.editor.overrides_eyebrow')} · {script.title}</>}
      title={loading ? t('common.loading') : "script_overrides JSONB"}
      panelStyle={{ width: "min(700px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      footerStyle={{ marginTop: 12 }}
      footer={(
        <>
          <span className="muted-2" style={{fontSize: 11.5}}>
            GET/POST /api/v1/scripts/{script.id}/overrides
          </span>
          <div style={{display: "flex", gap: 8}}>
            <button className="btn ghost" onClick={onClose}>{t('common.close')}</button>
            <button className="btn primary" onClick={onSave} disabled={saving || !dirty || !jsonValid}>
              {saving ? <><Icon name="spinner" size={12} className="spin" /> {t('scripts.editor.saving')}</> : <><Icon name="check" size={12} /> {t('common.save')}</>}
            </button>
          </div>
        </>
      )}
    >
      {err && <div style={{padding: "8px 16px", color: "var(--danger)", fontSize: 13}}>{err}</div>}
      {!loading && (
        <div style={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 16px 0"}}>
          <div style={{fontSize: 11.5, color: "var(--muted-2)", marginBottom: 6, paddingTop: 12}}>
            {t('scripts.editor.overrides_hint')}
            {!jsonValid && <span style={{color: "var(--danger)", marginLeft: 8}}>{t('scripts.editor.json_invalid')}</span>}
          </div>
          <textarea
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setDirty(true); }}
            spellCheck={false}
            style={{
              flex: 1, minHeight: 320, fontFamily: "var(--font-mono, monospace)", fontSize: 12.5,
              lineHeight: 1.55, resize: "vertical", background: "var(--surface-2)",
              border: "1px solid " + (jsonValid ? "var(--line-soft)" : "var(--danger)"),
              borderRadius: "var(--r-2)", padding: "10px 12px", color: "var(--text)",
              outline: "none",
            }}
          />
        </div>
      )}
    </Modal>
  );
}

/* task 52：之前剧本只有"alert 章节前 400 字"假预览。补一个真章节浏览/编辑器：
   - GET /api/scripts/{id}/chapters 分页列出
   - GET /api/scripts/{id}/chapter-facts 拿事实摘要（如果有）
   - POST /api/scripts/{id}/chapters/{idx} 重命名 / 改正文
   - POST /api/scripts/{id}/chapters/merge 合并相邻章节
   - POST /api/scripts/{id}/chapters/{idx}/split 拆分单章
   - POST /api/scripts/{id}/resplit 整本重切（rule+pattern）
   全部 BE wrappers 已存，但 FE 之前无入口。 */
function ChaptersModal({ script, onClose, onChanged }) {
  const { t } = useTranslation();
  const [chapters, setChapters] = useStatePL([]);
  const [loading, setLoading] = useStatePL(false);
  const [err, setErr] = useStatePL("");
  const [activeIdx, setActiveIdx] = useStatePL(0);
  const [edit, setEdit] = useStatePL(null); // {idx, title, content}
  const [resplitOpen, setResplitOpen] = useStatePL(false);
  const [reloadTick, setReloadTick] = useStatePL(0);
  // 当前选中章节的完整正文(lazy fetch — 列表 API 只回 180 字符 preview)
  const [activeContent, setActiveContent] = useStatePL("");
  const [activeLoading, setActiveLoading] = useStatePL(false);
  React.useEffect(() => {
    if (!script) return;
    setLoading(true); setErr(""); setActiveIdx(0);
    (async () => {
      try {
        // 一次拉完整本(后端 limit 上限已放到 5000)
        const r = await window.api.scripts.chapters(script.id, { limit: 5000 });
        const list = (r && (r.chapters || r.items)) || [];
        setChapters(list);
      } catch (e) { setErr(e?.message || t('scripts.editor.fetch_fail')); }
      finally { setLoading(false); }
    })();
  }, [script?.id, reloadTick]);
  // 选中章节变化时,lazy fetch 真正文(不预拉全文,避免一次性 12MB 响应)
  React.useEffect(() => {
    if (!script || chapters.length === 0) { setActiveContent(""); return; }
    const cur = chapters[activeIdx];
    if (!cur) { setActiveContent(""); return; }
    // 后端返字段是 chapter_index,不是 index
    const chIdx = cur.chapter_index ?? cur.index ?? activeIdx;
    setActiveLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const r = await window.api.scripts.chapterDetail(script.id, chIdx);
        if (cancelled) return;
        setActiveContent((r && r.chapter && r.chapter.content) || "");
      } catch (_) {
        if (!cancelled) setActiveContent(cur.content_preview || "");
      } finally { if (!cancelled) setActiveLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [script?.id, activeIdx, chapters]);
  if (!script) return null;
  const cur = chapters[activeIdx];
  const curIdx = cur ? (cur.chapter_index ?? cur.index ?? activeIdx) : activeIdx;
  const onRename = async () => {
    if (!cur) return;
    const newTitle = await window.__prompt({ title: t('scripts.editor.rename_title'), label: t('scripts.editor.rename_label'), default: cur.title || '' });
    if (!newTitle || newTitle === cur.title) return;
    try {
      await window.api.scripts.updateChapter(script.id, curIdx, { title: newTitle });
      window.__apiToast?.(t('scripts.toast.renamed'), { kind: "ok" });
      setReloadTick(x => x + 1);
      onChanged && onChanged();
    } catch (e) { window.__apiToast?.(t('scripts.toast.op_fail'), { kind: "danger", detail: e?.message }); }
  };
  const onMergeNext = async () => {
    if (!cur || activeIdx >= chapters.length - 1) return;
    if (!await window.__confirm({ title: t('scripts.editor.merge_title'), message: t('scripts.editor.merge_msg', { a: activeIdx + 1, b: activeIdx + 2 }), confirmText: t('scripts.editor.merge_btn') })) return;
    try {
      const nextCh = chapters[activeIdx + 1];
      const nextIdx = nextCh ? (nextCh.chapter_index ?? nextCh.index ?? (activeIdx + 1)) : (activeIdx + 1);
      await window.api.scripts.mergeChapter(script.id, { first_index: curIdx, second_index: nextIdx });
      window.__apiToast?.(t('scripts.toast.merged'), { kind: "ok" });
      setReloadTick(x => x + 1);
      onChanged && onChanged();
    } catch (e) { window.__apiToast?.(t('scripts.toast.op_fail'), { kind: "danger", detail: e?.message }); }
  };
  // 合并上一章:把前面那章折进【当前章】,保留当前章标题(用户反馈:序章/前言没办法合并到第一章)。
  const onMergePrev = async () => {
    if (!cur || activeIdx <= 0) return;
    if (!await window.__confirm({ title: t('scripts.editor.merge_title'), message: t('scripts.editor.merge_prev_msg', { a: activeIdx, b: activeIdx + 1, defaultValue: `把第 ${activeIdx} 章合并进当前的第 ${activeIdx + 1} 章(保留当前章标题)?` }), confirmText: t('scripts.editor.merge_btn') })) return;
    try {
      const prevCh = chapters[activeIdx - 1];
      const prevIdx = prevCh ? (prevCh.chapter_index ?? prevCh.index ?? (activeIdx - 1)) : (activeIdx - 1);
      await window.api.scripts.mergeChapter(script.id, { first_index: prevIdx, second_index: curIdx, keep_title_index: curIdx });
      window.__apiToast?.(t('scripts.toast.merged'), { kind: "ok" });
      setReloadTick(x => x + 1);
      onChanged && onChanged();
    } catch (e) { window.__apiToast?.(t('scripts.toast.op_fail'), { kind: "danger", detail: e?.message }); }
  };
  const onSplit = async () => {
    if (!cur) return;
    const pos = await window.__prompt({ title: t('scripts.editor.split_title'), label: t('scripts.editor.split_label'), default: '' });
    const n = parseInt(pos, 10);
    if (!n || n < 1) return;
    try {
      await window.api.scripts.splitChapter(script.id, curIdx, { split_at: n });
      window.__apiToast?.(t('scripts.toast.split'), { kind: "ok" });
      setReloadTick(x => x + 1);
      onChanged && onChanged();
    } catch (e) { window.__apiToast?.(t('scripts.toast.op_fail'), { kind: "danger", detail: e?.message }); }
  };
  const onResplit = async (vals) => {
    try {
      await window.api.scripts.resplit(script.id, { split_rule: vals.rule || "auto", custom_pattern: vals.pattern || "" });
      window.__apiToast?.(t('scripts.toast.resplit'), { kind: "ok" });
      setResplitOpen(false);
      setReloadTick(x => x + 1);
      onChanged && onChanged();
    } catch (e) { window.__apiToast?.(t('scripts.toast.resplit_fail'), { kind: "danger", detail: e?.message }); }
  };
  return (
   <>
    {/* 收口到共享 <Modal>(产同构 DOM,零视觉变化):头部有额外「重切」按钮 → 用 header 自定义整头 +
        showClose=false 复刻原「标题区 | 重切+关闭」布局;panelStyle 保 width/maxHeight/flex。
        原本嵌在 backdrop 内的 resplit PromptModal 改成 <Modal> 的兄弟节点(自身独立浮层,视觉/行为不变)。 */}
    <Modal
      open
      onClose={onClose}
      showClose={false}
      panelStyle={{ width: "min(960px, 96vw)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      header={(
        <>
          <div>
            <div className="pl-modal-eyebrow">{t('scripts.editor.chapters_eyebrow')} · {script.title}</div>
            <h2 className="pl-modal-title">{loading ? t('common.loading') : t('scripts.editor.chapters_title', { total: chapters.length, cur: activeIdx + 1 })}</h2>
          </div>
          <div style={{display: "flex", gap: 6}}>
            <button className="btn ghost" onClick={() => setResplitOpen(true)} title={t('scripts.editor.resplit_tip')}><Icon name="refresh" size={12} /> {t('scripts.editor.resplit_btn')}</button>
            <button className="iconbtn" onClick={onClose} data-tip={t('common.close')}><Icon name="close" size={14} /></button>
          </div>
        </>
      )}
      footer={(
        <>
          <span className="muted-2" style={{fontSize: 11.5}}>
            <Icon name="info" size={11} /> GET /api/scripts/{script.id}/chapters · POST /chapters/{`{idx}`} / merge / split / resplit
          </span>
          <button className="btn ghost" onClick={onClose}>{t('common.close')}</button>
        </>
      )}
    >
        {err && <div className="pl-model-empty" style={{padding: "16px"}}><span className="danger">{t('scripts.editor.load_fail_detail', { err })}</span></div>}
        {!err && chapters.length === 0 && !loading && (
          <div className="pl-model-empty" style={{padding: "24px"}}>{t('scripts.editor.chapters_empty')}</div>
        )}
        {chapters.length > 0 && (
          <div style={{display: "grid", gridTemplateColumns: "220px 1fr", gap: 0, flex: 1, minHeight: 0}}>
            <div style={{borderRight: "1px solid var(--line-soft)", overflow: "auto", maxHeight: 480}}>
              {chapters.map((c, i) => (
                <button key={c.chapter_index ?? c.index ?? i}
                  className="btn ghost"
                  style={{display: "flex", justifyContent: "flex-start", width: "100%", padding: "8px 12px", borderRadius: 0,
                    background: i === activeIdx ? "var(--accent-soft)" : "transparent",
                    fontWeight: i === activeIdx ? 600 : 400,
                    borderBottom: "1px solid var(--line-soft)"}}
                  onClick={() => setActiveIdx(i)}>
                  <span className="muted-2 mono" style={{minWidth: 36, fontSize: 11}}>#{String(i + 1).padStart(3, "0")}</span>
                  <span style={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left", fontSize: 12.5}}>
                    {c.title || t('scripts.editor.unnamed_chapter')}
                  </span>
                </button>
              ))}
            </div>
            <div style={{overflow: "auto", padding: 16, maxHeight: 480}}>
              {cur && <>
                <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 12}}>
                  <strong style={{fontSize: 15}}>{cur.title || t('scripts.editor.unnamed_chapter')}</strong>
                  {/* 字数读 word_count 列(后端 import 时已计算),不要算 content.length —
                      列表 API 只回 180 字符 preview,算出来全是 0 字 */}
                  <span className="muted-2 mono" style={{fontSize: 11}}>
                    {(cur.word_count || 0).toLocaleString()} {t('scripts.my.char_unit')}
                  </span>
                  <div style={{marginLeft: "auto", display: "flex", gap: 6}}>
                    <button className="btn ghost" onClick={onRename}><Icon name="edit" size={12} /> {t('scripts.editor.rename_btn')}</button>
                    <button className="btn ghost" onClick={onSplit}><Icon name="branch" size={12} /> {t('scripts.editor.split_chapter_btn')}</button>
                    {activeIdx > 0 && (
                      <button className="btn ghost" onClick={onMergePrev}><Icon name="link" size={12} /> {t('scripts.editor.merge_prev_btn', { defaultValue: '合并上一章' })}</button>
                    )}
                    {activeIdx < chapters.length - 1 && (
                      <button className="btn ghost" onClick={onMergeNext}><Icon name="link" size={12} /> {t('scripts.editor.merge_next_btn')}</button>
                    )}
                  </div>
                </div>
                {/* 正文 lazy 加载;先放 preview,等 chapterDetail 回来再换全文 */}
                <pre style={{whiteSpace: "pre-wrap", fontFamily: "var(--font-serif)", fontSize: 13.5, lineHeight: 1.7, margin: 0}}>
                  {activeLoading
                    ? (cur.content_preview || "") + "\n\n" + t('common.loading')
                    : (activeContent || cur.content_preview || "").slice(0, 8000)
                       + ((activeContent && activeContent.length > 8000) ? t('scripts.editor.content_truncated') : "")}
                </pre>
              </>}
            </div>
          </div>
        )}
    </Modal>
      <PromptModal
        open={resplitOpen}
        eyebrow={t('scripts.editor.resplit_btn')}
        title={`${script.title} · ${t('scripts.editor.resplit_prompt_title')}`}
        hint="POST /api/scripts/{id}/resplit"
        fields={[
          // 复用与「导入」完全一致的规则列表(= 后端 chapter_splitter.RULE_PATTERNS 的真实键)。
          // 旧版这里硬编码了 blank/marker/regex,后端没有这些规则 → 静默退化成 auto、且 regex
          // 不等于 custom 导致自定义正则被忽略(用户反馈:整本重切识别不出第X章,导入却能)。
          { key: "rule", label: t('scripts.import.field_rule'), type: "select", default: "auto",
            options: SPLIT_RULES.map(r => ({ value: r.id, label: t(r.labelKey) })) },
          { key: "pattern", label: t('scripts.import.field_custom_regex'), placeholder: t('scripts.import.field_custom_regex_placeholder') },
        ]}
        submitLabel={t('scripts.editor.resplit_submit')}
        onClose={() => setResplitOpen(false)}
        onConfirm={onResplit}
      />
   </>
  );
}

export { ScriptsListView, ScriptsLibraryView, ChaptersModal, OverridesModal };
