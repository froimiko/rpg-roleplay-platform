/* Extracted from pages/MobileCaps.jsx — mechanical split, byte-for-byte. */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { Toggle, StatusPill } from './shared.jsx';

/* ──────────────────────────────────────────────────────────────────
   PLUGINS
   ────────────────────────────────────────────────────────────────── */
function PluginsSection({ toast }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await window.api.tools.list();
      const tl = (r && r.tools) || {};
      setItems((tl.plugins || []).map(p => ({
        id: p.id || p.name,
        name: p.name || p.id,
        desc: p.description || t('mobile.caps.plugins.builtin_desc'),
        tag: p.kind || 'plugin',
        on: p.enabled !== false,
      })));
    } catch (e) {
      setErr(e?.message || t('mobile.caps.error.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  if (loading && items.length === 0) return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)' }}>{t('common.loading')}</div>
  );
  if (err) return (
    <div style={{ margin: '16px', padding: '12px 14px', borderRadius: 12, background: 'var(--danger-soft)', border: '1px solid rgba(200,103,93,0.3)', color: 'var(--danger)', fontSize: 13 }}>
      {err}
      <button className="pl-btn-ghost" style={{ marginTop: 10, height: 38 }} onClick={load}>{t('mobile.caps.error.retry')}</button>
    </div>
  );
  if (items.length === 0) return (
    <div className="pl-empty">
      <div className="ic"><Icon name="plug" size={22} /></div>
      <h3>{t('mobile.caps.plugins.empty_title')}</h3>
      <p>{t('mobile.caps.plugins.empty_desc')}</p>
    </div>
  );

  return (
    <div className="pl-pad">
      <div className="pl-sec-head" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>{t('mobile.caps.tab.plugins')}</h2>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('mobile.caps.plugins.count', { total: items.length, enabled: items.filter(i => i.on).length })}</span>
      </div>
      <div style={{ display: 'grid', gap: 9 }}>
        {items.map((it) => (
          <div key={it.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 14, background: 'var(--panel)', padding: '13px 14px', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="pl-row-ic" style={{ width: 36, height: 36, borderRadius: 10 }}>
                <Icon name="plug" size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{it.tag}</div>
              </div>
              <Toggle on={it.on} onChange={() => toast(t('mobile.caps.plugins.managed_by_platform'), 'warn')} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>{it.desc}</div>
            <StatusPill on={it.on} label={it.on ? t('common.enabled') : t('common.disabled')} />
          </div>
        ))}
      </div>
    </div>
  );
}

export { PluginsSection };
