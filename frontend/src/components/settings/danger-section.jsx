// 危险操作区(DangerSection)。纯机械搬出,零行为变化。
import React from 'react';
import { useState as useStatePL } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../game-icons.jsx';
import Modal from '../Modal.jsx';
import { usePlatformData } from '../../platform-app.jsx';
import { SetGroup, SetRow } from './shared.jsx';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSButton from '@cloudscape-design/components/button';

function DangerSection() {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useStatePL(null);
  // task 49：原 confirm body 写死 "全部 12 个存档"。改成真实拉 /api/saves 计数。
  const { saves = [] } = usePlatformData();
  const nSaves = saves.length;
  // S3/S4: 文字二次确认 state
  const [confirmText, setConfirmText] = useStatePL("");
  // S5: 清空进度 state
  const [clearProgress, setClearProgress] = useStatePL(null); // {done, total} | null

  const openConfirm = (which) => { setConfirmText(""); setConfirm(which); };
  const closeConfirm = () => { setConfirm(null); setConfirmText(""); };

  return (
    <SetGroup title={t('settings.danger.title')}>
      <SetRow label={t('settings.danger.clear_saves')} description={t('settings.danger.clear_saves_desc')}>
        <CSButton variant="normal" onClick={() => openConfirm("clear")}>{t('settings.danger.clear_saves_btn')}</CSButton>
      </SetRow>
      <SetRow label={t('settings.danger.reset_platform')} description={t('settings.danger.reset_platform_desc')}>
        <CSSpaceBetween direction="horizontal" size="s">
          <CSButton variant="normal" disabled>{t('settings.danger.reset_cli_btn')}</CSButton>
          <span className="muted-2" style={{fontSize: 11}}>
            {t('settings.danger.reset_cli_hint')}<code style={{userSelect: "all"}}>python -m rpg.platform_app.migrate reset --confirm</code>
          </span>
        </CSSpaceBetween>
      </SetRow>

      {/* S3/S5: 清空存档 Modal — 文字确认 + 进度条 */}
      {confirm === "clear" && (
        <Modal
          open
          width={460}
          onClose={closeConfirm}
          header={
            <div>
              <div className="pl-modal-eyebrow" style={{color: "var(--danger)"}}>{t('settings.danger.clear_modal_eyebrow')}</div>
              <h2 className="pl-modal-title">{t('settings.danger.clear_modal_title')}</h2>
            </div>
          }
          footer={<>
            <span></span>
            <div style={{display: "flex", gap: 8}}>
              <button className="btn ghost" onClick={closeConfirm}>{t('common.cancel')}</button>
              <button
                className="btn danger"
                disabled={confirmText !== t('settings.danger.clear_confirm_word') || !!clearProgress}
                onClick={async () => {
                  if (nSaves === 0) { window.__apiToast?.(t('settings.danger.clear_empty'), { kind: "info", duration: 1600 }); closeConfirm(); return; }
                  setClearProgress({ done: 0, total: nSaves });
                  let done = 0, fail = 0;
                  for (const s of saves) {
                    try { await window.api.saves.remove(s.id); } catch (_) { fail++; }
                    done++;
                    setClearProgress({ done, total: nSaves });
                  }
                  setClearProgress(null);
                  closeConfirm();
                  window.__apiToast?.(fail ? t('settings.danger.clear_ok_fail', { count: done - fail, fail }) : t('settings.danger.clear_ok', { count: done - fail }), { kind: fail ? "warn" : "ok", duration: 3000 });
                  try { window.dispatchEvent(new CustomEvent("rpg-saves-updated")); } catch (_) {}
                }}
              >
                <Icon name="trash" size={12} /> {t('settings.danger.clear_saves_btn')}
              </button>
            </div>
          </>}
        >
            <div style={{fontSize: 13.5, lineHeight: 1.65, color: "var(--text-quiet)"}}>
              {t('settings.danger.clear_modal_desc', { count: nSaves })}
            </div>
            <div style={{marginTop: 14}}>
              <label style={{fontSize: 12.5, color: "var(--text-quiet)", display: "block", marginBottom: 6}}>
                {t('settings.danger.clear_confirm_label')} <strong style={{color: "var(--danger)"}}>{t('settings.danger.clear_confirm_word')}</strong> {t('settings.danger.clear_confirm_suffix')}
              </label>
              <input
                className="pl-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={t('settings.danger.clear_confirm_word')}
                autoFocus
                style={{width: "100%", boxSizing: "border-box"}}
              />
            </div>
            {clearProgress && (
              <div style={{marginTop: 10, fontSize: 12.5, color: "var(--text-quiet)"}}>
                {t('settings.danger.clear_progress', { done: clearProgress.done, total: clearProgress.total })}
                <div style={{height: 4, background: "var(--bg-deep)", borderRadius: 2, marginTop: 6}}>
                  <div style={{
                    height: "100%",
                    width: `${Math.round(clearProgress.done / clearProgress.total * 100)}%`,
                    background: "var(--danger)",
                    borderRadius: 2,
                    transition: "width 0.2s",
                  }} />
                </div>
              </div>
            )}
        </Modal>
      )}
    </SetGroup>
  );
}

export {
  DangerSection,
};
