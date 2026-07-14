/* Extracted from pages/MobileCaps.jsx — mechanical split, byte-for-byte. */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { Sheet } from '../Sheet.jsx';
import { Toggle, StatusPill, MField } from './shared.jsx';

/* ──────────────────────────────────────────────────────────────────
   SKILLS
   ────────────────────────────────────────────────────────────────── */
function SkillsSection({ toast }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [personaItems, setPersonaItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await window.api.tools.list();
      const tl = (r && r.tools) || {};
      setItems((tl.skills || []).map(s => ({
        id: s.id || s.slug || s.name,
        name: s.name || s.id,
        desc: s.description || s.summary || '',
        tag: s.version || s.kind || 'v1',
        on: s.enabled !== false,
      })));
    } catch (e) {
      setErr(e?.message || t('mobile.caps.error.load_failed'));
    } finally {
      setLoading(false);
    }
    // 用户人格 skill(独立列表,失败不影响可执行 skill 展示)
    try {
      const pr = await window.api.personaSkills.list();
      setPersonaItems((pr && pr.items) || []);
    } catch { /* noop */ }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  // 导入路由:GitHub 链接 / .md → 人格 skill(蒸馏成角色卡);.zip/.tgz → 可执行 skill 包(原路径)。
  const handleImport = async () => {
    const url = repoUrl.trim();
    const isPersonaFile = file && /\.md$/i.test(file.name || '');
    if (!url && !file) { toast(t('m_caps_extra.skills_import_fill_required'), 'warn'); return; }
    setImportBusy(true);
    try {
      if (url || isPersonaFile) {
        let body;
        if (url) {
          body = { source: 'github', repo_url: url };
        } else {
          const content = await file.text();
          body = { source: 'upload', files: [{ name: file.name, content }] };
        }
        const r = await window.api.personaSkills.import(body);
        if (r && r.ok) {
          const nm = (r.card && r.card.name) || t('m_caps_extra.persona_card_default_name');
          const img = r.image_status === 'queued' ? t('m_caps_extra.persona_image_queued') : '';
          toast(t('m_caps_extra.persona_card_created', { name: nm, img }).trim(), 'ok');
        } else {
          throw new Error((r && r.error) || t('m_caps_extra.import_failed'));
        }
      } else {
        // .zip/.tar.gz 可执行 skill 包(admin)
        await window.api.skills.importPack(file);
        toast(t('mobile.caps.skills.toast.imported'), 'ok');
      }
      setImportOpen(false); setFile(null); setRepoUrl('');
      load();
    } catch (e) {
      toast(t('mobile.caps.skills.toast.import_failed', { msg: e?.message || '' }), 'danger');
    } finally {
      setImportBusy(false);
    }
  };

  const removePersona = async (id) => {
    try { await window.api.personaSkills.remove(id); setPersonaItems(p => p.filter(x => x.id !== id)); }
    catch (e) { toast(e?.message || t('m_caps_extra.persona_delete_failed'), 'danger'); }
  };

  return (
    <>
      <div className="pl-pad">
        <div className="pl-sec-head" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>{t('mobile.caps.skills.title')}</h2>
          <button className="pl-btn-primary" style={{ height: 36, width: 'auto', padding: '0 16px', fontSize: 13 }} onClick={() => setImportOpen(true)}>
            <Icon name="upload" size={14} />{t('mobile.caps.skills.import_btn')}
          </button>
        </div>
        {err && (
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--danger-soft)', border: '1px solid rgba(200,103,93,0.3)', color: 'var(--danger)', fontSize: 13 }}>
            {err}
          </div>
        )}
        {loading && items.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="pl-empty">
            <div className="ic"><Icon name="spark" size={22} /></div>
            <h3>{t('mobile.caps.skills.empty_title')}</h3>
            <p>{t('mobile.caps.skills.empty_desc')}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 9 }}>
            {items.map((it) => (
              <div key={it.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 14, background: 'var(--panel)', padding: '13px 14px', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="pl-row-ic" style={{ width: 36, height: 36, borderRadius: 10 }}>
                    <Icon name="spark" size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{it.tag}</div>
                  </div>
                  <Toggle on={it.on} onChange={() => toast(t('mobile.caps.skills.all_enabled_notice'), 'warn')} />
                </div>
                {it.desc ? <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>{it.desc}</div> : null}
                <StatusPill on={it.on} label={it.on ? t('mobile.caps.skills.status.deployed') : t('common.disabled')} />
              </div>
            ))}
          </div>
        )}

        {personaItems.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--text)' }}>{t('m_caps_extra.my_persona_skills')}</h3>
            <div style={{ display: 'grid', gap: 9 }}>
              {personaItems.map((it) => (
                <div key={it.id} style={{ border: '1px solid var(--line-soft)', borderRadius: 14, background: 'var(--panel)', padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 11 }}>
                  {it.avatar_path
                    ? <img src={it.avatar_path} alt="" style={{ width: 40, height: 40, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
                    : <div className="pl-row-ic" style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0 }}><Icon name="spark" size={16} /></div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>{it.source === 'github' ? 'GitHub' : t('m_caps_extra.persona_source_upload')} · {t('m_caps_extra.persona_card_generated')}</div>
                  </div>
                  <button className="pl-icon-btn" title={t('common.delete')} onClick={() => removePersona(it.id)} style={{ flexShrink: 0 }}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Sheet open={importOpen} title={t('m_caps_extra.import_skill_sheet_title')} hint={t('m_caps_extra.import_skill_sheet_hint')} onClose={() => setImportOpen(false)} zIndex={70} maxHeight="88%">
        <div style={{ padding: '4px 4px 8px' }}>
          <MField label={t('m_caps_extra.github_url_label')} desc={t('m_caps_extra.github_url_desc')}>
            <input
              type="text"
              inputMode="url"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              style={{ marginTop: 4, width: '100%', height: 44, borderRadius: 10, border: '1px solid var(--line-soft)', background: 'var(--panel-2)', color: 'var(--text)', padding: '0 12px', fontSize: 14 }}
            />
          </MField>
          <div style={{ textAlign: 'center', color: 'var(--muted-2)', fontSize: 12, margin: '4px 0' }}>{t('m_caps_extra.or_separator')}</div>
          <MField label={t('m_caps_extra.local_file_label')} desc={t('m_caps_extra.local_file_desc')}>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.zip,.tar.gz,.tgz"
              style={{ display: 'none' }}
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            <button
              className="pl-btn-ghost"
              style={{ marginTop: 4, height: 46, justifyContent: 'flex-start', gap: 10, paddingLeft: 14 }}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" size={16} />
              {file ? file.name : t('mobile.caps.skills.form.select_file')}
            </button>
          </MField>
          <div className="sheet-actions" style={{ marginTop: 8 }}>
            <button className="sheet-btn" onClick={() => setImportOpen(false)}>{t('common.cancel')}</button>
            <button className="sheet-btn primary" onClick={handleImport} disabled={importBusy || (!file && !repoUrl.trim())}>
              {importBusy ? t('mobile.caps.skills.form.importing') : t('m_caps_extra.import_btn')}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

export { SkillsSection };
