// InviteScreen.jsx — mechanically split from login-app.jsx (JSX byte-for-byte).
// Presentational: closure-entangled submitInvite handler stays in the LoginApp shell and is passed as a prop.
import React from 'react';
import { useTranslation } from 'react-i18next';

function InviteScreen({ submitInvite, inviteUsername, setInviteUsername, invitePassword, setInvitePassword, inviteAge, setInviteAge, inviteErr, inviteBusy }) {
  const { t } = useTranslation();
  return (
      <div className="pl-auth-wrap">
        <div className="pl-auth">
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div className="pl-auth-mark" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19V5l8 4 8-4v14" /><path d="M4 14l8 4 8-4" />
              </svg>
            </div>
            <div>
              <h1>{t('auth.invite.title')}</h1>
              <div className="pl-auth-sub">{t('auth.invite.subtitle')}</div>
            </div>
          </div>
          <form className="pl-auth-form" onSubmit={submitInvite}>
            <div className="pl-field">
              <label htmlFor="inv-username">{t('auth.invite.username')}</label>
              <input id="inv-username" type="text" autoFocus autoComplete="username"
                     value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)}
                     placeholder={t('auth.invite.username_ph')} />
            </div>
            <div className="pl-field">
              <label htmlFor="inv-password">{t('auth.invite.password')}</label>
              <input id="inv-password" type="password" autoComplete="new-password"
                     value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)}
                     placeholder={t('auth.invite.password_ph')} />
            </div>
            <div className="pl-field" style={{flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6}}>
              <input id="inv-age" type="checkbox" checked={inviteAge}
                     onChange={(e) => setInviteAge(e.target.checked)}
                     style={{marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)'}} />
              <label htmlFor="inv-age" style={{fontWeight: 'normal', cursor: 'pointer', fontSize: 13}}>{t('auth.invite.age')}</label>
            </div>
            {inviteErr && (
              <div className="pl-auth-error" role="alert"
                   style={{color: 'var(--danger)', fontSize: 12.5, padding: '4px 0'}}>{inviteErr}</div>
            )}
            <button type="submit" className="btn primary" disabled={inviteBusy}
                    style={{justifyContent: 'center', height: 34, opacity: inviteBusy ? 0.7 : 1}}>
              {inviteBusy ? t('auth.submitting') : t('auth.invite.join')}
            </button>
          </form>
        </div>
      </div>
  );
}

export { InviteScreen };
