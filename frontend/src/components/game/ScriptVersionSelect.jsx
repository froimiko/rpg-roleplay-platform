/* Game Console 顶栏 script 版本切换下拉(ScriptVersionSelect)——
   纯机械从 entries/game-console.jsx 搬出,DOM/视觉/行为零变化。 */
import React from 'react';
import { useTranslation } from 'react-i18next';

// ---- Script Version Select — 顶栏当前 script 版本切换 dropdown ----
// 调 GET /api/scripts/{id}/commits?limit=10 拉最近 10 个 commit;
// 选中后调 POST /api/scripts/{id}/checkout/{commit_id}(stub, 返 501 时提示)。
function ScriptVersionSelect({ scriptId, headCommitId }) {
  const { t } = useTranslation();
  const [commits, setCommits] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!scriptId) return;
    (async () => {
      try {
        const r = await window.api.scripts.commits(scriptId, { limit: 10 });
        const list = Array.isArray(r) ? r : (r?.items || r?.commits || []);
        setCommits(list);
      } catch (_) {}
    })();
  }, [scriptId]);

  if (!scriptId || commits.length === 0) return null;

  const headShort = headCommitId ? headCommitId.slice(0, 8) : '—';

  const onCheckout = async (commitId) => {
    setOpen(false);
    if (!commitId || commitId === headCommitId) return;
    setBusy(true);
    try {
      const r = await window.api.scripts.checkout(scriptId, commitId);
      if (r && r.status === 501) {
        window.__apiToast?.(t('game.console.version.checkout_not_impl'), { kind: 'warn', duration: 3000 });
      } else {
        window.__apiToast?.(t('game.console.version.switched', { sha: commitId.slice(0, 8) }), { kind: 'ok', duration: 2000 });
      }
    } catch (e) {
      const detail = e?.message || '';
      if (detail.includes('501') || detail.includes('not impl') || detail.includes('Not Implemented')) {
        window.__apiToast?.(t('game.console.version.checkout_not_impl'), { kind: 'warn', duration: 3000 });
      } else {
        window.__apiToast?.(t('game.console.version.switch_failed'), { kind: 'danger', detail });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', marginLeft: 8 }}>
      <button
        className="btn ghost"
        style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4, opacity: busy ? 0.6 : 1 }}
        onClick={() => setOpen(v => !v)}
        title={t('game.console.version.switch_tip')}
        disabled={busy}
      >
        <span>HEAD · {headShort}</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1499 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 1500, marginTop: 4,
            background: 'var(--panel, #1a1d22)', border: '1px solid var(--line-soft)',
            borderRadius: 6, minWidth: 280, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--muted)', borderBottom: '1px solid var(--line-soft)' }}>
              {t('game.console.version.header', { count: commits.length })}
            </div>
            {commits.map((c) => {
              const isCurrent = headCommitId && c.id === headCommitId;
              return (
                <button
                  key={c.id}
                  className="btn ghost"
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', padding: '6px 10px', borderRadius: 0, gap: 8,
                    background: isCurrent ? 'var(--accent-soft, rgba(212,164,94,0.12))' : 'transparent',
                    fontWeight: isCurrent ? 600 : 400, borderBottom: '1px solid var(--line-soft)',
                    opacity: isCurrent ? 1 : 0.6, cursor: isCurrent ? 'pointer' : 'not-allowed',
                  }}
                  onClick={() => onCheckout(c.id)}
                  disabled={!isCurrent}
                  title={!isCurrent ? t('game.console.version.checkout_unavailable') : undefined}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: isCurrent ? 'var(--accent)' : 'inherit' }}>
                    {(c.id || '').slice(0, 8)}
                  </span>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.message || c.kind || '—'}
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: 10, color: 'var(--ok)', flexShrink: 0 }}>HEAD</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export { ScriptVersionSelect };
