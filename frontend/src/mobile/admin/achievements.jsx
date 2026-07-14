/* MobileAdmin — SectionAchievements(admin-achievements)。纯机械从 pages/MobileAdmin.jsx 拆出,逐字节等价。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { LoadingRow, ErrRow, EmptyRow } from './shared.jsx';
import { ConfirmSheet } from './sheets.jsx';

/* ══════════════════════════════════════════
   Section: admin-achievements
══════════════════════════════════════════ */
function SectionAchievements({ nav }) {
  const { t } = useTranslation();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [disableTarget, setDisableTarget] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try { const r = await window.api.admin.achievements.list(); setItems(r.items || r || []); }
    catch (e) { setErr(e?.message || t('mobile.admin.load_failed')); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function doDisable() {
    if (!disableTarget) return;
    setBusy(true);
    try {
      await window.api.admin.achievements.remove(disableTarget.id);
      nav.toast(t('mobile.admin.achievements.disabled'), 'ok');
      setDisableTarget(null);
      load();
    } catch (e) { nav.toast(t('mobile.admin.action_failed', { msg: e?.message || '' }), 'danger'); }
    finally { setBusy(false); }
  }

  const tierColor = { bronze: '#cd7f32', silver: '#a8a9ad', gold: '#ffd700' };

  return (
    <>
      <div className="pl-head">
        <button className="pl-headbtn" onClick={() => nav.go('admin')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title"><strong style={{ fontSize: 15 }}>{t('mobile.admin.section.achievements')}</strong><span className="sub">{items.length > 0 ? t('mobile.admin.achievements.count', { count: items.length }) : ''}</span></div>
        <button className="pl-headbtn" onClick={load} disabled={loading}><Icon name="refresh" size={18} /></button>
      </div>
      <div className="pl-body tabbed">
        <div className="pl-pad">
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{t('mobile.admin.achievements.hint')}</div>

          {loading ? <LoadingRow /> : err ? <ErrRow msg={err} onRetry={load} /> : items.length === 0 ? <EmptyRow text={t('mobile.admin.achievements.empty')} /> : (
            <div className="pl-sec">
              {items.map((a) => (
                <div key={a.id} className="pl-row" style={{ cursor: 'default' }}>
                  <span style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', fontSize: 20, flex: 'none' }}>{a.icon || '🏆'}</span>
                  <span className="pl-row-tx">
                    <strong style={{ fontSize: 13 }}>
                      {a.name}
                      {a.tier && <span style={{ fontSize: 10, marginLeft: 6, color: tierColor[a.tier] || 'var(--muted)' }}>{a.tier}</span>}
                    </strong>
                    <span className="mono">{a.id} · {a.category}{a.hidden ? ` · ${t('mobile.admin.achievements.hidden')}` : ''} · {a.enabled ? <span style={{ color: 'var(--ok)' }}>{t('common.enabled')}</span> : <span style={{ color: 'var(--muted)' }}>{t('common.disabled')}</span>}</span>
                  </span>
                  {a.enabled && (
                    <button style={{ fontSize: 12, color: 'var(--danger)', padding: '4px 8px', flex: 'none' }} onClick={() => setDisableTarget(a)}>{t('mobile.admin.achievements.disable_btn')}</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {disableTarget && (
        <ConfirmSheet
          title={t('mobile.admin.achievements.disable_title', { name: disableTarget.name })}
          body={t('mobile.admin.achievements.disable_body')}
          confirmLabel={t('mobile.admin.achievements.disable_confirm')} danger
          busy={busy} onConfirm={doDisable} onCancel={() => setDisableTarget(null)}
        />
      )}
    </>
  );
}

export { SectionAchievements };
