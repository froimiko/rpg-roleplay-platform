/* Scripts page shell —— 路由入口 + 预览/置信度小组件。
   页面主体已按「列表 / 详情 / 导入」拆到 ../components/scripts/*(纯机械搬家,零行为变化)。
   具名 export 全部保留转发,外部(entries/platform.jsx 等)引用面不变。 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../game-icons.jsx';
import Modal from '../components/Modal.jsx';
import { ScriptsListView, ScriptsLibraryView, ChaptersModal, OverridesModal } from '../components/scripts/ScriptsList.jsx';
import { ScriptsImportView, ImportJobBanner, ImportJobResult, ImportEstimateView } from '../components/scripts/ScriptsImport.jsx';
import { KbExtractPanel } from '../components/scripts/ScriptDetail.jsx';

function ScriptPreviewModal({ open, busy, data, rule, onClose, onRetryRule, onConfirm }) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <Modal
      open
      eyebrow={`${t('scripts.import.preview_eyebrow')} · ${rule || t('scripts.import.rule_auto')}`}
      title={busy ? t('scripts.import.preview_splitting') : (data?.title || t('scripts.import.unnamed'))}
      width={720}
      onClose={onClose}
      footer={<>
        <span className="muted-2" style={{fontSize: 11.5}}>
          <Icon name="info" size={11} /> {t('scripts.import.preview_footer', { count: data?.preview?.length || 0 })}
        </span>
        <div style={{display: "flex", gap: 8}}>
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          {!busy && (
            <>
              <button className="btn ghost" onClick={() => onRetryRule?.("chapter_cn")} data-tip={t('scripts.import.retry_tip')}>
                <Icon name="refresh" size={12} /> {t('scripts.import.retry_rule')}
              </button>
              <button className="btn primary" onClick={onConfirm} disabled={!data}>
                <Icon name="check" size={12} /> {t('scripts.import.confirm_import')}
              </button>
            </>
          )}
        </div>
      </>}
    >
        {busy ? (
          // 这里之前是 3 个伪 step (校验文件 / 解析分章 / 计算预算) — 前端没法真知道
          // 后端预览到了哪一步。改成单一 spinner,不撒谎。
          <div className="pl-validate-progress">
            <div className="pl-validate-step running">
              <Icon name="spinner" size={12} className="spin" /> {t('scripts.import.preview_splitting')}
            </div>
          </div>
        ) : data ? (
          <>
            <div className="pl-validate-result" style={{flex: "0 0 auto"}}>
              <div className="pl-validate-stat-row">
                <div className="pl-validate-stat">
                  <span className="pl-stat-label">{t('scripts.my.chapters')}</span>
                  <span className="pl-stat-value" style={{fontSize: 20}}>{data.chapter_count}</span>
                </div>
                <div className="pl-validate-stat">
                  <span className="pl-stat-label">{t('scripts.my.words')}</span>
                  <span className="pl-stat-value" style={{fontSize: 20}}>{(data.word_count / 10000).toFixed(1)}<span style={{fontSize: 12, color: "var(--muted)", marginLeft: 3}}>{t('scripts.my.wan')}</span></span>
                </div>
                <div className="pl-validate-stat">
                  <span className="pl-stat-label">{t('scripts.import.confidence')}</span>
                  <span className="pl-stat-value" style={{fontSize: 20, color: data.confidence >= 0.85 ? "var(--ok)" : "var(--warn)"}}>{Math.round(data.confidence * 100)}<span style={{fontSize: 12, marginLeft: 2}}>%</span></span>
                </div>
                <div className="pl-validate-stat">
                  <span className="pl-stat-label">{t('scripts.import.problem')}</span>
                  <span className="pl-stat-value" style={{fontSize: 13, lineHeight: 1.5, fontFamily: "var(--font-sans)", color: data.problem_kind === "ok" ? "var(--ok)" : "var(--warn)"}}>{data.problem_label}</span>
                </div>
              </div>
              {data.notes?.length > 0 && (
                <ul className="pl-flat-list" style={{listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4}}>
                  {data.notes.map((n, i) => (
                    <li key={i} className="muted-2" style={{fontSize: 11.5, paddingLeft: 14, position: "relative"}}>
                      <span style={{position: "absolute", left: 0}}>•</span> {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div style={{overflowY: "auto", overflowX: "hidden", minHeight: 0, flex: "1 1 auto", border: "1px solid var(--line-soft)", borderRadius: "var(--r-2)"}}>
              <table className="pl-table" style={{margin: 0}}>
                <thead><tr><th style={{width: 50}}>#</th><th>{t('scripts.import.col_title')}</th><th>{t('scripts.import.col_volume')}</th><th style={{textAlign: "right"}}>{t('scripts.my.words')}</th></tr></thead>
                <tbody>
                  {data.preview.map(p => (
                    <tr key={p.idx} style={{background: p.ok ? "transparent" : "var(--warn-soft)"}}>
                      <td className="mono muted-2">{String(p.idx).padStart(3, "0")}</td>
                      <td>
                        <strong style={{fontFamily: "var(--font-serif)", fontSize: 14}}>{p.title}</strong>
                        {!p.ok && <span className="pill warn" style={{marginLeft: 8, fontSize: 10.5}}><span className="dot warn" /> {p.hint}</span>}
                      </td>
                      <td className="muted">{p.volume}</td>
                      <td className="mono" style={{textAlign: "right"}}>{Number(p.words || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
    </Modal>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? "var(--ok)" : value >= 0.7 ? "var(--warn)" : "var(--danger)";
  return (
    <div style={{display: "flex", alignItems: "center", gap: 8}}>
      <div style={{width: 60, height: 4, borderRadius: 999, background: "var(--line-soft)", overflow: "hidden"}}>
        <div style={{width: pct + "%", height: "100%", background: color}} />
      </div>
      <span className="mono" style={{fontSize: 11, color: "var(--muted)"}}>{pct}%</span>
    </div>
  );
}

function ScriptsPage({ subPage = "list" }) {
  return (
    <div className="pl-stack">
      {subPage === "import" ? <ScriptsImportView />
        : subPage === "library" ? <ScriptsLibraryView />
        : <ScriptsListView />}
    </div>
  );
}

export { ScriptsPage, ScriptsListView, ScriptsLibraryView, ChaptersModal, OverridesModal, ScriptsImportView, ImportJobBanner, ImportJobResult, ImportEstimateView, ScriptPreviewModal, ConfidenceBar, KbExtractPanel };
