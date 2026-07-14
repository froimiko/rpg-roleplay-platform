// 权限设置区(PermSection + AuditLogView + 高风险白名单常量)。纯机械搬出,零行为变化。
import React from 'react';
import { useState as useStatePL, useEffect as useEffectPL } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoSave } from '../../platform-app.jsx';
import { lsGetJSON, lsSetJSON } from '../../lib/storage.js';
import { SetGroup, SetRow, SetSelect } from './shared.jsx';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSInput from '@cloudscape-design/components/input';
import CSButton from '@cloudscape-design/components/button';
import CSAlert from '@cloudscape-design/components/alert';

const _HIGH_RISK_DEFAULTS = ["timeline.pending_jump", "player.background", "world.constraints"];
const _HIGH_RISK_ALL = ["timeline.pending_jump", "player.background", "world.constraints", "relationships.*.tone"];

// B1: 自定义白名单输入校验 regex
const _CUSTOM_WL_RE = /^[a-zA-Z_][a-zA-Z0-9_.*]*$/;

function PermSection() {
  const { t } = useTranslation();
  // task 52：从 user_preferences 拉真实值，改动 patch /api/me/preference
  const [defaultMode, setDefaultMode] = useStatePL("review");
  const [highRiskWhitelist, setHighRiskWhitelist] = useStatePL(_HIGH_RISK_DEFAULTS);
  // B1: 自定义白名单
  const [customWhitelist, setCustomWhitelist] = useStatePL([]);
  const [customInput, setCustomInput] = useStatePL("");
  const [customInputError, setCustomInputError] = useStatePL("");
  const save = useAutoSave(t('settings.nav.permissions'), "perm");

  useEffectPL(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await window.api.account.profile();
        if (cancelled) return;
        const p = (r && r.preferences) || {};
        const v = p["perm.default_mode"] || p.default_perm_mode;
        if (v) setDefaultMode(v);
        const wl = p["perm.high_risk_whitelist"];
        if (Array.isArray(wl)) setHighRiskWhitelist(wl);
        // B1: 读自定义白名单
        const cwl = p["permissions.custom_whitelist"];
        if (Array.isArray(cwl)) setCustomWhitelist(cwl);
        else {
          // localStorage 兜底
          const stored = lsGetJSON("perm.custom_whitelist", null);
          if (stored) setCustomWhitelist(stored);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleWhitelist = (field) => {
    const next = highRiskWhitelist.includes(field)
      ? highRiskWhitelist.filter(f => f !== field)
      : [...highRiskWhitelist, field];
    setHighRiskWhitelist(next);
    save("high_risk_whitelist", next);
  };

  // B1: 保存自定义白名单（尝试后端，兜底 localStorage）
  const saveCustomWhitelist = async (next) => {
    setCustomWhitelist(next);
    try {
      await window.api.account.preferences({ "permissions.custom_whitelist": next });
    } catch (_) {
      // 后端不支持则 localStorage 兜底
    }
    lsSetJSON("perm.custom_whitelist", next);
  };

  const addCustomEntry = () => {
    const val = customInput.trim();
    if (!val) { setCustomInputError(t('settings.permissions.err_empty')); return; }
    if (val.length > 80) { setCustomInputError(t('settings.permissions.err_too_long')); return; }
    if (!_CUSTOM_WL_RE.test(val)) { setCustomInputError(t('settings.permissions.err_invalid')); return; }
    if (_HIGH_RISK_ALL.includes(val)) { setCustomInputError(t('settings.permissions.err_in_builtin')); return; }
    if (customWhitelist.includes(val)) { setCustomInputError(t('settings.permissions.err_duplicate')); return; }
    const next = [...customWhitelist, val];
    saveCustomWhitelist(next);
    setCustomInput("");
    setCustomInputError("");
  };

  const removeCustomEntry = (entry) => {
    const next = customWhitelist.filter(e => e !== entry);
    saveCustomWhitelist(next);
  };

  return (
    <SetGroup title={t('settings.permissions.title')}>
      <SetRow label={t('settings.permissions.default_mode')} description={t('settings.permissions.default_mode_desc')}>
        <SetSelect
          value={defaultMode}
          options={[
            { value: "default",     label: t('settings.permissions.mode_default') },
            { value: "review",      label: t('settings.permissions.mode_review') },
            { value: "full_access", label: t('settings.permissions.mode_full') },
          ]}
          onChange={(val) => { setDefaultMode(val); save("default_mode", val); }}
        />
      </SetRow>
      <SetRow label={t('settings.permissions.high_risk')} description={t('settings.permissions.high_risk_desc')}>
        <CSSpaceBetween direction="horizontal" size="xs">
          {_HIGH_RISK_ALL.map(field => (
            <CSButton
              key={field}
              variant={highRiskWhitelist.includes(field) ? "primary" : "normal"}
              onClick={() => toggleWhitelist(field)}
            >{field}</CSButton>
          ))}
        </CSSpaceBetween>
      </SetRow>

      {/* B1: 自定义高风险白名单 */}
      <SetRow label={t('settings.permissions.custom_whitelist')} description={t('settings.permissions.custom_whitelist_desc')}>
        <CSSpaceBetween size="s">
          <div style={{display: "flex", gap: 8, alignItems: "flex-start"}}>
            <div style={{flex: 1}}>
              <CSInput
                value={customInput}
                placeholder={t('settings.permissions.custom_placeholder')}
                onChange={({ detail }) => { setCustomInput(detail.value); if (customInputError) setCustomInputError(""); }}
                onKeyDown={(e) => { if (e.detail?.key === "Enter" || e.key === "Enter") addCustomEntry(); }}
                invalid={!!customInputError}
              />
              {customInputError && (
                <div style={{color: "var(--danger, #c8675d)", fontSize: 12, marginTop: 4}}>{customInputError}</div>
              )}
            </div>
            <CSButton variant="primary" onClick={addCustomEntry}>{t('settings.permissions.add_entry')}</CSButton>
          </div>
          {customWhitelist.length > 0 && (
            <div style={{display: "flex", flexWrap: "wrap", gap: 6}}>
              {customWhitelist.map(entry => (
                <div key={entry} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "3px 8px", borderRadius: 4,
                  background: "var(--bg-deep, #f0f0f2)", border: "1px solid var(--line-soft, #ddd)",
                  fontSize: 13, fontFamily: "ui-monospace, monospace",
                }}>
                  <span>{entry}</span>
                  <button
                    onClick={() => removeCustomEntry(entry)}
                    style={{
                      border: "none", background: "none", cursor: "pointer",
                      color: "var(--danger, #c8675d)", fontSize: 14, padding: "0 2px", lineHeight: 1,
                    }}
                    title={t('common.delete')}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {customWhitelist.length === 0 && (
            <span className="muted" style={{fontSize: 12}}>{t('settings.permissions.no_entries')}</span>
          )}
        </CSSpaceBetween>
      </SetRow>

      <AuditLogView />
    </SetGroup>
  );
}

// AuditLogView — task 65：把 state.permissions.audit_log 暴露给用户。
// 后端在多处写 audit 条目：
//   - kind=write           普通写入留痕（state.py:798）
//   - kind=parse_error     LLM 输出标签解析失败（task 60）
//   - kind=rejected        权限闸门拒绝（low/medium/high）
//   - kind=hard_forbidden  permissions.x / history.x 黑名单
//   - kind=extractor_error GM 第二步失败（task 65 新增）
//   - kind=question_skip   pending_question 玩家跳过
// 现在前端能看见这些，便于排查 GM 行为异常。
function AuditLogView() {
  const { t } = useTranslation();
  const [entries, setEntries] = useStatePL([]);
  const [loading, setLoading] = useStatePL(false);
  const [hasState, setHasState] = useStatePL(true);
  const [error, setError] = useStatePL("");
  const [kindFilter, setKindFilter] = useStatePL("all");
  const refresh = React.useCallback(async () => {
    setLoading(true); setError("");
    try {
      const s = await window.api.game.state();
      const perms = (s && (s.permissions || s.state?.permissions)) || {};
      const log = Array.isArray(perms.audit_log) ? perms.audit_log : [];
      // 倒序展示，最近的在前
      setEntries(log.slice().reverse());
      setHasState(!!s);
    } catch (e) {
      setError(e?.message || t('settings.permissions.audit_log'));
      setHasState(false);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffectPL(() => { refresh(); }, []);

  // 用 .ok / .danger（来自 tokens.css 的全局色类）+ 内联色给 warning/muted
  const KIND_META = {
    write:             { label: t('settings.permissions.kind_write'),            color: "var(--ok, #7eb88e)",      desc: "" },
    parse_error:       { label: t('settings.permissions.kind_parse_error'),      color: "var(--warning, #d4a857)", desc: "" },
    rejected:          { label: t('settings.permissions.kind_rejected'),         color: "var(--danger, #c8675d)",  desc: "" },
    hard_forbidden:    { label: t('settings.permissions.kind_hard_forbidden'),   color: "var(--danger, #c8675d)",  desc: "" },
    extractor_error:   { label: t('settings.permissions.kind_extractor_error'),  color: "var(--warning, #d4a857)", desc: "" },
    set_parser_error:  { label: t('settings.permissions.kind_set_parser_error'), color: "var(--warning, #d4a857)", desc: "" },
    clarify_yield:     { label: t('settings.permissions.kind_clarify_yield'),    color: "var(--ok, #7eb88e)",      desc: "" },
    acceptance_unmet:  { label: t('settings.permissions.kind_acceptance_unmet'), color: "var(--warning, #d4a857)", desc: "" },
    question_skip:     { label: t('settings.permissions.kind_question_skip'),    color: "var(--muted, #888)",      desc: "" },
  };
  const kinds = ["all", ...Object.keys(KIND_META)];
  const filtered = kindFilter === "all" ? entries : entries.filter(e => e.kind === kindFilter);

  return (
    <>
      <SetRow
        label={t('settings.permissions.audit_log')}
        description={t('settings.permissions.audit_log_desc')}
      >
        <CSSpaceBetween direction="horizontal" size="s">
          <CSButton variant="normal" onClick={refresh} disabled={loading}>
            {loading ? t('settings.permissions.audit_loading') : t('settings.permissions.audit_refresh')}
          </CSButton>
          {error && <CSAlert type="error">{error}</CSAlert>}
        </CSSpaceBetween>
      </SetRow>
      <SetRow label={t('settings.permissions.audit_filter')} description="">
        <CSSpaceBetween direction="horizontal" size="xs">
          {kinds.map(k => {
            const meta = KIND_META[k];
            const count = k === "all" ? entries.length : entries.filter(e => e.kind === k).length;
            return (
              <CSButton
                key={k}
                variant={kindFilter === k ? "primary" : "normal"}
                onClick={() => setKindFilter(k)}
                title={meta?.desc || ""}
              >
                {k === "all" ? t('settings.permissions.audit_all') : (meta?.label || k)} · {count}
              </CSButton>
            );
          })}
        </CSSpaceBetween>
      </SetRow>
      {!hasState ? (
        <CSAlert type="info">{t('settings.permissions.audit_no_state')}</CSAlert>
      ) : filtered.length === 0 ? (
        <CSAlert type="info">
          {entries.length === 0 ? t('settings.permissions.audit_empty') : t('settings.permissions.audit_empty_filter', { kind: kindFilter })}
        </CSAlert>
      ) : (
        <div style={{maxHeight: 360, overflowY: "auto", border: "1px solid var(--pl-line, #eee)", borderRadius: 6}}>
          <table className="pl-table" style={{width: "100%", fontSize: 12, borderCollapse: "collapse"}}>
            <thead>
              <tr style={{background: "var(--pl-bg-soft, #f7f7f9)"}}>
                <th style={{textAlign: "left", padding: "6px 8px", width: 130}}>{t('settings.permissions.audit_col_time')}</th>
                <th style={{textAlign: "left", padding: "6px 8px", width: 90}}>{t('settings.permissions.audit_col_type')}</th>
                <th style={{textAlign: "left", padding: "6px 8px", width: 80}}>{t('settings.permissions.audit_col_source')}</th>
                <th style={{textAlign: "left", padding: "6px 8px"}}>{t('settings.permissions.audit_col_detail')}</th>
                <th style={{textAlign: "right", padding: "6px 8px", width: 50}}>{t('settings.permissions.audit_col_turn')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, idx) => {
                const meta = KIND_META[e.kind] || { label: e.kind, color: "var(--muted, #888)", desc: "" };
                const detail = e.path
                  ? `${e.path} = ${typeof e.value === "string" ? e.value : JSON.stringify(e.value)}`
                  : (e.raw_spec || e.hint || "—");
                return (
                  <tr key={idx} style={{borderTop: "1px solid var(--pl-line, #eee)"}}>
                    <td style={{padding: "4px 8px", fontFamily: "ui-monospace, monospace"}}>{(e.ts || "").replace("T", " ")}</td>
                    <td style={{padding: "4px 8px"}}>
                      <span className="pl-rule-chip" style={{fontSize: 11, color: meta.color, borderColor: meta.color}}>{meta.label}</span>
                    </td>
                    <td style={{padding: "4px 8px"}} className="muted">{e.source || "—"}</td>
                    <td style={{padding: "4px 8px", wordBreak: "break-word"}}>
                      <div>{detail}</div>
                      {e.hint && e.path && (
                        <div className="muted" style={{fontSize: 11, marginTop: 2}}>· {e.hint}</div>
                      )}
                    </td>
                    <td style={{padding: "4px 8px", textAlign: "right"}} className="muted">{e.turn ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export {
  PermSection,
  AuditLogView,
};
