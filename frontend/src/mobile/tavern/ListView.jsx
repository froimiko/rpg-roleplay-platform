/* MobileTavern 列表屏(单条对话项 + 列表视图)—— 从 pages/MobileTavern.jsx 拆出,逐字节不变。 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { relTime } from './helpers.js';

/* ─── 单条对话项(列表页)──────────────────────────────────────────── */
function ChatListItem({ chat, active, onOpen, onMenu }) {
  const { t } = useTranslation();
  const initial = (chat.character_name || chat.title || '?').trim().slice(0, 1);
  const curTitle = chat.title || chat.character_name || t('mobile.tavern.chat.default_title', { id: chat.id });

  return (
    // 外层用 div[role=button] 而非 <button>:内部含「更多」菜单按钮,button 套 button =
    // 非法 HTML / React 注水报错(In HTML, button cannot be a descendant of button)。
    <div
      role="button"
      tabIndex={0}
      className={`tv-m-chat-item${active ? ' active' : ''}`}
      onClick={() => onOpen(chat)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(chat); } }}
    >
      <span className="tv-m-chat-av serif">{initial}</span>
      <span className="tv-m-chat-main">
        <span className="tv-m-chat-row">
          <span className="tv-m-chat-title">{curTitle}</span>
          <span className="tv-m-chat-time muted-2">{relTime(chat.updated_at)}</span>
        </span>
        {chat.last_snippet
          ? <span className="tv-m-chat-snippet muted-2">{chat.last_snippet}</span>
          : <span className="tv-m-chat-snippet muted-2" style={{ fontStyle: 'italic' }}>{chat.character_name || t('mobile.tavern.chat.default_character')}</span>}
      </span>
      <button
        className="tv-m-chat-menu-btn"
        onClick={e => { e.stopPropagation(); onMenu(chat); }}
        aria-label={t('mobile.tavern.chat.more_aria')}
      >
        <Icon name="more" size={17} />
      </button>
    </div>
  );
}

/* ─── 列表屏 ──────────────────────────────────────────────────────── */
function ListView({ chats, archivedChats, activeId, loading, onExit, onOpen, onMenu, onNew, onQuickStart }) {
  const { t } = useTranslation();
  const [showArchived, setShowArchived] = useState(false);
  const empty = !loading && chats.length === 0 && archivedChats.length === 0;

  return (
    <div className="tv-m-screen">
      {/* 顶栏 */}
      <div className="topbar">
        <button className="tb-exit" onClick={onExit}>
          <Icon name="chevron_left" size={15} /> {t('mobile.tavern.list.back_to_app')}
        </button>
        <div className="tb-title">
          <strong>{t('mobile.tavern.list.heading')}</strong>
          <span className="sub"><Icon name="feedback" size={11} /> {t('mobile.tavern.list.sub')}</span>
        </div>
        <button className="tb-btn accent" onClick={onNew} aria-label={t('mobile.tavern.import.title')}>
          <Icon name="plus" size={18} />
        </button>
      </div>

      {/* 正文 */}
      {loading ? (
        <div className="tv-m-empty muted-2">{t('common.loading')}</div>
      ) : empty ? (
        <div className="tv-m-hero">
          <div className="tv-m-hero-mark">✻</div>
          <h1 className="tv-m-hero-title serif">{t('mobile.tavern.list.hero_title')}</h1>
          <p className="tv-m-hero-sub muted">{t('mobile.tavern.list.hero_sub')}</p>
          {/* 主操作:一键直接开聊(空白起手,不强制上传角色卡)。 */}
          <button className="tv-m-hero-cta" onClick={onQuickStart}>
            <Icon name="feedback" size={18} />
            {t('mobile.tavern.list.hero_quick_start')}
          </button>
          {/* 次操作:导入角色卡 / 聊天记录。 */}
          <button className="tv-m-hero-drop" onClick={onNew}>
            <span className="tv-m-hero-drop-ic"><Icon name="upload" size={22} /></span>
            <span className="tv-m-hero-drop-main">{t('mobile.tavern.list.hero_drop_main')}</span>
            <span className="tv-m-hero-drop-sub">{t('mobile.tavern.list.hero_drop_sub')}</span>
          </button>
        </div>
      ) : (
        <div className="tv-m-list scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {/* 新对话按钮(列表非空时) */}
          <button className="tv-m-newchat" onClick={onNew}>
            <span className="tv-m-newchat-ic"><Icon name="plus" size={20} /></span>
            <span className="tv-m-newchat-tx">
              <strong>{t('mobile.tavern.import.title')}</strong>
              <span>{t('mobile.tavern.list.newchat_sub')}</span>
            </span>
          </button>

          {chats.map(c => (
            <ChatListItem
              key={c.id} chat={c}
              active={String(c.id) === String(activeId)}
              onOpen={onOpen} onMenu={onMenu}
            />
          ))}

          {archivedChats.length > 0 && (
            <div className="tv-m-archived-section">
              <button className="tv-m-archived-toggle" onClick={() => setShowArchived(v => !v)}>
                <Icon name={showArchived ? 'chevron_down' : 'chevron_right'} size={13} />
                {t('mobile.tavern.list.archived_toggle', { count: archivedChats.length })}
              </button>
              {showArchived && archivedChats.map(c => (
                <ChatListItem
                  key={c.id} chat={c}
                  active={String(c.id) === String(activeId)}
                  onOpen={onOpen} onMenu={onMenu}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { ChatListItem, ListView };
