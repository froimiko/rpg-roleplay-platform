/* MobileCards 底部 Sheet(酒馆导入 ImportSheet / 删除确认 DeleteSheet)—— 从 pages/MobileCards.jsx 拆出,逐字节不变。 */
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { Tag } from './shared.jsx';
import { fmtBytes } from './helpers.js';
import { ToggleRow as SetRow } from '../Field.jsx';

/* ═══════════════════════════════════════════════════════════════════
   酒馆导入 Sheet(底部滑出)
   ═══════════════════════════════════════════════════════════════════ */
function ImportSheet({ show, onClose, onConfirm }) {
  const { t } = useTranslation();
  const [importType, setImportType] = useState('card'); // 'card' | 'chat'
  const [mode, setMode] = useState('file'); // 'file' | 'paste'
  const [files, setFiles] = useState([]);
  const [json, setJson] = useState('');
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState('');
  const [aiSplit, setAiSplit] = useState(false);
  const [chatFile, setChatFile] = useState(null);
  const [chatParsed, setChatParsed] = useState(null);
  const [chatError, setChatError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const chatFileRef = useRef(null);

  // 重置
  useEffect(() => {
    if (!show) return;
    setImportType('card'); setMode('file'); setFiles([]); setJson('');
    setParsed(null); setParseError(''); setAiSplit(false);
    setChatFile(null); setChatParsed(null); setChatError('');
  }, [show]);

  const handleFiles = (list) => {
    const MAX = 10 * 1024 * 1024;  // 10MB(对齐后端 + 桌面端;群反馈 #92:>5MB 角色卡传不上)
    const MAX_FILES = 8;
    const arr = [...list].slice(0, MAX_FILES);
    const valid = arr.filter((f) => {
      if (!f) return false;
      if (!/\.(png|json|webp)$/i.test(f.name || '')) return false;
      if (f.size > MAX) return false;
      return true;
    });
    setFiles(valid);
    if (valid[0]) {
      const f = valid[0];
      const sizeKb = (f.size / 1024).toFixed(1);
      const fmt = f.name.match(/\.png$/i) ? 'SillyTavern · PNG v2' : 'SillyTavern · JSON';
      setParsed({
        name: f.name.replace(/\.(png|json|webp)$/i, '').replace(/[_-]/g, ' '),
        format: fmt,
        description: `${sizeKb} KB · ${t('mobile.cards.import.pending_parse')}`,
        tags: [t('mobile.cards.import.tag_import')],
        first_mes: t('mobile.cards.import.parse_after_submit'),
        _file: f,
      });
    }
  };

  const tryParseJson = () => {
    setParseError('');
    try {
      const obj = JSON.parse(json);
      // 解包常见的外层包装（如 {"ok":true,"card":{...}}）
      const inner = obj.card?.data ? obj.card : obj.character?.data ? obj.character : obj;
      const d = inner.data || {};
      const name = inner.name || inner.char_name || d.name || t('mobile.cards.unnamed');
      const desc = inner.description || d.description || t('mobile.cards.import.no_desc');
      const spec = inner.spec || obj.spec;
      const specVersion = inner.spec_version || obj.spec_version;
      setParsed({
        name,
        format: spec ? `${spec} · ${specVersion || 'v1'}` : 'JSON',
        description: desc.length > 120 ? desc.slice(0, 120) + '…' : desc,
        tags: inner.tags || d.tags || [],
        first_mes: inner.first_mes || d.first_mes || '—',
        _jsonString: json,
      });
    } catch (e) {
      setParseError(t('mobile.cards.import.json_parse_fail', { msg: e.message }));
      setParsed(null);
    }
  };

  const handleChatFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(jsonl?)$/i.test(f.name || '')) { setChatError(t('mobile.cards.import.chat_type_error')); return; }
    if (f.size > 20 * 1024 * 1024) { setChatError(t('mobile.cards.import.chat_size_error')); return; }
    setChatFile(f); setChatError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.split('\n').filter((l) => l.trim());
        const header = JSON.parse(lines[0] || '{}');
        setChatParsed({
          charName: header.character_name || header.char_name || f.name.replace(/\.jsonl?$/i, ''),
          userName: header.user_name || 'User',
          msgCount: lines.slice(1).filter((l) => l.trim()).length,
          sizeKb: (f.size / 1024).toFixed(1),
          _text: ev.target.result,
        });
      } catch { setChatError(t('mobile.cards.import.file_parse_fail')); }
    };
    reader.readAsText(f);
  };

  const doConfirm = () => {
    if (importType === 'card') {
      if (!parsed) return;
      if (parsed._file) onConfirm({ type: 'card', file: parsed._file, aiSplit });
      else if (parsed._jsonString) onConfirm({ type: 'card_json', json_string: parsed._jsonString, aiSplit });
    } else {
      if (!chatParsed?._text) return;
      onConfirm({ type: 'chat', jsonl: chatParsed._text, charName: chatParsed.charName });
    }
  };

  const canSubmit = importType === 'card' ? !!parsed && !parseError : !!chatParsed && !chatError;

  return (
    <div className="sheet-wrap" style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: show ? 'auto' : 'none' }}>
      <div className="sheet-scrim" style={{ opacity: show ? 1 : 0 }} onClick={onClose} />
      <div className="sheet" style={{ transform: show ? 'translateY(0)' : 'translateY(101%)', maxHeight: '88%' }}>
        <div className="sheet-grip" />
        <div className="sheet-title">{t('mobile.cards.import.title')}</div>
        <div className="sheet-sub">{t('mobile.cards.import.subtitle')}</div>

        {/* 顶层类型切换 */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
          {[{ id: 'card', l: t('mobile.cards.import.tab_card') }, { id: 'chat', l: t('mobile.cards.import.tab_chat') }].map((tb) => (
            <button key={tb.id} className={'pl-pill' + (importType === tb.id ? ' active' : '')} onClick={() => setImportType(tb.id)}>
              {tb.l}
            </button>
          ))}
        </div>

        {/* ── 角色卡导入 ── */}
        {importType === 'card' && (
          <>
            <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
              {[{ id: 'file', l: t('mobile.cards.import.mode_file') }, { id: 'paste', l: t('mobile.cards.import.mode_paste') }].map((tb) => (
                <button key={tb.id} className={'pl-pill' + (mode === tb.id ? ' active' : '')} onClick={() => setMode(tb.id)}>
                  {tb.l}
                </button>
              ))}
            </div>

            {mode === 'file' && (
              <>
                <div
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--line-strong)'}`,
                    borderRadius: 14, padding: '28px 16px', textAlign: 'center',
                    background: dragOver ? 'var(--accent-soft)' : 'var(--bg)',
                    cursor: 'pointer', marginBottom: 12,
                  }}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                >
                  <Icon name="upload" size={28} style={{ color: dragOver ? 'var(--accent)' : 'var(--muted)', marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: dragOver ? 'var(--accent)' : 'var(--text)' }}>
                    {dragOver ? t('mobile.cards.import.drop_release') : t('mobile.cards.import.drop_hint')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 5 }}>{t('mobile.cards.import.drop_limits')}</div>
                  <input ref={fileRef} type="file" accept=".png,.json,.webp" multiple style={{ display: 'none' }}
                    onChange={(e) => handleFiles(e.target.files)} />
                </div>
                {files.length > 0 && (
                  <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
                    {files.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 9, background: 'var(--bg-deep)', fontSize: 12 }}>
                        <Icon name={f.name.endsWith('.png') || f.name.endsWith('.webp') ? 'image' : 'file'} size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        <span style={{ color: 'var(--muted-2)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{fmtBytes(f.size)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {mode === 'paste' && (
              <>
                <div className="pl-field" style={{ marginBottom: 10 }}>
                  <label>{t('mobile.cards.import.json_label')}</label>
                  <textarea className="pl-input" rows={6} value={json} onChange={(e) => setJson(e.target.value)}
                    placeholder={'{\n  "name": "...",\n  "description": "...",\n  "first_mes": "..."\n}'}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                </div>
                <button className="pl-btn-ghost" style={{ marginBottom: 12 }} onClick={tryParseJson} disabled={!json.trim()}>
                  <Icon name="check" size={14} /> {t('mobile.cards.import.btn_parse_json')}
                </button>
                {parseError && (
                  <div style={{ padding: '9px 12px', borderRadius: 9, background: 'var(--danger-soft)', border: '1px solid rgba(200,103,93,0.3)', color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>
                    <Icon name="warn" size={12} style={{ marginRight: 6 }} /> {parseError}
                  </div>
                )}
              </>
            )}

            {/* 预览卡 */}
            {parsed && (
              <div style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: '12px 14px', background: 'var(--panel)', marginBottom: 12 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted-2)', marginBottom: 8 }}>
                  {t('mobile.cards.import.preview_label')} · {parsed.format}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--info-soft)', border: '1px solid rgba(122,166,194,0.3)', display: 'grid', placeItems: 'center', color: 'var(--info)', font: '600 20px var(--font-serif)', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                    {parsed._imageUrl ? (
                      <img src={parsed._imageUrl} alt={parsed.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : null}
                    {parsed.name.slice(0, 1)}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontFamily: 'var(--font-serif)', color: 'var(--text)', fontWeight: 600 }}>{parsed.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{parsed.description}</div>
                  </div>
                </div>
                {parsed.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {parsed.tags.map((tg) => <Tag key={tg} label={tg} />)}
                  </div>
                )}
              </div>
            )}

            {/* AI 字段拆分 opt-in */}
            <div className="pl-group" style={{ marginBottom: 12 }}>
              <SetRow
                label={t('mobile.cards.import.ai_split_label')}
                desc={t('mobile.cards.import.ai_split_desc')}
                checked={aiSplit}
                onChange={setAiSplit}
              />
            </div>
          </>
        )}

        {/* ── 聊天记录导入 ── */}
        {importType === 'chat' && (
          <>
            <div className="pl-note" style={{ marginBottom: 12 }}>
              {t('mobile.cards.import.chat_hint_pre')} <strong>SillyTavern .jsonl</strong> {t('mobile.cards.import.chat_hint_post')}
            </div>
            <button className="pl-btn-ghost" style={{ marginBottom: 12 }}
              onClick={() => chatFileRef.current?.click()}>
              <Icon name="upload" size={15} /> {t('mobile.cards.import.chat_btn_file')}
            </button>
            <input ref={chatFileRef} type="file" accept=".jsonl,.json" style={{ display: 'none' }} onChange={handleChatFile} />
            {chatFile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 9, background: 'var(--bg-deep)', fontSize: 12, marginBottom: 10 }}>
                <Icon name="file" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatFile.name}</span>
                <span style={{ color: 'var(--muted-2)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{(chatFile.size / 1024).toFixed(1)} KB</span>
              </div>
            )}
            {chatError && (
              <div style={{ padding: '9px 12px', borderRadius: 9, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>
                <Icon name="warn" size={12} style={{ marginRight: 6 }} />{chatError}
              </div>
            )}
            {chatParsed && (
              <div style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: '12px 14px', background: 'var(--panel)', marginBottom: 12 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted-2)', marginBottom: 8 }}>{t('mobile.cards.import.chat_preview_label')}</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--ok-soft)', display: 'grid', placeItems: 'center', color: 'var(--ok)', font: '600 18px var(--font-serif)', flexShrink: 0 }}>
                    {chatParsed.charName.slice(0, 1)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{chatParsed.charName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                      {t('mobile.cards.import.chat_preview_stats', { count: chatParsed.msgCount, size: chatParsed.sizeKb, user: chatParsed.userName })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* 底部按钮 */}
        <div className="sheet-actions" style={{ marginTop: 4 }}>
          <button className="sheet-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="sheet-btn primary" onClick={doConfirm} disabled={!canSubmit}
            style={{ opacity: canSubmit ? 1 : 0.45 }}>
            <Icon name="check" size={15} /> {importType === 'chat' ? t('mobile.cards.import.btn_import_chat') : (files.length > 1 ? t('mobile.cards.import.btn_import_n', { n: files.length }) : t('mobile.cards.import.btn_import'))}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   删除确认 Sheet
   ═══════════════════════════════════════════════════════════════════ */
function DeleteSheet({ show, name, onClose, onConfirm }) {
  const { t } = useTranslation();
  return (
    <div className="sheet-wrap" style={{ position: 'fixed', inset: 0, zIndex: 61, pointerEvents: show ? 'auto' : 'none' }}>
      <div className="sheet-scrim" style={{ opacity: show ? 1 : 0 }} onClick={onClose} />
      <div className="sheet" style={{ transform: show ? 'translateY(0)' : 'translateY(101%)' }}>
        <div className="sheet-grip" />
        <div className="sheet-title">{t('mobile.cards.delete.title')}</div>
        <div className="confirm-preview">{t('mobile.cards.delete.message', { name })}</div>
        <div className="confirm-note"><strong>{t('mobile.cards.delete.irreversible')}</strong></div>
        <div className="sheet-actions">
          <button className="sheet-btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="sheet-btn danger" onClick={onConfirm}>
            <Icon name="trash" size={15} /> {t('mobile.cards.delete.confirm_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ImportSheet, DeleteSheet };
