/* MobileTavern 对话屏(消息流 + composer + 长按/斜杠/附加功能 sheet)—— 从 pages/MobileTavern.jsx 拆出,逐字节不变。 */

import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { MobileComposer } from '../Composer.jsx';
import { useStickToBottom } from '../../hooks/useStickToBottom.js';
import { stripNarrativeOps } from '../../narrative-strip.js';
import { SLASH_COMMANDS } from '../../game-composer.jsx';
import { BottomSheet } from './BottomSheet.jsx';
import { ToolCallBlock, ThinkingBlock, Paras } from './blocks.jsx';
import { copyText } from '../../lib/clipboard.js';

/* ─── 对话屏 ──────────────────────────────────────────────────────── */
function ChatView({
  activeChat, character, persona, history, running, hasError, systemPrompt,
  onBack, onSend, onStop, onRetry, onOpenDrawer, onOpenMenu, onToast,
  onAiReply, aiReplyLoading,
}) {
  const [text, setText] = useState('');
  const [plusOpen, setPlusOpen] = useState(false); // + 附加功能 sheet(AI 帮回 等)
  const [slashOpen, setSlashOpen] = useState(false); // 斜杠命令 sheet(/set 等,与各前端同源 SLASH_COMMANDS)
  const [pressedIdx, setPressedIdx] = useState(null);
  const [msgSheet, setMsgSheet] = useState(null); // 长按消息 → 操作 sheet(与游戏台同一套交互)
  const lpTimer = useRef(null);
  const openMsgSheet = (i) => { setPressedIdx(i); try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {} setMsgSheet({ idx: i }); };
  const startPress = (i) => { lpTimer.current = setTimeout(() => openMsgSheet(i), 420); };
  const cancelPress = () => clearTimeout(lpTimer.current);
  const closeMsgSheet = () => { setMsgSheet(null); setPressedIdx(null); };
  const threadRef = useRef(null);
  const taRef = useRef(null);

  const { t } = useTranslation();
  const charName = (character && character.name) || (activeChat && activeChat.character_name) || t('mobile.tavern.chat.default_char_name');

  /* 自动滚底:收口到 useStickToBottom(逐字等价:threshold 80 / 双守卫 360 / 首屏·末条玩家策略 / instant scrollTop)。 */
  const _last = history && history[history.length - 1];
  const { showJump, jumpToBottom } = useStickToBottom(threadRef, {
    deps: [history.length, running],
    lastIsUser: !!(_last && _last.role === 'user'),
    hasContent: history.length > 0,
    mode: 'instant',
    withButton: true,
  });

  /* textarea 自动增高已下沉到 MobileComposer(taRef 仍传入,供其管理高度)。 */

  const submit = () => {
    const t = text.trim();
    if (!t || running) return;
    onSend(t);
    setText('');
  };

  const total = history.length;
  const isWaiting = running && (total === 0 || history[total - 1]?.role === 'user');
  const lastAssistantIdx = (() => { for (let i = total - 1; i >= 0; i--) { if (history[i]?.role === 'assistant') return i; } return -1; })();

  const copy = async (txt) => {
    await copyText(txt || '');
    // 用 MobileTavern 自有的可见 fireToast(经 onToast 传入),不再走无渲染器的 window.__apiToast。
    onToast?.(t('mobile.tavern.chat.copied'), 'ok');
  };

  return (
    <div className="tv-m-screen" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 */}
      <div className="topbar">
        <button className="tb-btn" onClick={onBack} aria-label={t('mobile.tavern.chat.back_aria')}>
          <Icon name="chevron_left" size={18} />
        </button>
        {charName ? (
          <button className="tb-title" onClick={onOpenDrawer} style={{ cursor: 'pointer' }}>
            <strong style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{charName}</strong>
            <span className="sub">
              <Icon name="chevron_down" size={11} style={{ opacity: 0.45 }} />
              {t('mobile.tavern.drawer.heading')}
            </span>
          </button>
        ) : (
          <div className="tb-title">
            <strong>{activeChat?.title || t('mobile.tavern.chat.fallback_title')}</strong>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          {charName && (
            <button className="tb-btn" onClick={onOpenDrawer} aria-label={t('mobile.tavern.drawer.heading')}>
              <Icon name="cards" size={16} />
            </button>
          )}
          <button className="tb-btn" onClick={onOpenMenu} aria-label={t('mobile.tavern.chat.more_actions_aria')}>
            <Icon name="more" size={16} />
          </button>
        </div>
      </div>

      {/* 消息流 */}
      <div
        ref={threadRef}
        className="chat scroll"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}
      >
        {total === 0 && !running && (
          <div className="muted-2" style={{ textAlign: 'center', padding: '60px 24px', fontSize: 13 }}>
            <Icon name="feedback" size={26} style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
            {t('mobile.tavern.chat.empty')}
          </div>
        )}

        {history.map((m, i) => {
          if (m.role === 'assistant') {
            const toolOps = m._toolOps || m.tool_ops;
            const isStreaming = !m.streaming_done && i === total - 1 && running;
            return (
              <React.Fragment key={`a-${i}`}>
                {Array.isArray(toolOps) && toolOps.length > 0 && <ToolCallBlock ops={toolOps} />}
                <div
                  className={`msg msg-gm${pressedIdx === i ? ' pressed' : ''}`}
                  onTouchStart={() => startPress(i)} onTouchEnd={cancelPress} onTouchMove={cancelPress}
              onContextMenu={(e) => { e.preventDefault(); openMsgSheet(i); }}
                >
                  <div className="msg-meta">
                    <span className="msg-tag">
                      {(character && character.name) || activeChat?.character_name || t('m_tavern_extra.ai_speaker_fallback')}
                    </span>
                    {m.ts && <span className="msg-gts">{m.ts}</span>}
                  </div>
                  {(m._thinking || m.reasoning) && <ThinkingBlock text={m._thinking || m.reasoning} />}
                  <div className="msg-body">
                    <Paras text={stripNarrativeOps(m.content)} />
                    {isStreaming && (
                      <span className="tv-m-cursor" aria-hidden="true" />
                    )}
                  </div>
                  <div className="msg-hint"><Icon name="menu" size={10} /> {t('mobile.tavern.chat.long_press_hint')}</div>
                </div>
              </React.Fragment>
            );
          }
          /* user */
          return (
            <div
              key={`u-${i}`}
              className={`msg msg-player${pressedIdx === i ? ' pressed' : ''}`}
              onTouchStart={() => startPress(i)} onTouchEnd={cancelPress} onTouchMove={cancelPress}
              onContextMenu={(e) => { e.preventDefault(); openMsgSheet(i); }}
            >
              <div className="msg-meta">
                <span className="msg-tag">{(persona && persona.name) || t('mobile.tavern.chat.you')}</span>
                {m.ts && <span className="msg-gts">{m.ts}</span>}
              </div>
              <div className="msg-body">{m.content}</div>
            </div>
          );
        })}

        {/* 等待气泡 */}
        {isWaiting && (
          <div className="msg msg-gm">
            <div className="waiting" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="gc-spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {t('mobile.tavern.chat.thinking', { name: charName })}
              </span>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {hasError && (
          <div className="msg" style={{ padding: '10px 14px', margin: '0 6px' }}>
            <div style={{
              borderRadius: 12, border: '1px solid rgba(200,103,93,0.4)',
              background: 'var(--danger-soft)', padding: '12px 14px',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <Icon name="warn" size={15} style={{ color: 'var(--danger)', flex: 'none', marginTop: 1 }} />
              <div>
                <strong style={{ fontSize: 13 }}>{t('mobile.tavern.chat.error_title')}</strong>
                <p style={{ margin: '4px 0 10px', fontSize: 12, color: 'var(--text-quiet)', lineHeight: 1.6 }}>
                  {typeof hasError === 'string' && hasError ? hasError : t('mobile.tavern.chat.error_default')}
                </p>
                <button
                  className="sheet-btn primary"
                  style={{ height: 36, padding: '0 14px', width: 'auto', flex: 'none', fontSize: 13 }}
                  onClick={onRetry}
                >
                  {t('mobile.tavern.chat.retry')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 回到最新按钮 */}
        {showJump && (
          <button
            onClick={jumpToBottom}
            style={{
              position: 'sticky', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 5, width: 'fit-content',
              padding: '7px 14px', borderRadius: 999, fontSize: 12,
              background: 'var(--panel-3)', border: '1px solid var(--line-strong)',
              color: 'var(--text-quiet)', zIndex: 5,
            }}
          >
            <Icon name="chevron_down" size={13} /> {t('mobile.tavern.chat.scroll_to_bottom')}
          </button>
        )}
      </div>

      {/* Composer(统一组件 MobileComposer:酒馆带 + 附加功能=AI 帮回) */}
      <MobileComposer
        value={text}
        onChange={setText}
        onSubmit={submit}
        onStop={onStop}
        running={running}
        placeholder={t('mobile.tavern.chat.composer_placeholder', { name: charName })}
        sendAria={t('mobile.tavern.chat.send_aria')}
        stopAria={t('mobile.tavern.chat.stop_aria')}
        taRef={taRef}
        leading={(
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="c-plus" onClick={() => setSlashOpen(true)} aria-label={t('mobile.tavern.slash.aria', '斜杠命令')}>
              <Icon name="slash" size={18} />
            </button>
            {onAiReply ? (
              <button className="c-plus" onClick={() => setPlusOpen(true)} aria-label={t('mobile.tavern.plus.aria')}>
                <Icon name="plus" size={20} />
              </button>
            ) : null}
          </div>
        )}
      />

      {/* 斜杠命令 sheet:挑一条把前缀塞进输入框(状态写指令由后端 apply_player_directives 处理,回执见 tavern-chat-run) */}
      <BottomSheet show={slashOpen} onClose={() => setSlashOpen(false)} maxHeight="70%">
        <div className="sheet-title">{t('mobile.tavern.slash.title', '斜杠命令')}</div>
        <div className="sheet-list">
          {SLASH_COMMANDS.map((c) => (
            <button key={c.id} className="sheet-item" onClick={() => {
              setSlashOpen(false);
              setText(c.trigger);
              setTimeout(() => taRef.current?.focus(), 50);
            }}>
              <span className="sheet-ico" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>/</span>
              <span className="sheet-tx"><strong>{t(c.labelKey)}</strong> <span className="mono">{c.trigger.trim()}</span></span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* + 附加功能 sheet:AI 帮回(以玩家自己的角色生成一条回复,填入输入框) */}
      <BottomSheet show={plusOpen} onClose={() => setPlusOpen(false)} maxHeight="40%">
        <div className="sheet-title">{t('mobile.tavern.plus.title')}</div>
        <div className="sheet-list">
          <button
            className="sheet-item"
            disabled={aiReplyLoading || running}
            onClick={async () => {
              setPlusOpen(false);
              const reply = await (onAiReply && onAiReply());
              if (reply) { setText(reply); setTimeout(() => taRef.current?.focus(), 50); }
            }}
          >
            <span className="sheet-ico"><Icon name={aiReplyLoading ? 'refresh' : 'sparkle'} size={18} /></span>
            <span className="sheet-tx">
              <strong>{t('mobile.tavern.ai_reply.label')}</strong>
              <span>{t('mobile.tavern.ai_reply.sub')}</span>
            </span>
          </button>
        </div>
      </BottomSheet>

      {/* 长按消息 → 操作 sheet(与游戏台同一套交互;酒馆无存档/分支,故仅 复制 + 重新生成) */}
      <BottomSheet show={!!msgSheet} onClose={closeMsgSheet} maxHeight="50%">
        <div className="sheet-title">{msgSheet && history[msgSheet.idx]?.role === 'assistant' ? t('mobile.tavern.msg_sheet.assistant_title') : t('mobile.tavern.msg_sheet.user_title')}</div>
        <div className="sheet-list">
          <button className="sheet-item" onClick={() => { const txt = (msgSheet && history[msgSheet.idx]?.content) || ''; closeMsgSheet(); copy(txt); }}>
            <span className="sheet-ico"><Icon name="copy" size={18} /></span>
            <span className="sheet-tx"><strong>{t('mobile.tavern.msg_sheet.copy')}</strong><span>{t('mobile.tavern.msg_sheet.copy_sub')}</span></span>
          </button>
          {msgSheet && msgSheet.idx === lastAssistantIdx && !running && (
            <button className="sheet-item" onClick={() => { closeMsgSheet(); onRetry(); }}>
              <span className="sheet-ico"><Icon name="refresh" size={18} /></span>
              <span className="sheet-tx"><strong>{t('mobile.tavern.msg_sheet.regenerate')}</strong><span>{t('mobile.tavern.msg_sheet.regenerate_sub')}</span></span>
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

export { ChatView };
