// ToolCallBlock —— 后台工具调用折叠块(可折叠、默认折叠、沉浸优先)。
// 把一轮内连续的工具调用归组,默认折叠成一行摘要(如「⚙ 调用 2 个工具 · set_tavern_character…」)。
// 展开后逐个列出工具名 + args + result。与角色扮演正文(NarrativeBlock)视觉分离,
// 静音/后台风,不抢沉浸主体。ops 形如 [{tool, args, result, ok}]。
//
// 从 tavern-app.jsx 抽出为独立模块:game-app 的消息渲染也把它当 renderTool 传给
// NarrativeBlock,而 tavern-app 本身 import 了 game-app 的一批组件 —— game-app 若反向
// import tavern-app 即成环。抽出后两边都从这里 import,无环。
// (此前 game-app.jsx 对 ToolCallBlock 是裸引用零 import:原版数据流里 game console 消息
// 恒无 tool_ops、箭头函数从不执行所以从未炸;但任何人把工具数据接进 game console 消息流
// 立刻 ReferenceError 整页白屏 —— 自部署用户实锤踩雷,故根治。)
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../game-icons.jsx';

function _fmtToolValue(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v, null, 2); } catch (_) { return String(v); }
}

export function ToolCallBlock({ ops }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!Array.isArray(ops) || ops.length === 0) return null;
  const n = ops.length;
  const firstName = (ops[0] && ops[0].tool) || t('tavern_app.tool_block.tool_fallback');
  const summary = n === 1
    ? t('tavern_app.tool_block.summary_one', { name: firstName })
    : t('tavern_app.tool_block.summary_many', { count: n, name: firstName });
  return (
    <div className={`tvp-tools${open ? ' open' : ''}`}>
      <button
        type="button"
        className="tvp-tools-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="tvp-tools-gear" aria-hidden="true">⚙</span>
        <Icon name={open ? 'chevron_down' : 'chevron_right'} size={11} />
        <span className="tvp-tools-summary">{summary}</span>
      </button>
      {open && (
        <div className="tvp-tools-detail">
          {ops.map((op, i) => (
            <div className="tvp-tool-item" key={i}>
              <div className="tvp-tool-name">
                <span className={`tvp-tool-dot${op && op.ok === false ? ' err' : ''}`} aria-hidden="true" />
                {(op && op.tool) || t('tavern_app.tool_block.tool_fallback')}
              </div>
              {op && op.args != null && (
                <pre className="tvp-tool-kv"><span className="tvp-tool-kv-k">args</span>{_fmtToolValue(op.args)}</pre>
              )}
              {op && (op.result != null || op.error != null) && (
                <pre className={`tvp-tool-kv${op.ok === false ? ' err' : ''}`}>
                  <span className="tvp-tool-kv-k">{op.ok === false ? 'error' : 'result'}</span>
                  {_fmtToolValue(op.ok === false ? (op.error != null ? op.error : op.result) : op.result)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
