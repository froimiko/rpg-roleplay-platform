/* MobileAdmin — SectionUsers(admin-users)。纯机械从 pages/MobileAdmin.jsx 拆出,逐字节等价。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { LoadingRow, ErrRow, EmptyRow, fmtDate } from './shared.jsx';
import { ConfirmSheet } from './sheets.jsx';

/* ══════════════════════════════════════════
   Section: admin-users
══════════════════════════════════════════ */
function SectionUsers({ nav }) {
  const { t } = useTranslation();
  const [users, setUsers] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [roleFilter, setRoleFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [confirm, setConfirm] = React.useState(null); // { action, user, title, body }
  const [busy, setBusy] = React.useState(false);
  const me = window.RPG_AUTH?.user;
  const LIMIT = 20;

  const load = React.useCallback(async (p = 1) => {
    setLoading(true); setErr(null);
    try {
      const params = { page: p, limit: LIMIT };
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await window.api.admin.users(params);
      setUsers(res.users || res.items || res || []);
      setTotal(res.total || (res.users || res.items || res || []).length);
      setPage(p);
    } catch (e) { setErr(e?.message || t('mobile.admin.load_failed')); }
    finally { setLoading(false); }
  }, [search, roleFilter, statusFilter]);

  React.useEffect(() => { load(1); }, [roleFilter, statusFilter]);

  async function doAction() {
    if (!confirm) return;
    setBusy(true);
    try {
      const { action, user } = confirm;
      if (action === 'deactivate') await window.api.admin.deactivateUser(user.id);
      else if (action === 'reactivate') await window.api.admin.reactivateUser(user.id);
      else if (action === 'force-logout') await window.api.admin.forceLogout(user.id);
      else if (action === 'set-admin') await window.api.admin.updateUser(user.id, { role: 'admin' });
      else if (action === 'set-user') await window.api.admin.updateUser(user.id, { role: 'user' });
      nav.toast(t('mobile.admin.action_success'), 'ok');
      setConfirm(null);
      load(page);
    } catch (e) { nav.toast(t('mobile.admin.action_failed', { msg: e?.message || '' }), 'danger'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="pl-head">
        <button className="pl-headbtn" onClick={() => nav.go('admin')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title"><strong style={{ fontSize: 15 }}>{t('mobile.admin.section.users')}</strong><span className="sub">{total > 0 ? t('mobile.admin.users.total', { count: total }) : ''}</span></div>
        <button className="pl-headbtn" onClick={() => load(page)} disabled={loading}><Icon name="refresh" size={18} /></button>
      </div>
      <div className="pl-body tabbed">
        <div className="pl-pad">
          {/* 搜索 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              type="search"
              placeholder={t('mobile.admin.users.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(1); }}
              style={{ flex: 1, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }}
            />
            <button className="pl-btn-primary" style={{ padding: '0 14px', height: 38 }} onClick={() => load(1)}>{t('mobile.admin.search')}</button>
          </div>
          {/* 过滤 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {[['', t('mobile.admin.users.role_all')], ['admin', t('mobile.admin.users.role_admin')], ['user', t('mobile.admin.users.role_user')]].map(([v, l]) => (
              <button key={v} onClick={() => setRoleFilter(v)}
                style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, border: '1px solid', borderColor: roleFilter === v ? 'var(--accent-edge)' : 'var(--line)', background: roleFilter === v ? 'var(--accent-soft)' : 'var(--panel-2)', color: roleFilter === v ? 'var(--accent)' : 'var(--muted)' }}>
                {l}
              </button>
            ))}
            {[['', t('mobile.admin.users.status_all')], ['active', t('mobile.admin.users.status_active')], ['deactivated', t('mobile.admin.users.status_deactivated')]].map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, border: '1px solid', borderColor: statusFilter === v ? 'var(--accent-edge)' : 'var(--line)', background: statusFilter === v ? 'var(--accent-soft)' : 'var(--panel-2)', color: statusFilter === v ? 'var(--accent)' : 'var(--muted)' }}>
                {l}
              </button>
            ))}
          </div>

          {loading ? <LoadingRow /> : err ? <ErrRow msg={err} onRetry={() => load(page)} /> : users.length === 0 ? <EmptyRow text={t('mobile.admin.users.empty')} /> : (
            <div className="pl-sec">
              {users.map((u) => {
                const isSelf = me && (me.id === u.id || me.username === u.username);
                const isAdmin = u.role === 'admin';
                const isDeact = !!u.deactivated_at;
                return (
                  <div key={u.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 12, background: 'var(--panel)', marginBottom: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px' }}>
                      <span className={`pl-row-ic ${isAdmin ? 'accent' : ''}`}><Icon name="user" size={17} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          @{u.username || '—'} {isSelf && <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{t('mobile.admin.users.me_label')}</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted-2)', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                          <span style={{ color: isAdmin ? 'var(--accent)' : 'var(--muted)' }}>{isAdmin ? 'admin' : 'user'}</span>
                          <span>·</span>
                          <span style={{ color: isDeact ? 'var(--danger)' : 'var(--ok)' }}>{isDeact ? t('mobile.admin.users.status_deactivated') : t('mobile.admin.users.status_active')}</span>
                          {u.last_login_at && <><span>·</span><span>{fmtDate(u.last_login_at)}</span></>}
                        </div>
                      </div>
                    </div>
                    {!isSelf && (
                      <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--line-soft)' }}>
                        {!isDeact ? (
                          <button style={{ flex: 1, padding: '9px 4px', fontSize: 12, color: 'var(--danger)', borderRight: '1px solid var(--line-soft)' }}
                            onClick={() => setConfirm({ action: 'deactivate', user: u, title: t('mobile.admin.users.deactivate_title', { username: u.username }), body: t('mobile.admin.users.deactivate_body') })}>
                            {t('mobile.admin.users.deactivate_btn')}
                          </button>
                        ) : (
                          <button style={{ flex: 1, padding: '9px 4px', fontSize: 12, color: 'var(--ok)', borderRight: '1px solid var(--line-soft)' }}
                            onClick={() => setConfirm({ action: 'reactivate', user: u, title: t('mobile.admin.users.reactivate_title', { username: u.username }), body: t('mobile.admin.users.reactivate_body') })}>
                            {t('mobile.admin.users.reactivate_btn')}
                          </button>
                        )}
                        <button style={{ flex: 1, padding: '9px 4px', fontSize: 12, color: 'var(--warn)', borderRight: '1px solid var(--line-soft)' }}
                          onClick={() => setConfirm({ action: 'force-logout', user: u, title: t('mobile.admin.users.force_logout_title', { username: u.username }), body: t('mobile.admin.users.force_logout_body') })}>
                          {t('mobile.admin.users.force_logout_btn')}
                        </button>
                        {!isAdmin ? (
                          <button style={{ flex: 1, padding: '9px 4px', fontSize: 12, color: 'var(--accent)' }}
                            onClick={() => setConfirm({ action: 'set-admin', user: u, title: t('mobile.admin.users.set_admin_title'), body: t('mobile.admin.users.set_admin_body', { username: u.username }) })}>
                            {t('mobile.admin.users.set_admin_btn')}
                          </button>
                        ) : (
                          <button style={{ flex: 1, padding: '9px 4px', fontSize: 12, color: 'var(--muted)' }}
                            onClick={() => setConfirm({ action: 'set-user', user: u, title: t('mobile.admin.users.demote_title'), body: t('mobile.admin.users.demote_body', { username: u.username }) })}>
                            {t('mobile.admin.users.demote_btn')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 分页 */}
          {!loading && !err && users.length > 0 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <button className="pl-btn-ghost" disabled={page <= 1} onClick={() => load(page - 1)} style={{ padding: '6px 16px', fontSize: 13 }}>{t('mobile.admin.prev_page')}</button>
              <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: '34px' }}>{t('mobile.admin.page_n', { n: page })}</span>
              <button className="pl-btn-ghost" disabled={users.length < LIMIT} onClick={() => load(page + 1)} style={{ padding: '6px 16px', fontSize: 13 }}>{t('mobile.admin.next_page')}</button>
            </div>
          )}
        </div>
      </div>

      {confirm && (
        <ConfirmSheet
          title={confirm.title} body={confirm.body}
          danger={['deactivate', 'force-logout', 'set-user'].includes(confirm.action)}
          busy={busy} onConfirm={doAction} onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

export { SectionUsers };
