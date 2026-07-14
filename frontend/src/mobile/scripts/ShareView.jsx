/* 发布/分享子视图 —— 从 pages/MobileScripts.jsx 拆出,逐字节不变。 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';

/* ─── 发布/分享子视图 ─────────────────────────── */
function ShareView({ script, currentUserId, onBack, onRefresh, nav }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const isOwner = script && currentUserId && script.owner_id === currentUserId;
  const isPublic = !!script?.is_public;

  const onToggleVisibility = async () => {
    if (!isOwner) return;
    const next = !isPublic;
    if (next && (script.review_status || 'unreviewed') !== 'reviewed') {
      nav.toast(t('mobile.scripts.share.need_review'), 'accent', 'warn');
      return;
    }
    if (next && !await window.__confirm({ message: t('mobile.scripts.share.confirm_publish', { title: script.title }) })) return;
    setSaving(true);
    try {
      const r = await window.api.scripts.setVisibility(script.id, next);
      if (r?.ok === false) throw new Error(r.message || r.error || t('mobile.scripts.op_failed'));
      nav.toast(next ? t('mobile.scripts.share.published') : t('mobile.scripts.share.unpublished'), 'ok', 'check');
      onRefresh?.();
    } catch (e) { nav.toast(e?.message || t('mobile.scripts.op_failed'), 'danger', 'warn'); }
    finally { setSaving(false); }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const filename = (script.title || 'script').replace(/[\\/:*?"<>|]/g, '_') + '_pack.zip';
      await window.api.scripts.exportPack(script.id, filename);
      nav.toast(t('mobile.scripts.share.export_ok', { filename }), 'ok', 'check');
    } catch (e) { nav.toast(e?.message || t('mobile.scripts.share.export_error'), 'danger', 'warn'); }
    finally { setExporting(false); }
  };

  const onFork = async () => {
    if (!await window.__confirm({ message: t('mobile.scripts.share.confirm_fork', { title: script.title }) })) return;
    try {
      const r = await window.api.scripts.fork(script.id, { title: `${script.title} (${t('mobile.scripts.share.copy_suffix')})` });
      if (!r || r.ok === false) throw new Error(r?.error || t('mobile.scripts.op_failed'));
      nav.toast(t('mobile.scripts.share.forked'), 'ok', 'check');
      try { window.dispatchEvent(new CustomEvent('rpg-scripts-updated')); } catch (_) {}
      onBack();
    } catch (e) { nav.toast(e?.message || t('mobile.scripts.op_failed'), 'danger', 'warn'); }
  };

  return (
    <>
      <div className="pl-head">
        <button className="pl-back" onClick={onBack} aria-label={t('common.back')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title center">
          <strong>{t('mobile.scripts.share.title')}</strong>
          <span className="sub">{script?.title}</span>
        </div>
      </div>
      <div className="pl-body tabbed">
        <div className="pl-pad">
          {isOwner && (
            <div className="pl-group" style={{ marginBottom: 16 }}>
              <div className="pl-setrow">
                <span className={'pl-row-ic ' + (isPublic ? 'ok' : '')} style={{ width: 38, height: 38 }}>
                  <Icon name="globe" size={16} />
                </span>
                <div className="pl-setrow-tx">
                  <strong>{t('mobile.scripts.share.publish_label')}</strong>
                  <span>{isPublic ? t('mobile.scripts.share.publish_on_desc') : t('mobile.scripts.share.publish_off_desc')}</span>
                </div>
                <button
                  className={'pl-toggle' + (isPublic ? ' on' : '')}
                  onClick={onToggleVisibility}
                  disabled={saving}
                />
              </div>
            </div>
          )}
          {!isOwner && script?.owner_id && (
            <div style={{
              padding: '12px 14px', borderRadius: 12, marginBottom: 16,
              background: 'var(--info-soft)', border: '1px solid rgba(122,166,194,0.3)',
              fontSize: 13, color: 'var(--text-quiet)', lineHeight: 1.6,
            }}>
              {t('mobile.scripts.share.not_owner_desc')}
              <button
                className="pl-btn-primary"
                style={{ marginTop: 10 }}
                onClick={onFork}
              >
                <Icon name="copy" size={17} /> {t('mobile.scripts.share.fork_btn')}
              </button>
            </div>
          )}

          <div className="pl-sec">
            <div className="pl-sec-head"><h2>{t('mobile.scripts.share.import_export_section')}</h2></div>
            <button className="pl-btn-ghost" style={{ marginBottom: 9 }} onClick={onExport} disabled={exporting}>
              <Icon name="download" size={16} />{exporting ? t('mobile.scripts.share.exporting') : t('mobile.scripts.share.export_btn')}
            </button>
          </div>

          {script?.sharing_mode && script.sharing_mode !== 'private' && (
            <div className="pl-sec">
              <div className="pl-sec-head"><h2>{t('mobile.scripts.share.sharing_mode_section')}</h2></div>
              <div className="pl-card">
                <div style={{ fontSize: 13, color: 'var(--text-quiet)' }}>
                  {t('mobile.scripts.share.current_mode')}
                  <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                    {{
                      'public': t('mobile.scripts.share.mode_public'),
                      'pinned-snapshot': t('mobile.scripts.share.mode_pinned'),
                      'floating-latest': t('mobile.scripts.share.mode_floating'),
                    }[script.sharing_mode] || script.sharing_mode}
                  </span>
                  {script.sharing_mode === 'pinned-snapshot' && script.current_pin_commit_id && (
                    <span className="mono" style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted-2)' }}>
                      {script.current_pin_commit_id.slice(0, 8)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export { ShareView };
