/* 右侧面板外壳 + tab 定义(RightPanel / PANEL_TABS)—— 纯机械从 game-panels.jsx 搬出,零行为变化。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../game-icons.jsx';
import { lsGet } from '../../lib/storage.js';
import { PanelStatus } from './PanelStatus.jsx';
import { PanelRules } from './PanelRules.jsx';
import { PanelMemory } from './PanelMemory.jsx';
import { PanelWorldbook } from './PanelWorldbook.jsx';
import { PanelCharacters } from './PanelCharacters.jsx';
import { PanelTimeline } from './PanelTimeline.jsx';
import { PanelContext } from './PanelContext.jsx';
import { PanelDebug } from './PanelDebug.jsx';

const PANEL_TABS = [
  { id: "status", labelKey: "game.tabs.status", icon: "status" },
  { id: "rules", labelKey: "game.tabs.rules", icon: "debug" },
  { id: "memory", labelKey: "game.tabs.memory", icon: "memory" },
  { id: "worldbook", labelKey: "game.tabs.worldbook", icon: "world" },
  // Codex 评审:tab 改名"人物" — 不再是"完整角色卡库"的镜像,而是三层运行时索引:
  // 当前在场 (active_entities + encounter.combatants) / 关系 (relationships) /
  // 已固定角色卡 (entity.card_id 链接到平台 user_cards)。提升为长期角色卡只能在
  // 平台『角色卡』页操作,游戏内不创建。
  { id: "cards", labelKey: "game.tabs.cards", icon: "cards" },
  { id: "timeline", labelKey: "game.tabs.timeline", icon: "timeline" },
  { id: "context", labelKey: "game.tabs.context", icon: "context" },
  // 调试 tab 仅当 localStorage.rpg_devmode === "1" 时启用; 玩家面看不到
  ...(lsGet("rpg_devmode") === "1"
      ? [{ id: "debug", labelKey: "game.tabs.debug", icon: "debug" }]
      : []),
];

function RightPanel({ state, activeTab, setActiveTab, sidebarWidth, density, collapsed, onToggle, resizeHandle }) {
  const { t } = useTranslation();
  const tabs = PANEL_TABS;
  const active = tabs.find(tab => tab.id === activeTab) || tabs[0];
  let body = null;
  if (activeTab === "status") body = <PanelStatus state={state} panelWidth={sidebarWidth} />;
  else if (activeTab === "rules") body = <PanelRules state={state} />;
  else if (activeTab === "memory") body = <PanelMemory state={state} density={density} panelWidth={sidebarWidth} />;
  else if (activeTab === "worldbook") body = <PanelWorldbook state={state} panelWidth={sidebarWidth} />;
  else if (activeTab === "cards") body = <PanelCharacters state={state} panelWidth={sidebarWidth} />;
  else if (activeTab === "timeline") body = <PanelTimeline state={state} panelWidth={sidebarWidth} />;
  else if (activeTab === "context") body = <PanelContext state={state} />;
  else if (activeTab === "debug") body = <PanelDebug state={state} />;

  return (
    <aside className={`gp-panel ${collapsed ? "collapsed" : ""}`} style={{width: collapsed ? 0 : sidebarWidth}} aria-hidden={collapsed}>
      {!collapsed && resizeHandle}
      <div className="gp-panel-inner">
        <header className="gp-panel-head">
          <div className="gp-tabs">
            <button className="iconbtn gp-collapse-btn" onClick={onToggle} data-tip={t('game.panel.collapse_tip')} data-tip-pos="below">
              <Icon name="chevron_right" size={14} />
            </button>
            <span className="gp-tabs-sep" />
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`gp-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                data-tip={t(tab.labelKey)}
                data-tip-pos="below"
                aria-label={t(tab.labelKey)}
              >
                <Icon name={tab.icon} size={15} />
              </button>
            ))}
          </div>
          <div className="gp-panel-title">
            <h3>{t(active.labelKey)}</h3>
            <span className="muted-2 mono">{active.id}</span>
          </div>
        </header>
        <div className={`gp-panel-body${sidebarWidth < 280 ? " narrow" : ""}`}>{body}</div>
      </div>
    </aside>
  );
}

export { PANEL_TABS, RightPanel };
