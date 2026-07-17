/* Game Console composer — 上下文用量环(ContextUsage)+ 明细面板(ContextBreakdownPanel)。
   纯机械从 game-composer.jsx 搬出,DOM/视觉/行为零变化。 */
import React from 'react';
import { useState as useStateC, useRef as useRefC } from 'react';
import { useTranslation } from 'react-i18next';
import { useDismissOnOutsideOrEscape } from '../../hooks/useDismissOnOutsideOrEscape.js';

// task 39 收尾：MODEL_OPTIONS 已删，不再 export。
function ContextBreakdownPanel({ used, cap, onClose, triggerRef }) {
  const { t } = useTranslation();
  const [data, setData] = useStateC(null);
  const [loading, setLoading] = useStateC(true);
  const panelRef = useRefC(null);

  React.useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      setLoading(true);
      try {
        if (window.api && window.api.game && window.api.game.contextBreakdown) {
          const r = await window.api.game.contextBreakdown();
          if (!cancelled && r && r.ok !== false) setData(r);
        }
      } catch (_) {}
      if (!cancelled) setLoading(false);
    };
    doFetch();
    return () => { cancelled = true; };
  }, []);

  useDismissOnOutsideOrEscape(panelRef, triggerRef, onClose);

  const fmt = (n) => n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + "M"
                   : n >= 1_000     ? (n / 1_000).toFixed(1) + "k"
                   : String(n);
  const total = data ? (data.total_tokens || 0) : used;
  const limit = data ? (data.ctx_limit || cap) : cap;
  const pct = limit > 0 ? Math.max(0, Math.min(1, total / limit)) : 0;
  const pctTxt = (pct * 100).toFixed(0);
  const barColor = pct > 0.9 ? "var(--danger)" : pct > 0.7 ? "var(--warn)" : "var(--accent)";
  const breakdown = (data && data.breakdown) || [];
  const nonFree = breakdown.filter(b => b.key !== "free" && b.tokens > 0);

  return (
    <div className="gc-ctx-breakdown" ref={panelRef}>
      <div className="gc-ctx-breakdown-head">
        <span className="gc-ctx-breakdown-title">
          <svg width="13" height="13" viewBox="0 0 20 20" style={{display:"inline-block",verticalAlign:"-1px"}}>
            <circle cx="10" cy="10" r="8" fill="none" stroke={barColor} strokeWidth="2.5"
              strokeDasharray={`${pct * 50.27} 50.27`} strokeLinecap="round"
              transform="rotate(-90 10 10)" />
            <circle cx="10" cy="10" r="8" fill="none" stroke="var(--line)" strokeWidth="2.5" />
          </svg>
          {t('game.composer.ctx_usage_title')}
        </span>
        <span className="gc-ctx-breakdown-total">{fmt(total)} / {fmt(limit)} ({pctTxt}%)</span>
      </div>
      <div className="gc-ctx-breakdown-bar-wrap">
        <div className="gc-ctx-breakdown-bar">
          {nonFree.map(b => (
            <div key={b.key} className="gc-ctx-breakdown-bar-seg"
              style={{width: (b.pct || 0) + "%", background: b.color}} />
          ))}
        </div>
      </div>
      {loading && <div style={{padding:"12px",textAlign:"center",fontSize:12,color:"var(--muted)"}}>{t('game.composer.ctx_loading')}</div>}
      {!loading && breakdown.length > 0 && (
        <ul className="gc-ctx-breakdown-list">
          {breakdown.map(b => (
            <li key={b.key} className={`gc-ctx-breakdown-row${b.key === "free" ? " gc-ctx-breakdown-free" : ""}`}>
              <div className="gc-ctx-breakdown-dot" style={{background: b.color}} />
              <span className="gc-ctx-breakdown-label">{b.label}</span>
              <span className="gc-ctx-breakdown-tok">{fmt(b.tokens)}</span>
              <span className="gc-ctx-breakdown-pct">{b.pct}%</span>
            </li>
          ))}
        </ul>
      )}
      {!loading && breakdown.length === 0 && (
        <div style={{padding:"10px 12px",fontSize:12,color:"var(--muted)"}}>{t('game.composer.ctx_no_data')}</div>
      )}
    </div>
  );
}

function ContextUsage({ gameState, used: usedProp, cap: capProp }) {
  const { t } = useTranslation();
  const liveUsed = (gameState && gameState.memory && gameState.memory.last_context
                    && gameState.memory.last_context.estimated_tokens) || 0;
  const liveCap = (gameState && gameState.app && gameState.app.context_window) || 0;
  const used = usedProp != null ? usedProp : liveUsed;
  const cap = capProp != null ? capProp : (liveCap > 0 ? liveCap : 1_000_000);

  const [open, setOpen] = useStateC(false);
  const wrapRef = useRefC(null);

  const pct = Math.max(0, Math.min(1, used / cap));
  const r = 8;
  const c = 2 * Math.PI * r;
  const fmt = (n) => n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + "M"
                   : n >= 1_000     ? (n / 1_000).toFixed(1) + "k"
                   : String(n);
  const pctTxt = (pct * 100).toFixed(0);
  const color = pct > 0.9 ? "var(--danger)" : pct > 0.7 ? "var(--warn)" : "var(--accent)";

  return (
    <span className={`gc-context-usage gc-context-usage-ring${open ? " active" : ""}`}
      ref={wrapRef}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
      onClick={() => setOpen(o => !o)}
      title={t('game.composer.context_usage_tip')}>
      <svg width="20" height="20" viewBox="0 0 20 20" style={{display: "block"}}>
        <circle cx="10" cy="10" r={r} fill="none" stroke="var(--line)" strokeWidth="2" />
        <circle cx="10" cy="10" r={r} fill="none" stroke={color} strokeWidth="2"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          transform="rotate(-90 10 10)"
          style={{transition: "stroke-dashoffset 320ms cubic-bezier(0.16, 1, 0.3, 1)"}} />
      </svg>
      {open && <ContextBreakdownPanel used={used} cap={cap} onClose={() => setOpen(false)} triggerRef={wrapRef} />}
    </span>
  );
}

export { ContextBreakdownPanel, ContextUsage };
