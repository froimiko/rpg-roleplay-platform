/* 导入向导视图 —— 从 pages/MobileScripts.jsx 拆出,逐字节不变。 */

import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { isCredentialsError } from '../../lib/creds.js';
import { fmtN, fmtWan, getSplitRules } from './helpers.js';

/* ─── 导入向导视图 ─────────────────────────────── */
function ImportView({ onBack, nav }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0); // 0=上传 1=配置 2=预览 3=进行中/结果
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [rule, setRule] = useState('auto');
  const [customPattern, setCustomPattern] = useState('');
  const [enableCards, setEnableCards] = useState(true);
  const [enableWorldbook, setEnableWorldbook] = useState(true);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importPercent, setImportPercent] = useState(0);
  const [job, setJob] = useState(null);
  const fileRef = useRef(null);

  const CHUNK_SIZE = 512 * 1024;

  const onPickFile = (file) => {
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!/\.(txt|md)$/.test(name)) {
      nav.toast(t('mobile.scripts.import.file_type_error'), 'danger', 'warn'); return;
    }
    if (file.size > 50 * 1024 * 1024) {
      nav.toast(t('mobile.scripts.import.file_too_large'), 'danger', 'warn'); return;
    }
    setSelectedFile(file);
    setEstimate(null);
    if (!title) setTitle(file.name.replace(/\.(txt|md)$/i, ''));
    setStep(1);
  };

  const uploadChunks = async (file, onProgress) => {
    const totalBytes = file.size;
    const totalChunks = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
    onProgress?.({ stage: 'init', percent: 0 });
    const init = await window.api.uploads.init({ filename: file.name, total_bytes: totalBytes, total_chunks: totalChunks });
    const uploadId = init.upload_id || init.id;
    if (!uploadId) throw new Error(t('mobile.scripts.import.no_upload_id'));
    for (let i = 0; i < totalChunks; i++) {
      const blob = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await window.api.uploads.chunk(uploadId, blob, i);
      onProgress?.({ stage: 'chunk', done: i + 1, total: totalChunks, percent: Math.round(((i + 1) / totalChunks) * 100) });
    }
    await window.api.uploads.finish(uploadId, {});
    onProgress?.({ stage: 'finish', percent: 100 });
    return uploadId;
  };

  const startPreview = async () => {
    if (!selectedFile) { nav.toast(t('mobile.scripts.import.no_file_selected'), 'accent', 'warn'); return; }
    setPreviewBusy(true);
    setEstimate(null);
    try {
      const uploadId = await uploadChunks(selectedFile, ({ stage, done, total, percent }) => {
        if (stage === 'init') setImportProgress(t('mobile.scripts.import.upload_init'));
        else if (stage === 'chunk') setImportProgress(t('mobile.scripts.import.uploading', { done, total }));
        else if (stage === 'finish') setImportProgress(t('mobile.scripts.import.upload_done'));
      });
      const result = await window.api.scripts.preview({
        upload_id: uploadId,
        split_rule: rule || 'auto',
        custom_pattern: customPattern || '',
        sample_limit: 20,
      });
      const chapters = Number(result.total_chapters) || (Array.isArray(result.preview) ? result.preview.length : 0);
      const words = Number(result.total_words) || 0;
      setEstimate({ chapters, words, upload_id: uploadId, preview: result.preview, report: result.report });
      setStep(2);
    } catch (e) {
      nav.toast(e?.message || t('mobile.scripts.import.preview_error'), 'danger', 'warn');
    } finally {
      setPreviewBusy(false);
      setImportProgress('');
    }
  };

  const startImport = async () => {
    if (!selectedFile || !estimate) return;
    setImportBusy(true);
    setImportPercent(5);
    setImportProgress(t('mobile.scripts.import.uploading_file'));
    setStep(3);
    try {
      let uploadId = estimate.upload_id;
      if (!uploadId) {
        uploadId = await uploadChunks(selectedFile, ({ stage, done, total, percent }) => {
          setImportPercent(Math.min(30, Math.round((percent || 0) * 0.30)));
          setImportProgress(t('mobile.scripts.import.uploading', { done: done || 0, total: total || 1 }));
        });
      }
      setImportPercent(30); setImportProgress(t('mobile.scripts.import.creating_script'));
      const importResp = await window.api.scripts.importScript({
        upload_id: uploadId,
        title: title || selectedFile.name.replace(/\.(txt|md)$/i, ''),
        split_rule: rule || 'auto',
        custom_pattern: customPattern || '',
        require_llm_credentials: true,
      });
      if (!importResp || importResp.ok === false) throw new Error(importResp?.error || t('mobile.scripts.import.create_error'));
      const sc = importResp.script || {};
      setImportPercent(40); setImportProgress(t('mobile.scripts.import.starting_pipeline'));
      const pipelineResp = await window.api.scripts.importPipeline(sc.id, {
        enable_cards: enableCards,
        enable_worldbook: enableWorldbook,
        budget: estimate,
      });
      if (!pipelineResp || pipelineResp.ok === false || !pipelineResp.job_id) {
        if (isCredentialsError(pipelineResp)) {
          nav.toast(t('mobile.scripts.import.no_llm_key_partial'), 'accent', 'warn');
          setJob({ status: 'paused_credentials', title: sc.title || title, script_id: sc.id });
          try { window.dispatchEvent(new CustomEvent('rpg-scripts-updated')); } catch (_) {}
          return;
        }
        throw new Error(pipelineResp?.error || t('mobile.scripts.import.pipeline_error'));
      }
      setJob({ status: 'running', id: pipelineResp.job_id, title: sc.title || title, script_id: sc.id });
      nav.toast(t('mobile.scripts.import.dispatched'), 'ok', 'check');
      try { window.dispatchEvent(new CustomEvent('rpg-scripts-updated')); } catch (_) {}
    } catch (e) {
      if (isCredentialsError(e)) {
        nav.toast(t('mobile.scripts.import.no_llm_key'), 'accent', 'warn');
        setJob({ status: 'paused_credentials' });
      } else {
        nav.toast(e?.message || t('mobile.scripts.import.import_error'), 'danger', 'warn');
        setJob(null);
        setStep(2);
      }
    } finally {
      setImportBusy(false);
      setImportProgress('');
    }
  };

  const SPLIT_RULES = getSplitRules();
  const ruleLabel = SPLIT_RULES.find(r2 => r2.id === rule)?.label || rule;

  return (
    <>
      <div className="pl-head">
        <button className="pl-back" onClick={step === 0 ? onBack : () => { if (step < 3) setStep(s => s - 1); else onBack(); }} aria-label={t('common.back')}>
          <Icon name="chevron_left" size={20} />
        </button>
        <div className="pl-head-title center">
          <strong>{t('mobile.scripts.import.title')}</strong>
          <span className="sub">{t('mobile.scripts.import.step', { n: step + 1 })}</span>
        </div>
      </div>
      <div className="pl-body tabbed">
        <div className="pl-pad">
          {/* 步骤 0: 选择文件 */}
          {step === 0 && (
            <>
              <input ref={fileRef} type="file" accept=".txt,.md" style={{ display: 'none' }}
                onChange={e => onPickFile(e.target.files?.[0])} />
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '2px dashed var(--line-strong)', borderRadius: 16, padding: '48px 20px',
                  textAlign: 'center', display: 'grid', gap: 12, placeItems: 'center',
                  cursor: 'pointer', transition: 'border-color .2s',
                }}
              >
                <span className="pl-row-ic accent" style={{ width: 56, height: 56 }}>
                  <Icon name="upload" size={26} />
                </span>
                <div>
                  <strong style={{ fontSize: 15, color: 'var(--text)' }}>{t('mobile.scripts.import.pick_file_label')}</strong>
                  <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 5 }}>{t('mobile.scripts.import.pick_file_hint')}</div>
                </div>
              </div>
              <div className="pl-note" style={{ marginTop: 16 }}>
                {t('mobile.scripts.import.intro_note')}
              </div>
            </>
          )}

          {/* 步骤 1: 配置参数 */}
          {step === 1 && selectedFile && (
            <>
              <div className="pl-card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 11 }}>
                <span className="pl-row-ic ok"><Icon name="file" size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedFile.name}
                  </div>
                  <div className="mono muted-2" style={{ fontSize: 11 }}>
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </div>
                </div>
                <button onClick={() => { setSelectedFile(null); setTitle(''); setStep(0); }} style={{ color: 'var(--muted)', padding: 4 }}>
                  <Icon name="close" size={16} />
                </button>
              </div>

              <div className="pl-field">
                <label>{t('mobile.scripts.import.script_title_label')}</label>
                <input className="pl-input" value={title} onChange={e => setTitle(e.target.value)} placeholder={t('mobile.scripts.import.script_title_placeholder')} />
              </div>

              <div className="pl-field">
                <label>{t('mobile.scripts.import.split_mode_label')}</label>
                <select
                  className="pl-input"
                  value={rule}
                  onChange={e => setRule(e.target.value)}
                  style={{ fontSize: 16 }}
                >
                  {SPLIT_RULES.map(r2 => <option key={r2.id} value={r2.id}>{r2.label}</option>)}
                </select>
              </div>

              {rule === 'custom' && (
                <div className="pl-field">
                  <label>{t('mobile.scripts.import.custom_regex_label')}</label>
                  <input className="pl-input" value={customPattern} onChange={e => setCustomPattern(e.target.value)} placeholder={t('mobile.scripts.import.custom_regex_placeholder')} />
                </div>
              )}

              <div className="pl-sec">
                <div className="pl-sec-head"><h2>{t('mobile.scripts.import.pipeline_section')}</h2></div>
                <div className="pl-group">
                  <div className="pl-setrow">
                    <div className="pl-setrow-tx">
                      <strong>{t('mobile.scripts.import.enable_cards_label')}</strong>
                      <span>{t('mobile.scripts.import.enable_cards_desc')}</span>
                    </div>
                    <button className={'pl-toggle' + (enableCards ? ' on' : '')} onClick={() => setEnableCards(!enableCards)} />
                  </div>
                  <div className="pl-setrow">
                    <div className="pl-setrow-tx">
                      <strong>{t('mobile.scripts.import.enable_worldbook_label')}</strong>
                      <span>{t('mobile.scripts.import.enable_worldbook_desc')}</span>
                    </div>
                    <button className={'pl-toggle' + (enableWorldbook ? ' on' : '')} onClick={() => setEnableWorldbook(!enableWorldbook)} />
                  </div>
                </div>
                {(!enableCards || !enableWorldbook) && (
                  <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 8 }}>
                    {t('mobile.scripts.import.pipeline_warn')}
                  </div>
                )}
              </div>

              <button
                className="pl-btn-primary"
                style={{ marginTop: 20 }}
                disabled={previewBusy || !selectedFile}
                onClick={startPreview}
              >
                {previewBusy ? <><Icon name="refresh" size={17} /> {importProgress || t('mobile.scripts.import.uploading_label')}</> : <><Icon name="sparkle" size={17} />{t('mobile.scripts.import.preview_btn')}</>}
              </button>
              {previewBusy && (
                <div style={{ marginTop: 10 }}>
                  <div className="pl-progress"><i style={{ width: '60%' }} /></div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 4 }}>{importProgress}</div>
                </div>
              )}
            </>
          )}

          {/* 步骤 2: 预览确认 */}
          {step === 2 && estimate && (
            <>
              <div className="pl-card" style={{ textAlign: 'center', padding: '22px 16px', marginBottom: 16 }}>
                <span className="pl-row-ic ok" style={{ width: 50, height: 50, margin: '0 auto 10px' }}>
                  <Icon name="check" size={24} />
                </span>
                <strong style={{ fontSize: 17, fontFamily: 'var(--font-serif)', color: 'var(--text)' }}>{t('mobile.scripts.import.analysis_done')}</strong>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
                  {t('mobile.scripts.import.detected_chapters', { n: estimate.chapters })}
                  {estimate.report?.confidence != null && ` · ${t('mobile.scripts.import.confidence', { pct: Math.round(estimate.report.confidence * 100) })}`}
                </div>
              </div>

              <div className="pl-kvgrid" style={{ marginBottom: 16 }}>
                <div className="pl-kv"><div className="k">{t('mobile.scripts.detail.stat_chapters')}</div><div className="v">{fmtN(estimate.chapters)}</div></div>
                <div className="pl-kv"><div className="k">{t('mobile.scripts.detail.stat_words')}</div><div className="v">{fmtWan(estimate.words)}</div></div>
                <div className="pl-kv"><div className="k">{t('mobile.scripts.import.split_mode_label')}</div><div className="v" style={{ fontSize: 12 }}>{ruleLabel}</div></div>
                <div className="pl-kv">
                  <div className="k">{t('mobile.scripts.import.enable_cards_label')}</div>
                  <div className="v" style={{ fontSize: 13 }}>{enableCards ? t('mobile.scripts.import.yes') : t('mobile.scripts.import.no')}</div>
                </div>
              </div>

              {/* 章节预览列表 */}
              {Array.isArray(estimate.preview) && estimate.preview.length > 0 && (
                <div className="pl-sec">
                  <div className="pl-sec-head"><h2>{t('mobile.scripts.import.preview_section', { n: estimate.preview.length })}</h2></div>
                  {estimate.preview.slice(0, 10).map((p, i) => (
                    <div key={i} className="pl-row" style={{ cursor: 'default' }}>
                      <span className="mono muted-2" style={{ fontSize: 11, width: 32, flex: 'none' }}>#{String(p.idx || i + 1).padStart(3, '0')}</span>
                      <span className="pl-row-tx">
                        <strong style={{ fontFamily: 'var(--font-serif)' }}>{p.title || t('mobile.scripts.no_title')}</strong>
                        <span className="mono">{fmtN(p.words || 0)}{t('mobile.scripts.unit.chars')}</span>
                      </span>
                      {!p.ok && <span className="pill warn" style={{ height: 19, fontSize: 10 }}>{t('mobile.scripts.import.has_issue')}</span>}
                    </div>
                  ))}
                  {estimate.preview.length > 10 && (
                    <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted-2)', padding: '8px 0' }}>
                      {t('mobile.scripts.import.more_chapters', { n: estimate.preview.length - 10 })}
                    </div>
                  )}
                </div>
              )}

              <div className="pl-note" style={{ marginTop: 14 }}>
                {t('mobile.scripts.import.confirm_note')}
              </div>
              <div style={{ display: 'grid', gap: 9, marginTop: 20 }}>
                <button className="pl-btn-primary" onClick={startImport} disabled={importBusy}>
                  <Icon name="check" size={17} /> {t('mobile.scripts.import.confirm_btn')}
                </button>
                <button className="pl-btn-ghost" onClick={() => setStep(1)}>
                  <Icon name="chevron_left" size={16} /> {t('mobile.scripts.import.back_btn')}
                </button>
              </div>
            </>
          )}

          {/* 步骤 3: 进行中/结果 */}
          {step === 3 && (
            <>
              {importBusy && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 17, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', border: '1px solid var(--accent-edge)', margin: '0 auto 16px', color: 'var(--accent)' }}>
                    <Icon name="refresh" size={26} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--text)', marginBottom: 8 }}>{t('mobile.scripts.import.uploading_label')}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{importProgress}</div>
                  <div className="pl-progress" style={{ marginTop: 16 }}>
                    <i style={{ width: `${importPercent}%`, transition: 'width .3s' }} />
                  </div>
                </div>
              )}
              {!importBusy && job && (
                <>
                  {(job.status === 'running' || job.status === 'paused_credentials') && (
                    <div className="pl-card" style={{ textAlign: 'center', padding: '30px 16px', marginBottom: 16 }}>
                      <span className={'pl-row-ic ' + (job.status === 'running' ? 'accent' : 'warn')} style={{ width: 50, height: 50, margin: '0 auto 12px' }}>
                        <Icon name={job.status === 'running' ? 'sparkle' : 'warn'} size={24} />
                      </span>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>
                        {job.status === 'running' ? t('mobile.scripts.import.job_running_title') : t('mobile.scripts.import.job_needs_key_title')}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>
                        {job.status === 'running'
                          ? t('mobile.scripts.import.job_running_desc', { title: job.title || '—' })
                          : t('mobile.scripts.import.job_needs_key_desc')}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gap: 9 }}>
                    <button className="pl-btn-primary" onClick={onBack}>
                      <Icon name="book_open" size={17} /> {t('mobile.scripts.import.go_to_list')}
                    </button>
                    <button className="pl-btn-ghost" onClick={() => { setJob(null); setEstimate(null); setSelectedFile(null); setTitle(''); setStep(0); }}>
                      <Icon name="plus" size={16} /> {t('mobile.scripts.import.import_another')}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export { ImportView };
