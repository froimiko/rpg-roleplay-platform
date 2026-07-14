/* MobileAdmin — SectionFeedback(admin-feedback)。纯机械从 pages/MobileAdmin.jsx 拆出,逐字节等价。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { LoadingRow, ErrRow, EmptyRow, fmtTime } from './shared.jsx';

/* ══════════════════════════════════════════
   Section: admin-feedback
══════════════════════════════════════════ */
function SectionFeedback({ nav }) {
  const { t } = useTranslation();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState('unreviewed');
  const [detail, setDetail] = React.useState(null);
  const [replyText, setReplyText] = React.useState('');
  const [actionBusy, setActionBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/admin/feedback?status=${encodeURIComponent(statusFilter)}&limit=50`, { credentials: 'include' });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.detail || data.error || `HTTP ${r.status}`);
      setItems(data.items || []);
    } catch (e) { setErr(e?.message || t('mobile.admin.load_failed')); }
    finally { setLoading(false); }
  }, [statusFilter]);

  React.useEffect(() => { load(); }, [load]);

  async function doDecision(id, decision, notes = '') {
    setActionBusy(true);
    try {
      const r = await fetch(`/api/admin/feedback/${id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ decision, notes }) });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.detail || data.error || `HTTP ${r.status}`);
      nav.toast(t('mobile.admin.processed'), 'ok');
      setDetail(null);
      load();
    } catch (e) { nav.toast(t('mobile.admin.action_failed', { msg: e?.message || '' }), 'danger'); }
    finally { setActionBusy(false); }
  }

  async function doReply(id, reply) {
    setActionBusy(true);
    try {
      const r = await fetch(`/api/admin/feedback/${id}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ reply }) });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.detail || data.error || `HTTP ${r.status}`);
      nav.toast(reply ? t('mobile.admin.feedback.reply_sent') : t('mobile.admin.feedback.reply_withdrawn'), 'ok');
      setDetail((d) => d ? { ...d, admin_reply: reply || null } : d);
    } catch (e) { nav.toast(t('mobile.admin.feedback.reply_failed', { msg: e?.message || '' }), 'danger'); }
    finally { setActionBusy(false); }
  }

  const decisionColor = { ok: 'var(--ok)', nsfw_terminate: 'var(--danger)', spam: 'var(--warn)' };
  const decisionLabel = { ok: 'OK', nsfw_terminate: t('mobile.admin.feedback.decision_terminate'), spam: t('mobile.admin.feedback.decision_spam') };

  return (
    <>
      <div className="pl-head">
        <button className="pl-headbtn" onClick={detail ? () => setDetail(null) : () => nav.go('admin')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title"><strong style={{ fontSize: 15 }}>{detail ? t('mobile.admin.feedback.detail_title', { id: detail.id }) : t('mobile.admin.section.feedback')}</strong></div>
        {!detail && <button className="pl-headbtn" onClick={load} disabled={loading}><Icon name="refresh" size={18} /></button>}
      </div>

      {detail ? (
        /* 详情页 */
        <div className="pl-body tabbed">
          <div className="pl-pad">
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 4 }}>{t('mobile.admin.feedback.submitter_label')}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text)' }}>@{detail.username || '—'} · {fmtTime(detail.created_at)}</div>
              {detail.review_decision && (
                <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--panel-3)', color: decisionColor[detail.review_decision] || 'var(--muted)' }}>
                  {decisionLabel[detail.review_decision] || detail.review_decision}
                </span>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>{t('mobile.admin.feedback.content_label')}</div>
              <div style={{ background: 'var(--panel-2)', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-quiet)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {detail.free_text || t('mobile.admin.feedback.no_content')}
              </div>
            </div>

            {/* 回复 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>{t('mobile.admin.feedback.reply_label')}</div>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
                placeholder={t('mobile.admin.feedback.reply_placeholder')}
                style={{ width: '100%', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <button className="pl-btn-ghost" style={{ marginTop: 8, fontSize: 13 }} onClick={() => doReply(detail.id, replyText.trim())} disabled={actionBusy}>
                {detail.admin_reply ? t('mobile.admin.feedback.update_reply') : t('mobile.admin.feedback.send_reply')}
              </button>
            </div>

            {/* 审核操作 */}
            {!detail.review_decision && (
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>{t('mobile.admin.feedback.review_heading')}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="pl-btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => doDecision(detail.id, 'spam')} disabled={actionBusy}>{t('mobile.admin.feedback.decision_spam')}</button>
                  <button className="pl-btn-primary" style={{ flex: 1, fontSize: 13 }} onClick={() => doDecision(detail.id, 'ok')} disabled={actionBusy}>{t('mobile.admin.feedback.mark_ok')}</button>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', margin: '12px 0 6px' }}>{t('mobile.admin.feedback.terminate_notice')}</div>
                <button style={{ width: '100%', padding: '10px', borderRadius: 12, background: 'var(--danger-soft)', border: '1px solid rgba(200,103,93,0.4)', color: 'var(--danger)', fontSize: 13 }}
                  onClick={async () => { const reason = await window.__prompt({ title: t('mobile.admin.feedback.terminate_prompt') }); if (reason) doDecision(detail.id, 'nsfw_terminate', reason); }}>
                  {t('mobile.admin.feedback.terminate_btn')}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 列表 */
        <div className="pl-body tabbed">
          <div className="pl-pad">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['unreviewed', t('mobile.admin.feedback.status_unreviewed')], ['reviewed', t('mobile.admin.feedback.status_reviewed')], ['all', t('common.all')]].map(([v, l]) => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 999, fontSize: 12, border: '1px solid', borderColor: statusFilter === v ? 'var(--accent-edge)' : 'var(--line)', background: statusFilter === v ? 'var(--accent-soft)' : 'var(--panel-2)', color: statusFilter === v ? 'var(--accent)' : 'var(--muted)' }}>
                  {l}
                </button>
              ))}
            </div>

            {loading ? <LoadingRow /> : err ? <ErrRow msg={err} onRetry={load} /> : items.length === 0 ? <EmptyRow text={t('mobile.admin.feedback.empty')} /> : (
              <div className="pl-sec">
                {items.map((f) => (
                  <button key={f.id} className="pl-row" onClick={() => { setDetail(f); setReplyText(f.admin_reply || ''); }}>
                    <span className={`pl-row-ic ${!f.review_decision ? 'warn' : 'ok'}`}><Icon name="feedback" size={17} /></span>
                    <span className="pl-row-tx">
                      <strong style={{ fontSize: 13 }}>@{f.username || '—'} <span className="mono" style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--muted-2)' }}>#{f.id}</span></strong>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(f.free_text || '').slice(0, 60) || t('mobile.admin.feedback.no_content_short')}</span>
                    </span>
                    <span className="pl-row-chev"><Icon name="chevron_right" size={17} /></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export { SectionFeedback };
