/* MobileTavern — 移动原生 UI 的酒馆模式。
 *
 * 铁律:
 *  - 不复用任何桌面端 UI 组件(TavernSidebar/TavernHeader/TavernChatArea/TwoCardDrawer/ChatItem 等)。
 *  - 数据/逻辑层全部复用 window.api.tavern.* + window.api.game.*。
 *  - startRun / stopRun 的 SSE handler 逐字照搬 tavern-app.jsx 行 699 起。
 *  - 样式全部走 .m-root 已有 class;新增 class 见文件末 neededCss 注释。
 *
 * 两屏(view='list' | 'chat')用组件内部 useState 切换,不依赖外部路由。
 * nav = { go, push, pop, switchTab, toast, openGame }
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useTavernChatRun, applyTavernState, abortRun,
  toolCallInline, toolResultInline,
} from '../../hooks/useTavernChatRun.js';
// 页面主体按职责机械拆到 ../tavern/*(逐字节等价、DOM/视觉/行为零变化);
// 与页面状态闭包纠缠的 SSE run-loop 接线(startRun/onRetry 等)整体留守本文件。
import { tvNow } from '../tavern/helpers.js';
import { MobileToast } from '../tavern/blocks.jsx';
import { ListView } from '../tavern/ListView.jsx';
import { ChatView } from '../tavern/ChatView.jsx';
import { TwoCardDrawer } from '../tavern/TwoCardDrawer.jsx';
import {
  ChatMenuSheet, DeleteConfirmSheet, RenameSheet, SystemPromptSheet, ImportSheet,
} from '../tavern/sheets.jsx';

/* ══════════════════════════════════════════════════════════════════
 *  MobileTavern — 顶层组件
 * ══════════════════════════════════════════════════════════════════ */
export function MobileTavern({ nav }) {
  const { t } = useTranslation();
  /* ── 列表状态 ──────────────────────────────────────────────────── */
  const [chats, setChats] = useState([]);
  const [archivedChats, setArchivedChats] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  /* ── 当前对话状态 ──────────────────────────────────────────────── */
  const [activeId, setActiveId] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [character, setCharacter] = useState(null);
  const [persona, setPersona] = useState(null);
  const [history, setHistory] = useState([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [immersive, setImmersive] = useState(false);
  const [aiReplyLoading, setAiReplyLoading] = useState(false);

  /* ── 流式发送状态 ──────────────────────────────────────────────── */
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [lastPlayerText, setLastPlayerText] = useState('');

  /* ── 视图 ──────────────────────────────────────────────────────── */
  const [view, setView] = useState('list'); // 'list' | 'chat'

  /* ── Sheet/Drawer 开关状态 ─────────────────────────────────────── */
  const [importOpen, setImportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState(null); // 菜单操作的 chat 对象
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [syspromptOpen, setSyspromptOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* ── Toast ─────────────────────────────────────────────────────── */
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const fireToast = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  /* ── 收口的酒馆 SSE 状态机(runRef + startRun/stopRun 在 hook 内,折叠语义见
   *    lib/tavern-chat-run.js;移动端 toast 走自有 fireToast)──────────────── */
  const { runRef, startRun: runChat, stopRun } = useTavernChatRun({ setRunning });

  /* ── reloadList ───────────────────────────────────────────────── */
  const reloadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const [a, b] = await Promise.all([
        window.api.tavern.list().catch(() => ({ chats: [] })),
        window.api.tavern.listArchived().catch(() => ({ chats: [] })),
      ]);
      setChats(Array.isArray(a?.chats) ? a.chats : []);
      setArchivedChats(Array.isArray(b?.chats) ? b.chats : []);
    } catch (_) {
      setChats([]); setArchivedChats([]);
    } finally { setLoadingList(false); }
  }, []);

  /* ── applyState(收口到 applyTavernState 核心三段 + 移动端叠加 setSystemPrompt)──── */
  const applyState = useCallback((data) => {
    applyTavernState(data, {
      setCharacter, setPersona, setHistory, setActiveChat, setSystemPrompt, setImmersive,
    });
  }, []);

  /* ── openChat(照搬 tavern-app.jsx)───────────────────────────── */
  const openChat = useCallback(async (chat) => {
    if (!chat || !chat.id) return;
    const rc = runRef.current;
    if (rc.sse) { try { rc.sse.stop('switch'); } catch (_) {} rc.sse = null; }
    setRunning(false); setHasError(false); setHistory([]);
    setActiveId(chat.id);
    setActiveChat(chat);
    try {
      await window.api.tavern.activate(chat.id);
      const data = await window.api.game.state();
      applyState(data);
      setView('chat');
    } catch (e) {
      fireToast(t('mobile.tavern.toast.open_fail'), 'danger');
    }
  }, [applyState, fireToast, t]);

  /* ── 首次进入自动打开最近对话 ───────────────────────────────────── */
  useEffect(() => { reloadList(); }, [reloadList]);
  const _autoOpened = useRef(false);
  useEffect(() => {
    if (_autoOpened.current || activeId != null || loadingList || chats.length === 0) return;
    // 直接进对话:进入酒馆自动打开最近一条会话(对齐电脑端"酒馆直接进对话";
    // 会话历史由后端自动维护,无"存档"概念)。空列表时停在 hero 引导新建。
    _autoOpened.current = true;
    openChat(chats[0]);
  }, [loadingList, chats, activeId, openChat]);

  /* ── 卸载停流 ────────────────────────────────────────────────── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { abortRun(runRef.current, 'unmount'); }, []);

  /* ── openSaveId ──────────────────────────────────────────────── */
  const openSaveId = useCallback(async (saveId, fallbackName) => {
    await reloadList();
    await openChat({ id: saveId, title: fallbackName || t('mobile.tavern.chat.default_title', { id: saveId }), character_name: fallbackName || '' });
  }, [reloadList, openChat, t]);

  /* ── 文件导入(角色卡 + JSONL)──────────────────────────────────── */
  const onPickCardFile = useCallback(async (file) => {
    if (!file) return;
    if (!/\.(png|json|webp)$/i.test(file.name || '')) {
      fireToast(t('mobile.tavern.toast.card_format_warn'), 'warn');
      return;
    }
    try {
      const r = await window.api.tavern.importCharacter(file);
      if (r && r.ok === false) throw new Error(r.error || t('mobile.tavern.toast.import_fail'));
      await openSaveId(r.save_id, r.character_name);
      fireToast(t('mobile.tavern.toast.card_imported', { name: r.character_name || t('mobile.tavern.chat.default_char_name') }), 'ok');
    } catch (e) {
      fireToast(t('mobile.tavern.toast.import_fail') + (e?.message ? ': ' + e.message : ''), 'danger');
    }
  }, [openSaveId, fireToast, t]);

  /* ── 空白开始(直接开聊,不预设角色卡)──────────────────────────────
   * 后端 create_tavern_save 支持 character_card_id=None(空起手对话,由 agent 即兴扮演);
   * 桌面端「新建对话」也是 tavern.create({}) → r.save.id。此前移动端 ImportSheet 只给「上传
   * 角色卡 / 导入记录」两个入口 → 用户被强制上传 json 卡才能开聊(反馈:新酒馆聊天被拦住)。 */
  const onCreateBlank = useCallback(async () => {
    setImportOpen(false);
    try {
      const r = await window.api.tavern.create({});
      if (r && r.ok === false) throw new Error(r.error || r.detail || t('mobile.tavern.toast.create_fail'));
      const newId = (r && r.save && r.save.id) || r?.save_id || r?.id;
      if (!newId) throw new Error(t('mobile.tavern.toast.create_fail'));
      await openSaveId(newId, t('mobile.tavern.chat.default_char_name'));
    } catch (e) {
      fireToast(t('mobile.tavern.toast.create_fail') + (e?.message ? ': ' + e.message : ''), 'danger');
    }
  }, [openSaveId, fireToast, t]);

  const onPickJsonlFile = useCallback(async (file) => {
    if (!file) return;
    try {
      const r = await window.api.tavern.importJsonl(file);
      if (r && r.ok === false) throw new Error(r.error || t('mobile.tavern.toast.import_fail'));
      await openSaveId(r.save_id, r.title || t('mobile.tavern.toast.imported_chat_title'));
      fireToast(t('mobile.tavern.toast.jsonl_imported', { count: r.commits_imported || 0 }), 'ok');
    } catch (e) {
      fireToast(t('mobile.tavern.toast.import_fail') + (e?.message ? ': ' + e.message : ''), 'danger');
    }
  }, [openSaveId, fireToast, t]);

  /* ── stopRun:收口到 useTavernChatRun(移动端无秒表,与 hook 默认一致)──── */
  // stopRun 由 hook 提供。

  /* ── startRun(收口到 useTavernChatRun;折叠语义见 lib/tavern-chat-run.js)──── */
  // 移动端差异:toast 走自有 fireToast(只取 kind,不显示 detail);restoreFailedDraft
  // 不回填输入框(setText:null);空回复文案不带「已恢复你的输入」;tool-op = inline 无 anchor。
  const startRun = useCallback(async (playerText) => {
    runChat({
      saveId: activeId, model: undefined, playerText, applyState,
      ts: tvNow,   // 移动端用自有 tvNow()(零填充 HH:MM),不走 __fmt.nowHHMM 的 locale slice。
      setHistory, setRunning, setText: null, setHasError, setLastPlayerText,
      // 移动端 toast:fireToast(msg, kind);detail 不显示(逐字保留旧行为),
      // 仅 idle 旧实现是合并串「生成停滞,120 秒无响应」→ 用 code 还原。
      toast: (title, o) => {
        const kind = o && o.kind;
        if (o && o.code === 'idle') { fireToast(t('mobile.tavern.toast.idle_stall'), 'warn'); return; }
        fireToast(title, kind);
      },
      reloadList,
      // 空回复文案:移动端不带「已恢复你的输入」。
      doneEmptyMsg: (interrupted) => (interrupted ? t('mobile.tavern.toast.interrupted') : t('mobile.tavern.toast.no_reply')),
      // onClose 文案:移动端更短。
      closeMsg: t('mobile.tavern.toast.connection_closed'),
      // tool-op:inline 模型(无 anchor)。
      onToolCall: toolCallInline,
      onToolResult: toolResultInline,
    });
  }, [activeId, applyState, reloadList, fireToast, runChat, t]);

  /* ── onRetry(照搬 tavern-app.jsx)────────────────────────────── */
  const onRetry = useCallback(() => {
    if (running) return;
    let t2 = (lastPlayerText && lastPlayerText.trim()) || '';
    if (!t2) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i]?.role === 'user' && (history[i].content || '').trim()) { t2 = history[i].content.trim(); break; }
      }
    }
    if (!t2) { fireToast(t('mobile.tavern.toast.no_retry_input'), 'warn'); return; }
    setHasError(false);
    setHistory(h => {
      const out = [...h];
      while (out.length && out[out.length - 1].role === 'assistant' && !(out[out.length - 1].content || '').trim()) out.pop();
      if (out.length && out[out.length - 1].role === 'user' && (out[out.length - 1].content || '').trim() === t2) out.pop();
      return out;
    });
    startRun(t2);
  }, [running, lastPlayerText, history, startRun, fireToast, t]);

  /* ── rail 操作 ───────────────────────────────────────────────── */
  const doRename = useCallback(async (chat, title) => {
    if (title == null) { setRenameTarget(chat); setRenameOpen(true); return; }
    try {
      await window.api.tavern.rename(chat.id, title);
      fireToast(t('mobile.tavern.toast.renamed'), 'ok');
      reloadList();
      if (String(chat.id) === String(activeId)) setActiveChat(p => ({ ...(p || {}), title }));
    } catch (e) { fireToast(t('mobile.tavern.toast.rename_fail'), 'danger'); }
    setRenameOpen(false);
  }, [reloadList, activeId, fireToast, t]);

  const doArchive = useCallback(async (chat, archived) => {
    try {
      await window.api.tavern.archive(chat.id, archived);
      fireToast(archived ? t('mobile.tavern.toast.archived') : t('mobile.tavern.toast.unarchived'), 'ok');
      reloadList();
    } catch (e) { fireToast(t('mobile.tavern.toast.archive_fail'), 'danger'); }
  }, [reloadList, fireToast, t]);

  const doDelete = useCallback(async (chat) => {
    setDeleteOpen(false); setDeleteTarget(null);
    try {
      await window.api.tavern.remove(chat.id);
      fireToast(t('mobile.tavern.toast.deleted'), 'ok');
      if (String(chat.id) === String(activeId)) {
        setActiveId(null); setActiveChat(null); setHistory([]); setCharacter(null); setPersona(null);
        setView('list');
      }
      reloadList();
    } catch (e) { fireToast(t('mobile.tavern.toast.delete_fail'), 'danger'); }
  }, [reloadList, activeId, fireToast, t]);

  const doAutotitle = useCallback(async (chat) => {
    try {
      await window.api.tavern.autotitle(chat.id);
      fireToast(t('mobile.tavern.toast.autotitled'), 'ok');
      reloadList();
      if (String(chat.id) === String(activeId)) {
        const data = await window.api.game.state();
        applyState(data);
      }
    } catch (e) { fireToast(t('mobile.tavern.toast.autotitle_fail'), 'danger'); }
  }, [reloadList, activeId, applyState, fireToast, t]);

  const onSaveSystemPrompt = useCallback(async (sp) => {
    if (!activeId) return;
    try {
      await window.api.tavern.setSystemPrompt(activeId, sp);
      setSystemPrompt(sp || '');
      fireToast(t('mobile.tavern.toast.sysprompt_saved'), 'ok');
    } catch (e) { fireToast(t('mobile.tavern.toast.save_fail'), 'danger'); throw e; }
  }, [activeId, fireToast, t]);

  const onSavePersona = useCallback(async (payload) => {
    try {
      const saved = await window.api.cards.myUpsert(payload);
      fireToast(t('mobile.tavern.toast.persona_saved'), 'ok');
      try { const d = await window.api.game.state(); applyState(d); } catch (_) {}
      return saved;
    } catch (e) {
      fireToast(t('mobile.tavern.toast.save_fail'), 'danger');
      throw e;
    }
  }, [applyState, fireToast, t]);

  /* ── 沉浸式拟人模式开关(持久写 state.tavern.immersive,确定性注入 system prompt)── */
  const onToggleImmersive = useCallback(async (enabled) => {
    if (!activeId) return;
    setImmersive(enabled); // 乐观更新
    try {
      await window.api.tavern.setImmersive(activeId, enabled);
      fireToast(enabled ? t('mobile.tavern.immersive.on_toast') : t('mobile.tavern.immersive.off_toast'), 'ok');
    } catch (e) {
      setImmersive(!enabled); // 回滚
      fireToast(t('mobile.tavern.toast.save_fail'), 'danger');
    }
  }, [activeId, fireToast, t]);

  /* ── AI 帮回:以玩家自己的角色生成一条回复 → 填入输入框(不自动发送)── */
  const onAiReply = useCallback(async () => {
    if (!activeId || aiReplyLoading) return null;
    setAiReplyLoading(true);
    try {
      const r = await window.api.tavern.aiReply(activeId);
      const reply = (r && r.reply) || '';
      if (!reply) { fireToast(t('mobile.tavern.ai_reply.empty'), 'warn'); return null; }
      return reply;
    } catch (e) {
      fireToast(t('mobile.tavern.ai_reply.fail'), 'danger');
      return null;
    } finally {
      setAiReplyLoading(false);
    }
  }, [activeId, aiReplyLoading, fireToast, t]);

  /* ── 列表页打开菜单时,记录操作 chat ─────────────────────────── */
  const openMenu = useCallback((chat) => {
    setMenuTarget(chat);
    setMenuOpen(true);
  }, []);

  /* 对话屏顶栏「更多」── 默认操作当前 activeChat */
  const openChatMenu = useCallback(() => {
    if (!activeChat) return;
    setMenuTarget(activeChat);
    setMenuOpen(true);
  }, [activeChat]);

  const exportUrl = activeId != null ? window.api.tavern.exportJsonl(activeId) : null;

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── 两屏切换(层叠滑动感) ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* 列表屏 */}
        <div style={{
          position: 'absolute', inset: 0,
          transform: view === 'chat' ? 'translateX(-20%)' : 'translateX(0)',
          opacity: view === 'chat' ? 0.5 : 1,
          transition: 'transform 0.35s var(--ease), opacity 0.35s',
          pointerEvents: view === 'chat' ? 'none' : 'auto',
          zIndex: view === 'list' ? 2 : 1,
        }}>
          <ListView
            chats={chats}
            archivedChats={archivedChats}
            activeId={activeId}
            loading={loadingList}
            onExit={() => nav.switchTab('home')}
            onOpen={openChat}
            onMenu={openMenu}
            onNew={() => setImportOpen(true)}
            onQuickStart={onCreateBlank}
          />
        </div>

        {/* 对话屏 */}
        {view === 'chat' && (
          <div style={{
            position: 'absolute', inset: 0,
            transform: 'translateX(0)',
            transition: 'transform 0.35s var(--ease)',
            zIndex: 2,
          }}>
            <ChatView
              activeChat={activeChat}
              character={character}
              persona={persona}
              history={history}
              running={running}
              hasError={hasError}
              systemPrompt={systemPrompt}
              onBack={() => { setView('list'); reloadList(); }}
              onSend={startRun}
              onStop={stopRun}
              onRetry={onRetry}
              onOpenDrawer={() => setDrawerOpen(true)}
              onOpenMenu={openChatMenu}
              onToast={fireToast}
              onAiReply={onAiReply}
              aiReplyLoading={aiReplyLoading}
            />
          </div>
        )}
      </div>

      {/* ── 双卡抽屉 ── */}
      <TwoCardDrawer
        open={drawerOpen}
        character={character}
        persona={persona}
        systemPrompt={systemPrompt}
        immersive={immersive}
        onToggleImmersive={onToggleImmersive}
        onClose={() => setDrawerOpen(false)}
        onSavePersona={onSavePersona}
        onSaveSystemPrompt={onSaveSystemPrompt}
      />

      {/* ── 导入 sheet ── */}
      <ImportSheet
        show={importOpen}
        onClose={() => setImportOpen(false)}
        onPickFile={onPickCardFile}
        onJsonlFile={onPickJsonlFile}
        onCreateBlank={onCreateBlank}
      />

      {/* ── 聊天菜单 sheet ── */}
      <ChatMenuSheet
        show={menuOpen}
        chat={menuTarget}
        onClose={() => { setMenuOpen(false); setMenuTarget(null); }}
        onRename={chat => { setMenuOpen(false); doRename(chat); }}
        onArchive={(chat, archived) => { setMenuOpen(false); setMenuTarget(null); doArchive(chat, archived); }}
        onDelete={chat => { setMenuOpen(false); setDeleteTarget(chat); setDeleteOpen(true); }}
        onAutotitle={chat => { setMenuTarget(null); doAutotitle(chat); }}
        onSystemPrompt={chat => { setMenuOpen(false); setMenuTarget(chat); setSyspromptOpen(true); }}
        onExport={menuTarget && menuTarget.id ? window.api.tavern.exportJsonl(menuTarget.id) : null}
      />

      {/* ── 删除确认 sheet ── */}
      <DeleteConfirmSheet
        show={deleteOpen}
        chat={deleteTarget}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null); }}
        onConfirm={() => { if (deleteTarget) doDelete(deleteTarget); }}
      />

      {/* ── 重命名 sheet ── */}
      <RenameSheet
        show={renameOpen}
        chat={renameTarget}
        onClose={() => { setRenameOpen(false); setRenameTarget(null); }}
        onConfirm={(chat, title) => { setRenameOpen(false); setRenameTarget(null); doRename(chat, title); }}
      />

      {/* ── 系统提示词 sheet ── */}
      <SystemPromptSheet
        show={syspromptOpen}
        chat={menuTarget}
        systemPrompt={systemPrompt}
        onClose={() => { setSyspromptOpen(false); }}
        onSave={onSaveSystemPrompt}
      />

      {/* ── Toast ── */}
      {toast && <MobileToast msg={toast.msg} kind={toast.kind} />}
    </div>
  );
}

export default MobileTavern;

/*
 * ── neededCss (补充到 mobile.css,带 .m-root 前缀)─────────────────
 *
 * .m-root .tv-m-screen {
 *   position: absolute; inset: 0;
 *   display: flex; flex-direction: column;
 *   background: var(--bg);
 * }
 *
 * .m-root .tv-m-empty {
 *   flex: 1; display: grid; place-items: center;
 *   font-size: 13px; padding: 40px;
 * }
 *
 * ─ 列表 hero ─
 * .m-root .tv-m-hero {
 *   flex: 1; display: flex; align-items: center; justify-content: center;
 *   padding: 32px 24px;
 * }
 * .m-root .tv-m-hero .tv-m-hero-mark {
 *   font-size: 40px; color: var(--accent); text-align: center; margin-bottom: 16px;
 * }
 * .m-root .tv-m-hero-title {
 *   margin: 0 0 8px; font-size: 24px; font-weight: 600;
 *   letter-spacing: 0.02em; text-align: center; color: var(--text);
 * }
 * .m-root .tv-m-hero-sub {
 *   margin: 0 0 20px; font-size: 13px; text-align: center; line-height: 1.6;
 *   color: var(--muted);
 * }
 * .m-root .tv-m-hero-drop {
 *   display: flex; flex-direction: column; align-items: center; gap: 6px;
 *   width: 100%; padding: 22px 16px; border-radius: 18px;
 *   border: 1.5px dashed var(--accent-edge); background: var(--accent-soft);
 *   color: var(--accent); cursor: pointer;
 *   transition: background .15s, transform .1s;
 * }
 * .m-root .tv-m-hero-drop:active { transform: scale(0.98); background: var(--panel-3); }
 * .m-root .tv-m-hero-drop-ic { display: grid; place-items: center; margin-bottom: 4px; }
 * .m-root .tv-m-hero-drop-main { font-size: 14.5px; font-weight: 500; color: var(--text); }
 * .m-root .tv-m-hero-drop-sub { font-size: 11.5px; color: var(--muted); }
 *
 * ─ 新对话按钮 ─
 * .m-root .tv-m-newchat {
 *   display: flex; align-items: center; gap: 14px;
 *   padding: 14px 16px; margin: 4px 12px 4px;
 *   border-radius: 14px; border: 1px dashed var(--accent-edge);
 *   background: var(--accent-soft); color: var(--accent);
 *   text-align: left; width: calc(100% - 24px);
 *   transition: background .14s, transform .1s;
 * }
 * .m-root .tv-m-newchat:active { transform: scale(0.98); }
 * .m-root .tv-m-newchat-ic { flex: none; width: 36px; height: 36px; display: grid; place-items: center; }
 * .m-root .tv-m-newchat-tx { flex: 1; min-width: 0; display: grid; gap: 2px; }
 * .m-root .tv-m-newchat-tx strong { font-size: 14px; color: var(--text); }
 * .m-root .tv-m-newchat-tx span { font-size: 11.5px; color: var(--muted-2); }
 *
 * ─ 对话列表项 ─
 * .m-root .tv-m-chat-item {
 *   display: flex; align-items: center; gap: 12px;
 *   padding: 12px 16px; width: 100%; text-align: left;
 *   border-bottom: 1px solid var(--line-soft);
 *   background: transparent;
 *   transition: background .12s;
 * }
 * .m-root .tv-m-chat-item:active, .m-root .tv-m-chat-item.active { background: var(--accent-soft); }
 * .m-root .tv-m-chat-av {
 *   flex: none; width: 42px; height: 42px; border-radius: 13px;
 *   display: grid; place-items: center;
 *   background: var(--panel-3); border: 1px solid var(--line);
 *   font-size: 18px; font-weight: 600; color: var(--text);
 * }
 * .m-root .tv-m-chat-main { flex: 1; min-width: 0; display: grid; gap: 3px; }
 * .m-root .tv-m-chat-row { display: flex; align-items: center; gap: 8px; }
 * .m-root .tv-m-chat-title { flex: 1; font-size: 14.5px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
 * .m-root .tv-m-chat-time { font-size: 10.5px; white-space: nowrap; flex: none; }
 * .m-root .tv-m-chat-snippet { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
 * .m-root .tv-m-chat-menu-btn { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 9px; color: var(--muted-2); }
 * .m-root .tv-m-chat-menu-btn:active { background: var(--panel-2); color: var(--text); }
 *
 * ─ 已归档切换 ─
 * .m-root .tv-m-archived-section { padding: 4px 0; }
 * .m-root .tv-m-archived-toggle {
 *   display: inline-flex; align-items: center; gap: 6px;
 *   padding: 8px 16px; font-size: 12px; color: var(--muted);
 *   transition: color .12s;
 * }
 * .m-root .tv-m-archived-toggle:active { color: var(--text); }
 *
 * ─ 工具调用块 ─
 * .m-root .tv-m-tools { padding: 4px 14px; }
 * .m-root .tv-m-tools-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--muted-2); padding: 4px 0; }
 * .m-root .tv-m-tools-summary { color: var(--muted-2); }
 * .m-root .tv-m-tools-detail { margin-top: 6px; display: grid; gap: 6px; }
 * .m-root .tv-m-tool-item { background: var(--bg-deep); border: 1px solid var(--line-soft); border-radius: 10px; padding: 9px 11px; display: grid; gap: 4px; }
 * .m-root .tv-m-tool-name { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--text); font-family: var(--font-mono); }
 * .m-root .tv-m-tool-dot { width: 7px; height: 7px; border-radius: 999px; flex: none; }
 * .m-root .tv-m-tool-kv { margin: 0; font: 11px var(--font-mono); color: var(--muted); white-space: pre-wrap; overflow-x: auto; }
 * .m-root .tv-m-tool-k { color: var(--accent); }
 *
 * ─ 思考流块 ─
 * .m-root .tv-m-thinking { padding: 4px 14px 8px; }
 * .m-root .tv-m-thinking-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--muted-2); padding: 4px 0; }
 * .m-root .tv-m-thinking-label { color: var(--info); }
 * .m-root .tv-m-thinking-body { font: 11.5px/1.65 var(--font-mono); color: var(--muted); padding: 8px 10px; background: var(--bg-deep); border-radius: 8px; border: 1px solid var(--line-soft); white-space: pre-wrap; overflow-x: auto; }
 *
 * ─ 流式光标 ─
 * @keyframes tv-m-blink { 50% { opacity: 0; } }
 * .m-root .tv-m-cursor { display: inline-block; width: 2px; height: 1.1em; background: var(--accent); border-radius: 1px; vertical-align: text-bottom; margin-left: 2px; animation: tv-m-blink 0.9s steps(1) infinite; }
 *
 * ─ 双卡抽屉 tabs ─
 * .m-root .tv-m-drawer-tabs { display: flex; gap: 4px; padding: 10px 14px 0; border-bottom: 1px solid var(--line-soft); }
 * .m-root .tv-m-drawer-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px 4px 10px; font-size: 12.5px; color: var(--muted); border-bottom: 2px solid transparent; transition: color .14s, border-color .14s; }
 * .m-root .tv-m-drawer-tab.active { color: var(--accent); border-color: var(--accent); }
 *
 * ─ 导入按钮 ─
 * .m-root .tv-m-import-btn {
 *   display: flex; align-items: center; gap: 14px;
 *   padding: 14px 12px; border-radius: 14px;
 *   border: 1px solid var(--line-soft); background: var(--panel);
 *   color: var(--text); text-align: left; width: 100%;
 *   transition: background .13s, transform .1s;
 * }
 * .m-root .tv-m-import-btn:active { transform: scale(0.98); background: var(--panel-2); }
 * .m-root .tv-m-import-ic { flex: none; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; background: var(--accent-soft); border: 1px solid var(--accent-edge); color: var(--accent); }
 * .m-root .tv-m-import-tx { flex: 1; min-width: 0; display: grid; gap: 3px; }
 * .m-root .tv-m-import-tx strong { font-size: 14.5px; color: var(--text); }
 * .m-root .tv-m-import-tx span { font-size: 12px; color: var(--muted-2); }
 * .m-root .tv-m-import-fmt { flex: none; font: 600 10px var(--font-mono); text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted-2); padding: 4px 8px; border-radius: 6px; background: var(--bg-deep); border: 1px solid var(--line-soft); }
 *
 * ─ 通用输入框 ─
 * .m-root .tv-m-input { width: 100%; padding: 11px 13px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg-deep); color: var(--text); font: 14.5px/1.6 var(--font-serif); outline: none; }
 * .m-root .tv-m-input:focus { border-color: var(--accent-edge); box-shadow: 0 0 0 3px rgba(201,100,66,0.07); }
 * .m-root textarea.tv-m-input { resize: none; }
 */
