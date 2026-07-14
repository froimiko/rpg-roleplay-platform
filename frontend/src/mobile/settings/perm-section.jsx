import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { lsSetJSON } from '../../lib/storage.js';
import { SetGroup, usePrefSave } from './shared.jsx';

/* ────────────────────────────────────────────────────────────────── */
/* SECTION: 权限 (permissions)                                         */
/* ────────────────────────────────────────────────────────────────── */
const HIGH_RISK_ALL = ['timeline.pending_jump','player.background','world.constraints','relationships.*.tone'];
const CUSTOM_WL_RE = /^[a-zA-Z_][a-zA-Z0-9_.*]*$/;

function PermissionsSection({ nav }) {
  const { t } = useTranslation();
  const save = usePrefSave('perm');
  const [mode, setMode] = useState('review');
  const [whitelist, setWhitelist] = useState(['timeline.pending_jump','player.background','world.constraints']);
  const [custom, setCustom] = useState([]);
  const [customInput, setCustomInput] = useState('');
  const [customErr, setCustomErr] = useState('');
  // 审计日志
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditErr, setAuditErr] = useState('');
  const [auditFilter, setAuditFilter] = useState('all');
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await window.api.account.profile();
        if (cancelled) return;
        const p = (r && r.preferences) || {};
        const v = p['perm.default_mode'] || p.default_perm_mode;
        if (v) setMode(v);
        const wl = p['perm.high_risk_whitelist'];
        if (Array.isArray(wl)) setWhitelist(wl);
        const cwl = p['permissions.custom_whitelist'];
        if (Array.isArray(cwl)) setCustom(cwl);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleWhitelist = (field) => {
    const next = whitelist.includes(field) ? whitelist.filter(f => f!==field) : [...whitelist, field];
    setWhitelist(next); save('high_risk_whitelist', next);
  };

  const saveCustom = async (next) => {
    setCustom(next);
    try { await window.api.account.preferences({ 'permissions.custom_whitelist': next }); } catch (_) {}
    lsSetJSON('perm.custom_whitelist', next);
  };

  const addCustom = () => {
    const val = customInput.trim();
    if (!val) { setCustomErr(t('mobile.settings.perm.custom_err_empty')); return; }
    if (val.length > 80) { setCustomErr(t('mobile.settings.perm.custom_err_too_long')); return; }
    if (!CUSTOM_WL_RE.test(val)) { setCustomErr(t('mobile.settings.perm.custom_err_format')); return; }
    if (HIGH_RISK_ALL.includes(val)) { setCustomErr(t('mobile.settings.perm.custom_err_builtin')); return; }
    if (custom.includes(val)) { setCustomErr(t('mobile.settings.perm.custom_err_exists')); return; }
    saveCustom([...custom, val]);
    setCustomInput(''); setCustomErr('');
  };

  const loadAudit = useCallback(async () => {
    setAuditLoading(true); setAuditErr('');
    try {
      const s = await window.api.game.state();
      const perms = (s && (s.permissions || s.state?.permissions)) || {};
      const log = Array.isArray(perms.audit_log) ? perms.audit_log : [];
      setAuditEntries(log.slice().reverse());
    } catch (e) { setAuditErr(e?.message || t('mobile.settings.perm.load_failed')); }
    finally { setAuditLoading(false); }
  }, []);

  const KIND_META = {
    write:            { label: t('mobile.settings.perm.kind_write'), color:'var(--ok)' },
    parse_error:      { label: t('mobile.settings.perm.kind_parse_error'), color:'var(--warn)' },
    rejected:         { label: t('mobile.settings.perm.kind_rejected'), color:'var(--danger)' },
    hard_forbidden:   { label: t('mobile.settings.perm.kind_hard_forbidden'), color:'var(--danger)' },
    extractor_error:  { label: t('mobile.settings.perm.kind_extractor_error'), color:'var(--warn)' },
    set_parser_error: { label: t('mobile.settings.perm.kind_set_parser_error'), color:'var(--warn)' },
    clarify_yield:    { label: t('mobile.settings.perm.kind_clarify_yield'), color:'var(--ok)' },
    acceptance_unmet: { label: t('mobile.settings.perm.kind_acceptance_unmet'), color:'var(--warn)' },
    question_skip:    { label: t('mobile.settings.perm.kind_question_skip'), color:'var(--muted)' },
  };
  const filteredAudit = auditFilter==='all' ? auditEntries : auditEntries.filter(e => e.kind===auditFilter);

  return (
    <>
      {/* 默认权限模式 */}
      <SetGroup title={t('mobile.settings.perm.gm_write_perm')}>
        <div className="pl-setrow">
          <div className="pl-setrow-tx">
            <strong>{t('mobile.settings.perm.default_mode')}</strong>
            <span>{t('mobile.settings.perm.default_mode_desc')}</span>
          </div>
        </div>
        <div style={{ padding: '8px 13px 13px' }}>
          <div className="pl-seg2">
            {[['default',t('mobile.settings.perm.mode_default')],['review',t('mobile.settings.perm.mode_review')],['full_access',t('mobile.settings.perm.mode_full_access')]].map(([id, l]) => (
              <button key={id} className={mode===id?'active accent':''} onClick={() => { setMode(id); save('default_mode',id); }}>{l}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 8, lineHeight: 1.5 }}>
            {mode==='review' ? t('mobile.settings.perm.mode_review_hint') : mode==='full_access' ? t('mobile.settings.perm.mode_full_access_hint') : t('mobile.settings.perm.mode_default_hint')}
          </div>
        </div>

        {/* 高风险字段白名单 */}
        <div className="pl-setrow" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <strong>{t('mobile.settings.perm.high_risk_whitelist')}</strong>
            <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 2 }}>{t('mobile.settings.perm.high_risk_whitelist_desc')}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {HIGH_RISK_ALL.map(field => (
              <button
                key={field}
                className={whitelist.includes(field) ? 'pill accent' : 'pill'}
                onClick={() => toggleWhitelist(field)}
                style={{ cursor: 'pointer', fontSize: 11, height: 28, transition: 'all .15s' }}
              >
                {field}
              </button>
            ))}
          </div>
        </div>

        {/* 自定义白名单 */}
        <div className="pl-setrow" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <strong>{t('mobile.settings.perm.custom_whitelist')}</strong>
            <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 2 }}>
              {t('mobile.settings.perm.custom_whitelist_format_prefix')} <span className="mono">player.hp</span> {t('mobile.settings.perm.custom_whitelist_format_or')} <span className="mono">world.*</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <input
              className="pl-input"
              style={{ flex: 1, height: 40, fontSize: 13 }}
              value={customInput}
              placeholder="player.custom_field"
              onChange={(e) => { setCustomInput(e.target.value); if (customErr) setCustomErr(''); }}
              onKeyDown={(e) => { if (e.key==='Enter') { e.preventDefault(); addCustom(); } }}
            />
            <button className="pl-btn-primary" style={{ height: 40, width: 64, fontSize: 13, flexShrink: 0 }} onClick={addCustom}>
              <Icon name="plus" size={14} />
            </button>
          </div>
          {customErr && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: -4 }}>{customErr}</div>}
          {custom.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {custom.map(entry => (
                <div key={entry} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line-soft)',
                  background: 'var(--panel-2)', fontSize: 12.5, fontFamily: 'var(--font-mono)',
                }}>
                  {entry}
                  <button
                    onClick={() => saveCustom(custom.filter(e => e!==entry))}
                    style={{ color: 'var(--danger)', fontSize: 14, lineHeight: 1, padding: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {custom.length===0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('mobile.settings.perm.no_custom_entries')}</span>}
        </div>
      </SetGroup>

      {/* 审计日志 */}
      <div className="pl-sec" style={{ marginTop: 18 }}>
        <div className="pl-sec-head">
          <h2>{t('mobile.settings.perm.audit_log')}</h2>
          <button className="act" onClick={() => { if (!showAudit) loadAudit(); setShowAudit(v => !v); }}>
            {showAudit ? t('mobile.settings.common.collapse') : t('mobile.settings.common.expand')} <Icon name={showAudit ? 'chevron_up' : 'chevron_down'} size={13} />
          </button>
        </div>
        {showAudit && (
          <div style={{ fontSize: 11, color: 'var(--muted-2)', padding: '0 0 8px', lineHeight: 1.5 }}>
            {t('mobile.settings.perm.audit_scope_note', '仅显示最近活动会话的操作记录，无活动游戏时可能为空。')}
          </div>
        )}
        {showAudit && (
          <div className="pl-card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <button className="pl-btn-ghost" style={{ height: 36, fontSize: 12, flex: 1 }}
                disabled={auditLoading} onClick={loadAudit}>
                <Icon name="refresh" size={13} /> {auditLoading ? t('common.loading') : t('mobile.settings.perm.refresh_log')}
              </button>
            </div>
            {auditErr && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{auditErr}</div>}

            {/* 类型筛选 */}
            {auditEntries.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {['all', ...Object.keys(KIND_META)].map(k => {
                  const count = k==='all' ? auditEntries.length : auditEntries.filter(e => e.kind===k).length;
                  if (k!=='all' && count===0) return null;
                  return (
                    <button key={k} onClick={() => setAuditFilter(k)}
                      className={auditFilter===k ? 'pill accent' : 'pill'}
                      style={{ cursor: 'pointer', fontSize: 10.5, height: 26, transition: 'all .15s' }}>
                      {k==='all' ? t('common.all') : (KIND_META[k]?.label || k)} · {count}
                    </button>
                  );
                })}
              </div>
            )}

            {auditEntries.length===0 && !auditLoading && (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>
                {t('mobile.settings.perm.no_audit_log')}
              </div>
            )}

            {filteredAudit.slice(0, 30).map((e, i) => {
              const meta = KIND_META[e.kind] || { label: e.kind, color: 'var(--muted)' };
              const detail = e.path
                ? `${e.path} = ${typeof e.value==='string' ? e.value : JSON.stringify(e.value)}`
                : (e.raw_spec || e.hint || '—');
              return (
                <div key={i} style={{
                  padding: '8px 0', borderBottom: '1px solid var(--line-soft)',
                  fontSize: 11.5, display: 'grid', gap: 3,
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', padding: '2px 7px',
                      borderRadius: 5, border: `1px solid ${meta.color}`, color: meta.color,
                      fontSize: 10.5, flexShrink: 0,
                    }}>{meta.label}</span>
                    <span className="mono" style={{ color: 'var(--muted-2)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(e.ts||'').replace('T',' ').slice(0, 16)}
                    </span>
                    {e.source && <span style={{ color: 'var(--muted-2)', fontSize: 10 }}>{e.source}</span>}
                  </div>
                  <div style={{ color: 'var(--text-quiet)', lineHeight: 1.4, wordBreak: 'break-word' }}>{detail}</div>
                  {e.hint && e.path && <div style={{ color: 'var(--muted-2)', fontSize: 10.5 }}>· {e.hint}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export { PermissionsSection };
