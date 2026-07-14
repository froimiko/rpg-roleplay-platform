/* MobileTavern 消息渲染块(Toast / 工具调用 / 思考流 / 段落)—— 从 pages/MobileTavern.jsx 拆出,逐字节不变。 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';

/* ─── 移动端 Toast ─────────────────────────────────────────────────── */
function MobileToast({ msg, kind }) {
  if (!msg) return null;
  return (
    <div className={`toast show ${kind || 'ok'}`}>
      <Icon name={kind === 'danger' ? 'warn' : 'check'} size={15} />
      {msg}
    </div>
  );
}

/* ─── 工具调用折叠块(对应桌面端 ToolCallBlock)─────────────────────── */
function ToolCallBlock({ ops }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!Array.isArray(ops) || ops.length === 0) return null;
  const n = ops.length;
  const firstName = (ops[0] && ops[0].tool) || t('mobile.tavern.tool.default_name');
  const summary = n === 1
    ? t('mobile.tavern.tool.call_one', { name: firstName })
    : t('mobile.tavern.tool.call_many', { count: n, name: firstName });
  function fmt(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v, null, 2); } catch (_) { return String(v); }
  }
  return (
    <div className="tv-m-tools">
      <button className="tv-m-tools-toggle" onClick={() => setOpen(v => !v)}>
        <span style={{ color: 'var(--muted-2)' }}>⚙</span>
        <Icon name={open ? 'chevron_down' : 'chevron_right'} size={11} />
        <span className="tv-m-tools-summary">{summary}</span>
      </button>
      {open && (
        <div className="tv-m-tools-detail">
          {ops.map((op, i) => (
            <div key={i} className="tv-m-tool-item">
              <div className="tv-m-tool-name">
                <span
                  className="tv-m-tool-dot"
                  style={{ background: op && op.ok === false ? 'var(--danger)' : 'var(--ok)' }}
                />
                {(op && op.tool) || t('mobile.tavern.tool.default_name')}
              </div>
              {op && op.args != null && (
                <pre className="tv-m-tool-kv"><span className="tv-m-tool-k">args </span>{fmt(op.args)}</pre>
              )}
              {op && (op.result != null || op.error != null) && (
                <pre className="tv-m-tool-kv" style={{ color: op.ok === false ? 'var(--danger)' : undefined }}>
                  <span className="tv-m-tool-k">{op.ok === false ? 'error ' : 'result '}</span>
                  {fmt(op.ok === false ? (op.error != null ? op.error : op.result) : op.result)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── 思考流折叠块 ──────────────────────────────────────────────────── */
function ThinkingBlock({ text }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="tv-m-thinking">
      <button className="tv-m-thinking-toggle" onClick={() => setOpen(v => !v)}>
        <Icon name={open ? 'chevron_down' : 'chevron_right'} size={11} />
        <span className="tv-m-thinking-label">{t('mobile.tavern.thinking.label')}</span>
      </button>
      {open && (
        <div className="tv-m-thinking-body">{text}</div>
      )}
    </div>
  );
}

/* ─── 正文段落渲染(把 \n\n 切段)────────────────────────────────────── */
function Paras({ text }) {
  if (!text) return null;
  return (
    <>
      {(text || '').split(/\n\n+/).map((p, i) => (
        <p key={i} style={{ margin: '0 0 0.85em' }}>
          {p.split(/\n/).map((ln, j) => (
            <React.Fragment key={j}>{j ? <br /> : null}{ln}</React.Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

export { MobileToast, ToolCallBlock, ThinkingBlock, Paras };
