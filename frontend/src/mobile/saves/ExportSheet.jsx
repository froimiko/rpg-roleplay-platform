/* Extracted from pages/MobileSaves.jsx — mechanical split, byte-for-byte. */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { API } from './helpers.js';

/* ── 导出弹窗 ────────────────────────────────────────────── */
function ExportSheet({ open, save, onClose, onToast }) {
  const { t } = useTranslation();
  const [tier, setTier] = useState('no_vectors');
  const [estimate, setEstimate] = useState(null);
  const [estLoading, setEstLoading] = useState(false);

  useEffect(() => {
    if (!open || !save?.id) return;
    let dead = false;
    setEstimate(null); setEstLoading(true);
    fetch(`${API()}/api/v1/saves/${save.id}/export/estimate`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (dead) return;
        if (d?.tiers) { setEstimate(d); if (d.default_tier) setTier(d.default_tier); }
      })
      .catch(() => {})
      .finally(() => { if (!dead) setEstLoading(false); });
    return () => { dead = true; };
  }, [open, save?.id]);

  if (!open || !save) return null;

  const fmtBytes = (b) => {
    if (b == null) return estLoading ? t('mobile.saves.export.estimating') : t('common.unknown');
    const mb = b / (1024 * 1024);
    if (mb >= 0.1) return (mb < 10 ? mb.toFixed(1) : Math.round(mb)) + ' MB';
    return Math.round(b / 1024) + ' KB';
  };
  const sizeOf = (k) => estimate?.tiers ? fmtBytes(estimate.tiers[k]) : (estLoading ? t('mobile.saves.export.estimating') : '—');

  const doDownload = () => {
    const safe = (save.title || 'save').replace(/[^\w一-鿿]+/g, '_');
    const a = document.createElement('a');
    a.href = `${API()}/api/v1/saves/${save.id}/export/bundle?tier=${tier}`;
    a.download = `save-${save.id}-${safe}-${tier}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    onClose();
    onToast(t('mobile.saves.export.started'), 'ok');
  };

  const TIERS = [
    { key: 'no_vectors', label: t('mobile.saves.export.tier_standard'), desc: t('mobile.saves.export.tier_standard_desc'), isDefault: estimate?.default_tier === 'no_vectors' || !estimate },
    { key: 'full',       label: t('mobile.saves.export.tier_full'),     desc: t('mobile.saves.export.tier_full_desc'),     isDefault: estimate?.default_tier === 'full' },
  ];

  return (
    <div className="sheet-wrap show" onClick={onClose}>
      <div className="sheet-scrim" />
      <div className="sheet" style={{ maxHeight: '70%' }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">{t('mobile.saves.export.title')}</div>
        <div className="sheet-sub">{t('mobile.saves.export.subtitle')}</div>
        <div style={{ display: 'grid', gap: 9, marginBottom: 16 }}>
          {TIERS.map(({ key, label, desc, isDefault }) => {
            const sel = tier === key;
            return (
              <label key={key} style={{
                display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 12,
                padding: '12px 14px', borderRadius: 12,
                border: sel ? '1px solid var(--accent-edge)' : '1px solid var(--line-soft)',
                background: sel ? 'var(--accent-soft)' : 'var(--panel)',
                cursor: 'pointer', alignItems: 'start',
              }}>
                <input type="radio" name="export-tier" value={key} checked={sel}
                  onChange={() => setTier(key)}
                  style={{ marginTop: 3, accentColor: 'var(--accent)' }} />
                <div style={{ display: 'grid', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
                    {label}
                    {isDefault && (
                      <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 99,
                        background: 'var(--ok-soft)', color: 'var(--ok)',
                        border: '1px solid rgba(126,184,142,0.3)', fontWeight: 600,
                      }}>{t('mobile.saves.export.recommended')}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-2)', whiteSpace: 'nowrap', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                  {sizeOf(key)}
                </div>
              </label>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <button className="sheet-btn" onClick={onClose} style={{ flex: 1 }}>{t('common.cancel')}</button>
          <button className="sheet-btn primary" onClick={doDownload} style={{ flex: 2 }}>
            <Icon name="download" size={16} /> {t('mobile.saves.export.download_btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ExportSheet };
