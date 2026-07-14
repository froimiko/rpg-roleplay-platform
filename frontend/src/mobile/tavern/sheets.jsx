/* MobileTavern 底部 sheet 对话(菜单 / 删除确认 / 重命名 / 系统提示 / 导入)—— 从 pages/MobileTavern.jsx 拆出,逐字节不变。
   防误合点名项:DeleteConfirmSheet 的 confirm-preview 框 + trash icon + BottomSheet show 契约一个字不改。 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { BottomSheet } from './BottomSheet.jsx';

/* ─── 聊天菜单(重命名 / 归档 / 删除 / 自动命名 / 系统提示 / 导出)────── */
function ChatMenuSheet({ show, chat, onClose, onRename, onArchive, onDelete, onAutotitle, onSystemPrompt, onExport }) {
  const { t } = useTranslation();
  if (!chat) return null;
  const archived = !!chat.archived;
  return (
    <BottomSheet show={show} onClose={onClose}>
      <div className="sheet-title">{chat.title || chat.character_name || t('mobile.tavern.chat.default_title', { id: chat.id })}</div>
      <div className="sheet-sub">{archived ? t('mobile.tavern.menu.archived_label') : t('mobile.tavern.menu.actions_label')}</div>
      <div className="sheet-list">
        <button className="sheet-item" onClick={() => { onClose(); onAutotitle(chat); }}>
          <span className="sheet-ico"><Icon name="spark" size={17} /></span>
          <span className="sheet-tx"><strong>{t('mobile.tavern.menu.autotitle')}</strong><span>{t('mobile.tavern.menu.autotitle_sub')}</span></span>
        </button>
        <button className="sheet-item" onClick={() => { onClose(); onSystemPrompt(chat); }}>
          <span className="sheet-ico"><Icon name="braces" size={17} /></span>
          <span className="sheet-tx"><strong>{t('mobile.tavern.menu.system_prompt')}</strong><span>{t('mobile.tavern.menu.system_prompt_sub')}</span></span>
        </button>
        <button className="sheet-item" onClick={() => { onClose(); onRename(chat); }}>
          <span className="sheet-ico"><Icon name="edit" size={17} /></span>
          <span className="sheet-tx"><strong>{t('common.edit')}</strong><span>{t('mobile.tavern.menu.rename_sub')}</span></span>
        </button>
        {onExport && (
          <a className="sheet-item" href={onExport} target="_blank" rel="noopener" onClick={onClose}>
            <span className="sheet-ico"><Icon name="download" size={17} /></span>
            <span className="sheet-tx"><strong>{t('mobile.tavern.menu.export_jsonl')}</strong><span>{t('mobile.tavern.menu.export_jsonl_sub')}</span></span>
          </a>
        )}
        <button className="sheet-item" onClick={() => { onClose(); onArchive(chat, !archived); }}>
          <span className="sheet-ico"><Icon name="folder" size={17} /></span>
          <span className="sheet-tx">
            <strong>{archived ? t('mobile.tavern.menu.unarchive') : t('mobile.tavern.menu.archive')}</strong>
            <span>{archived ? t('mobile.tavern.menu.unarchive_sub') : t('mobile.tavern.menu.archive_sub')}</span>
          </span>
        </button>
        <button className="sheet-item danger" onClick={() => { onClose(); onDelete(chat); }}>
          <span className="sheet-ico"><Icon name="trash" size={17} /></span>
          <span className="sheet-tx"><strong>{t('mobile.tavern.menu.delete_chat')}</strong><span>{t('mobile.tavern.menu.delete_chat_sub')}</span></span>
        </button>
      </div>
    </BottomSheet>
  );
}

/* ─── 删除确认 sheet ───────────────────────────────────────────────
   语义统一 Batch 6b GUARD:本站不收口到 mobile/Sheet.jsx 的 <ConfirmSheet>。差异点:
   ① 多一个 .confirm-preview 引用框(高亮显示对话标题)统一版无此结构
   ② 删除钮内含 trash Icon(统一版纯文案)③ 包在本文件 <BottomSheet>(show 切换 + 滑入)中,
   与统一版 open 渲染契约不同。1:1 复刻不了 → 保留原样。 */
function DeleteConfirmSheet({ show, chat, onClose, onConfirm }) {
  const { t } = useTranslation();
  if (!chat) return null;
  const title = chat.title || chat.character_name || t('mobile.tavern.chat.default_title', { id: chat.id });
  return (
    <BottomSheet show={show} onClose={onClose}>
      <div className="sheet-title">{t('mobile.tavern.delete.title')}</div>
      <div className="confirm-preview">{t('mobile.tavern.delete.preview', { title })}</div>
      <div className="confirm-note">{t('mobile.tavern.delete.note_prefix')}<strong>{t('mobile.tavern.delete.note_irreversible')}</strong>{t('mobile.tavern.delete.note_suffix')}</div>
      <div className="sheet-actions">
        <button className="sheet-btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="sheet-btn danger" onClick={onConfirm}>
          <Icon name="trash" size={15} /> {t('common.delete')}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ─── 重命名 sheet ───────────────────────────────────────────────── */
function RenameSheet({ show, chat, onClose, onConfirm }) {
  const { t } = useTranslation();
  const [val, setVal] = useState('');
  useEffect(() => { if (chat) setVal(chat.title || chat.character_name || ''); }, [chat]);
  if (!chat) return null;
  const commit = () => { const v = val.trim(); if (v) onConfirm(chat, v); };
  return (
    <BottomSheet show={show} onClose={onClose}>
      <div className="sheet-title">{t('mobile.tavern.rename.title')}</div>
      <div style={{ padding: '4px 4px 12px' }}>
        <input
          className="tv-m-input"
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { e.preventDefault(); commit(); } }}
          placeholder={t('mobile.tavern.rename.placeholder')}
          maxLength={200}
        />
      </div>
      <div className="sheet-actions">
        <button className="sheet-btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="sheet-btn primary" onClick={commit} disabled={!val.trim()}>
          <Icon name="check" size={14} /> {t('common.save')}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ─── 系统提示词编辑 sheet ───────────────────────────────────────── */
function SystemPromptSheet({ show, chat, systemPrompt, onClose, onSave }) {
  const { t } = useTranslation();
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (show) { setVal(systemPrompt || ''); } }, [show, systemPrompt]);
  if (!chat) return null;
  const doSave = async () => {
    setSaving(true);
    try { await onSave(val); onClose(); } catch (_) {} finally { setSaving(false); }
  };
  return (
    <BottomSheet show={show} onClose={onClose} maxHeight="90%">
      <div className="sheet-title">{t('mobile.tavern.sysprompt.title')}</div>
      <div className="sheet-sub">{t('mobile.tavern.sysprompt.sub')}</div>
      <div style={{ padding: '4px 4px 10px' }}>
        <textarea
          className="tv-m-input"
          rows={10}
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder={t('mobile.tavern.sysprompt.placeholder')}
          style={{ resize: 'none', minHeight: 180 }}
        />
      </div>
      <div className="sheet-actions">
        <button className="sheet-btn" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
        <button className="sheet-btn primary" onClick={doSave} disabled={saving}>
          <Icon name="check" size={14} /> {saving ? t('mobile.tavern.sysprompt.saving') : t('common.save')}
        </button>
      </div>
    </BottomSheet>
  );
}

/* ─── 导入 / 新对话 sheet ────────────────────────────────────────── */
function ImportSheet({ show, onClose, onPickFile, onJsonlFile, onCreateBlank }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const jsonlRef = useRef(null);

  return (
    <BottomSheet show={show} onClose={onClose} maxHeight="88%">
      <div className="sheet-title">{t('mobile.tavern.import.title')}</div>
      <div className="sheet-sub">{t('mobile.tavern.import.sub')}</div>

      {/* 主入口:空白开始(直接开聊,不预设角色卡)。放最上、accent 样式 = 推荐路径。 */}
      <button className="tv-m-import-btn primary" onClick={onCreateBlank}>
        <span className="tv-m-import-ic"><Icon name="feedback" size={20} /></span>
        <span className="tv-m-import-tx">
          <strong>{t('mobile.tavern.import.blank_btn')}</strong>
          <span>{t('mobile.tavern.import.blank_btn_sub')}</span>
        </span>
      </button>

      <div className="tv-m-import-or muted-2">{t('mobile.tavern.import.or')}</div>

      {/* 拖/选卡 —— 用 <label> 包裹 input 原生触发文件选择器:
          手机浏览器对 display:none input 的 .click() 多会拦截,改 label 关联 + 视觉隐藏(非 display:none)。 */}
      <label className="tv-m-import-btn" style={{ position: 'relative' }}>
        <span className="tv-m-import-ic"><Icon name="upload" size={20} /></span>
        <span className="tv-m-import-tx">
          <strong>{t('mobile.tavern.import.card_btn')}</strong>
          <span>{t('mobile.tavern.import.card_btn_sub')}</span>
        </span>
        <input
          ref={fileRef} type="file" accept=".png,.json,.webp"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
          onChange={e => { const f = e.target.files && e.target.files[0]; if (f) { onClose(); onPickFile(f); } e.target.value = ''; }}
        />
      </label>

      {/* 导入聊天记录 JSONL */}
      <label className="tv-m-import-btn" style={{ marginTop: 8, position: 'relative' }}>
        <span className="tv-m-import-ic"><Icon name="download" size={20} /></span>
        <span className="tv-m-import-tx">
          <strong>{t('mobile.tavern.import.jsonl_btn')}</strong>
          <span>{t('mobile.tavern.import.jsonl_btn_sub')}</span>
        </span>
        <span className="tv-m-import-fmt">JSONL</span>
        <input
          ref={jsonlRef} type="file" accept=".jsonl,.json"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
          onChange={e => { const f = e.target.files && e.target.files[0]; if (f) { onClose(); onJsonlFile(f); } e.target.value = ''; }}
        />
      </label>
    </BottomSheet>
  );
}

export { ChatMenuSheet, DeleteConfirmSheet, RenameSheet, SystemPromptSheet, ImportSheet };
