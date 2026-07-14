/* 参数(overrides)子视图 —— 从 pages/MobileScripts.jsx 拆出,逐字节不变。 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';

/* ─── 参数(overrides)子视图 ───────────────────── */
function OverridesView({ script, onBack, nav }) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [jsonValid, setJsonValid] = useState(true);

  useEffect(() => {
    if (!script) return;
    setLoading(true);
    (async () => {
      try {
        const r = await window.api.scripts.getOverrides(script.id);
        setRaw(JSON.stringify(r?.data ?? r ?? {}, null, 2));
      } catch (_) { setRaw('{}'); }
      finally { setLoading(false); }
    })();
  }, [script?.id]);

  const onChange = (v) => {
    setRaw(v);
    setDirty(true);
    try { JSON.parse(v); setJsonValid(true); } catch (_) { setJsonValid(false); }
  };

  const onSave = async () => {
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) {
      nav.toast(t('mobile.scripts.overrides.json_error', { msg: e.message }), 'danger', 'warn'); return;
    }
    setSaving(true);
    try {
      await window.api.scripts.saveOverrides(script.id, parsed);
      nav.toast(t('mobile.scripts.overrides.saved'), 'ok', 'check');
      setDirty(false);
    } catch (e) { nav.toast(e?.message || t('mobile.scripts.overrides.save_error'), 'danger', 'warn'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="pl-head">
        <button className="pl-back" onClick={onBack} aria-label={t('common.back')}><Icon name="chevron_left" size={20} /></button>
        <div className="pl-head-title center">
          <strong>{t('mobile.scripts.overrides.title')}</strong>
          <span className="sub">{script?.title}</span>
        </div>
        <div className="pl-head-actions">
          <button
            className="pl-headbtn"
            onClick={onSave}
            disabled={saving || !dirty || !jsonValid}
            style={{ color: dirty && jsonValid ? 'var(--accent)' : undefined }}
          >
            <Icon name="save" size={18} />
          </button>
        </div>
      </div>
      <div className="pl-body tabbed">
        <div className="pl-pad">
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65, marginBottom: 12 }}>
            {t('mobile.scripts.overrides.desc')}
            {!jsonValid && <span style={{ color: 'var(--danger)', marginLeft: 6 }}>{t('mobile.scripts.overrides.json_invalid')}</span>}
          </p>
          {loading ? (
            <div className="muted" style={{ fontSize: 13 }}>{t('common.loading')}</div>
          ) : (
            <textarea
              value={raw}
              onChange={e => onChange(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 320, fontFamily: 'var(--font-mono)', fontSize: 12.5,
                lineHeight: 1.55, background: 'var(--bg-deep)', color: 'var(--text)',
                border: `1px solid ${jsonValid ? 'var(--line-soft)' : 'var(--danger)'}`,
                borderRadius: 12, padding: '12px 14px', outline: 'none', resize: 'vertical',
              }}
            />
          )}
          <button
            className="pl-btn-primary"
            style={{ marginTop: 14 }}
            onClick={onSave}
            disabled={saving || !dirty || !jsonValid}
          >
            <Icon name="save" size={18} />
            {saving ? t('mobile.scripts.overrides.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </>
  );
}

export { OverridesView };
