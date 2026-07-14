import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { usePlatformData } from '../../platform-app.jsx';
import { SetGroup } from './shared.jsx';

/* ────────────────────────────────────────────────────────────────── */
/* SECTION: 危险区 (danger)                                            */
/* ────────────────────────────────────────────────────────────────── */
function DangerSection({ nav }) {
  const { t } = useTranslation();
  const { saves = [] } = usePlatformData();
  const gameSaves = saves.filter(s => s.save_kind !== 'tavern');
  const nSaves = gameSaves.length;
  const [showClearSheet, setShowClearSheet] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearProgress, setClearProgress] = useState(null);

  const openClear = () => { setConfirmText(''); setShowClearSheet(true); };
  const closeClear = () => { setShowClearSheet(false); setConfirmText(''); };

  const doDelete = async () => {
    if (nSaves === 0) { nav.toast(t('mobile.settings.danger.no_saves'), 'ok', 'info'); closeClear(); return; }
    setClearProgress({ done:0, total:nSaves });
    let done=0, fail=0;
    for (const s of gameSaves) {
      try { await window.api.saves.remove(s.id); } catch (_) { fail++; }
      done++;
      setClearProgress({ done, total:nSaves });
    }
    setClearProgress(null);
    closeClear();
    nav.toast(fail ? t('mobile.settings.danger.clear_partial', { done: done-fail, fail }) : t('mobile.settings.danger.clear_done', { done }), fail ? 'warn' : 'ok', 'trash');
    try { window.dispatchEvent(new CustomEvent('rpg-saves-updated')); } catch (_) {}
  };

  return (
    <>
      <div style={{ padding:'11px 13px', borderRadius:10, background:'var(--danger-soft)', border:'1px solid rgba(200,103,93,0.3)', fontSize:12.5, color:'var(--danger)', lineHeight:1.6, marginBottom:16 }}>
        {t('mobile.settings.danger.irreversible_warning')}
      </div>

      <SetGroup title={t('mobile.settings.danger.dangerous_ops')}>
        {/* 清空存档 */}
        <div className="pl-setrow">
          <div className="pl-setrow-tx">
            <strong>{t('mobile.settings.danger.clear_saves')}</strong>
            <span>{t('mobile.settings.danger.clear_saves_desc', { n: nSaves })}</span>
          </div>
          <button
            style={{ fontSize:13, color:'var(--danger)', background:'var(--danger-soft)', border:'1px solid rgba(200,103,93,0.3)', borderRadius:8, padding:'7px 14px' }}
            onClick={openClear}
          >
            {t('mobile.settings.danger.clear_btn')}
          </button>
        </div>

        {/* 重置平台 */}
        <div className="pl-setrow">
          <div className="pl-setrow-tx">
            <strong>{t('mobile.settings.danger.reset_platform')}</strong>
            <span>{t('mobile.settings.danger.reset_platform_desc')}</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted-2)', fontFamily: 'var(--font-mono)' }}>CLI</span>
        </div>
        <div style={{ padding:'6px 13px 12px', fontSize:11.5, color:'var(--muted)', lineHeight:1.5 }}>
          {t('mobile.settings.danger.reset_cmd_label')}
          <code className="mono" style={{ display:'block', marginTop:6, padding:'7px 10px', borderRadius:7, background:'var(--bg-deep)', border:'1px solid var(--line-soft)', fontSize:11, userSelect:'all', wordBreak:'break-all' }}>
            python -m rpg.platform_app.migrate reset --confirm
          </code>
        </div>
      </SetGroup>

      {/* 清空存档底部 Sheet */}
      {showClearSheet && (
        <div className="sheet-wrap show">
          <div className="sheet-scrim" onClick={clearProgress ? undefined : closeClear} />
          <div className="sheet" style={{ maxHeight: '75%' }}>
            <div className="sheet-grip" />
            <div className="sheet-title" style={{ color: 'var(--danger)' }}>{t('mobile.settings.danger.clear_saves')}</div>
            <div className="sheet-sub">
              {t('mobile.settings.danger.confirm_desc_prefix')} <strong style={{ color: 'var(--text)' }}>{nSaves}</strong> {t('mobile.settings.danger.confirm_desc_suffix')}
            </div>
            <div className="confirm-preview">
              {t('mobile.settings.danger.confirm_preview')}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, color: 'var(--muted)', display:'block', marginBottom:8 }}>
                {t('mobile.settings.danger.confirm_input_prefix')} <strong style={{ color:'var(--danger)' }}>{t('mobile.settings.danger.confirm_keyword')}</strong> {t('mobile.settings.danger.confirm_input_suffix')}
              </label>
              <input
                className="pl-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={t('mobile.settings.danger.confirm_keyword')}
                autoFocus
              />
            </div>
            {clearProgress && (
              <div style={{ marginBottom: 12, fontSize: 12.5, color: 'var(--text-quiet)' }}>
                {t('mobile.settings.danger.deleting_progress', { done: clearProgress.done, total: clearProgress.total })}
                <div style={{ height:4, background:'var(--panel-3)', borderRadius:2, marginTop:6, overflow:'hidden' }}>
                  <div style={{ height:'100%', background:'var(--danger)', borderRadius:2, width:`${Math.round(clearProgress.done/clearProgress.total*100)}%`, transition:'width .2s' }} />
                </div>
              </div>
            )}
            <div className="sheet-actions">
              <button className="sheet-btn" onClick={closeClear} disabled={!!clearProgress}>{t('common.cancel')}</button>
              <button className="sheet-btn danger"
                disabled={confirmText !== t('mobile.settings.danger.confirm_keyword') || !!clearProgress}
                onClick={doDelete}>
                <Icon name="trash" size={14} /> {t('mobile.settings.danger.clear_saves_confirm_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { DangerSection };
