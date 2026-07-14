/* Extracted from pages/MobileSaves.jsx — mechanical split, byte-for-byte. */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { ConfirmSheet } from '../Sheet.jsx';
import { fmtDate } from './helpers.js';
import { ExportSheet } from './ExportSheet.jsx';
import { SaveSettingsPane } from './SaveSettingsPane.jsx';
import { BranchListPane } from './BranchListPane.jsx';

/* 确认弹窗(底部 Sheet)收口到 mobile/Sheet.jsx 的 <ConfirmSheet>(语义统一 Batch 6b)。
   原本地实现与统一版 DOM/视觉 1:1(sheet-wrap show 点关 + confirm-note 正文 + 取消/danger
   确认 + loading 禁用),仅把调用点的 onClose 改为 onCancel。 */

/* ── 存档详情 (overview / 设置 / 分支) ─────────────────────── */
function SaveDetail({ save, scripts, onBack, onContinue, onToast, onReload }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('overview');
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [delConfirm, setDelConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const script = scripts.find(sc => sc.id === save.script_id);

  const doRename = async () => {
    const v = renameVal.trim();
    if (!v || v === save.title) { setRenaming(false); return; }
    try {
      await window.api.saves.rename(save.id, v);
      onToast(t('mobile.saves.detail.renamed'), 'ok');
      setRenaming(false);
      onReload();
    } catch (e) { onToast(t('mobile.saves.detail.rename_failed', { msg: e?.message || '' }), 'danger'); }
  };

  const doActivate = async () => {
    setActivating(true);
    try {
      await window.api.saves.activate(save.id);
      onToast(t('mobile.saves.detail.activated'), 'ok');
      onReload();
    } catch (e) { onToast(t('mobile.saves.detail.activate_failed', { msg: e?.message || '' }), 'danger'); }
    setActivating(false);
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await window.api.saves.remove(save.id);
      onToast(t('mobile.saves.detail.deleted'), 'ok');
      setDelConfirm(false);
      onBack();
      onReload();
    } catch (e) { onToast(t('mobile.saves.detail.delete_failed', { msg: e?.message || '' }), 'danger'); }
    setDeleting(false);
  };

  const TABS = [
    { id: 'overview', label: t('mobile.saves.detail.tab_overview') },
    { id: 'settings', label: t('mobile.saves.detail.tab_settings') },
    { id: 'branches', label: t('mobile.saves.detail.tab_branches') },
  ];

  return (
    <>
      {/* 顶部 */}
      <div className="pl-head">
        <button className="pl-back" onClick={onBack}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title">
          {renaming ? (
            <div className="pl-input-row" style={{ width: '100%' }}>
              <input
                className="pl-input"
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenaming(false); }}
                autoFocus
                style={{ fontSize: 16, flex: 1 }}
              />
              <button className="pl-headbtn accent" onClick={doRename}><Icon name="check" size={18} /></button>
              <button className="pl-headbtn" onClick={() => setRenaming(false)}><Icon name="close" size={17} /></button>
            </div>
          ) : (
            <>
              <strong className="serif" style={{ fontSize: 15 }}>{save.title || t('mobile.saves.save_fallback', { id: save.id })}</strong>
              <span className="sub">{script?.title || t('mobile.saves.free_mode')}</span>
            </>
          )}
        </div>
        {!renaming && (
          <div className="pl-head-actions">
            <button className="pl-headbtn" onClick={() => { setRenameVal(save.title || ''); setRenaming(true); }}>
              <Icon name="edit" size={18} />
            </button>
            <button className="pl-headbtn" onClick={() => setExportOpen(true)}>
              <Icon name="download" size={18} />
            </button>
            <button className="pl-headbtn" style={{ color: 'var(--danger)' }} onClick={() => setDelConfirm(true)}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Tab 切换 */}
      <div className="panel-tabs">
        {TABS.map(t => (
          <button key={t.id} className={'ptab ' + (tab === t.id ? 'active' : '')} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="pl-body">
        <div className="pl-pad">

          {/* 继续游戏 + 激活按钮 */}
          <div style={{ display: 'flex', gap: 9, marginBottom: 18 }}>
            <button className="pl-btn-primary" style={{ flex: 2 }} onClick={() => onContinue(save)}>
              <Icon name="play" size={18} />{t('mobile.saves.detail.continue_btn')}
            </button>
            {!save.current && (
              <button className="pl-btn-ghost" style={{ flex: 1 }} onClick={doActivate} disabled={activating}>
                {activating ? '…' : t('mobile.saves.detail.set_current_btn')}
              </button>
            )}
            {save.current && (
              <span className="pill accent" style={{ alignSelf: 'center', height: 36, paddingInline: 12, fontSize: 12 }}>
                <span className="dot accent" style={{ animation: 'mk-pulse-dot 1.6s infinite' }} /> {t('mobile.saves.detail.current_label')}
              </span>
            )}
          </div>

          {/* ── overview ─────────────────────────────────────────── */}
          {tab === 'overview' && (
            <>
              <div className="pl-kvgrid" style={{ marginBottom: 16 }}>
                {[
                  { k: t('mobile.saves.detail.kv_script'),   v: script?.title || t('mobile.saves.free_mode') },
                  { k: t('mobile.saves.detail.kv_player'),   v: save._raw?.player_name || '—' },
                  { k: t('mobile.saves.detail.kv_turn'),     v: save._raw?.turn != null ? t('mobile.saves.detail.kv_turn_value', { turn: save._raw.turn }) : '—' },
                  { k: t('mobile.saves.detail.kv_branches'), v: t('mobile.saves.detail.kv_branches_value', { count: Number(save.branch_count) || 0 }) },
                  { k: t('mobile.saves.detail.kv_world_time'), v: save._raw?.world_time || '—' },
                  { k: t('mobile.saves.detail.kv_last_played'), v: fmtDate(save.last_played_ts || save._raw?.last_played_at) },
                  { k: t('mobile.saves.detail.kv_created'),  v: fmtDate(save.created_ts) },
                  { k: t('mobile.saves.detail.kv_status'),   v: save.current ? t('mobile.saves.detail.kv_status_current') : t('mobile.saves.detail.kv_status_idle') },
                ].map(({ k, v }) => (
                  <div key={k} className="pl-kv">
                    <div className="k">{k}</div>
                    <div className="v serif">{v}</div>
                  </div>
                ))}
              </div>

              {/* 最新片段 */}
              {(save._raw?.snippet || save._raw?.last_message) && (
                <div className="pl-sec">
                  <div className="pl-sec-head"><h2>{t('mobile.saves.detail.latest_snippet')}</h2></div>
                  <blockquote className="quote">
                    {save._raw.snippet || save._raw.last_message}
                  </blockquote>
                </div>
              )}
            </>
          )}

          {/* ── settings ─────────────────────────────────────────── */}
          {tab === 'settings' && (
            <div className="pl-sec" style={{ marginTop: 0 }}>
              <div className="pl-sec-head"><h2>{t('mobile.saves.detail.game_settings')}</h2></div>
              <SaveSettingsPane saveId={save.id} onToast={onToast} />
            </div>
          )}

          {/* ── branches ─────────────────────────────────────────── */}
          {tab === 'branches' && (
            <div className="pl-sec" style={{ marginTop: 0 }}>
              <div className="pl-sec-head">
                <h2>{t('mobile.saves.detail.branches_heading', { count: Number(save.branch_count) || '?' })}</h2>
              </div>
              <BranchListPane save={save} onToast={onToast} onContinue={() => onContinue(save)} />
            </div>
          )}
        </div>
      </div>

      {/* 删除确认 */}
      <ConfirmSheet
        open={delConfirm}
        title={t('mobile.saves.detail.del_confirm_title')}
        body={t('mobile.saves.detail.del_confirm_body', { title: save.title })}
        danger
        confirmLabel={t('common.delete')}
        onCancel={() => setDelConfirm(false)}
        onConfirm={doDelete}
        loading={deleting}
      />

      {/* 导出弹窗 */}
      <ExportSheet
        open={exportOpen}
        save={save}
        onClose={() => setExportOpen(false)}
        onToast={onToast}
      />
    </>
  );
}

export { SaveDetail };
