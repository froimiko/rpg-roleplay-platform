/* Game Console 右侧面板族 —— 拆分后的转发壳。
   原 2413 行按「每个 tab / section 一个文件」机械搬到 ./components/game/*(逐字节不动,零行为变化)。
   本文件从来没有模块级副作用(无 window.* 赋值 / 无 toast 装配),故壳内不留任何运行代码。
   具名 export 全部保留转发,外部引用面不变:
     · entries/game-console.jsx      → RightPanel / PANEL_TABS
     · tavern-drawer.jsx             → WorldbookOverlaySection / RegexScriptsSection
     · mobile/game/panels.jsx        → ForcedSetSection / WorldbookOverlaySection
     · __tests__/forced-set-section  → ForcedSetSection
   拆分目标结构对齐姊妹拆分(components/admin · settings · scripts · saves)。 */

export { RightPanel, PANEL_TABS } from './components/game/RightPanel.jsx';
export { PanelStatus } from './components/game/PanelStatus.jsx';
export { PanelRules } from './components/game/PanelRules.jsx';
export { PanelMemory } from './components/game/PanelMemory.jsx';
export { PanelWorldbook } from './components/game/PanelWorldbook.jsx';
export { PanelCharacters, CharacterCard } from './components/game/PanelCharacters.jsx';
export { PanelTimeline, WorldlineAnchorsSection } from './components/game/PanelTimeline.jsx';
export { PanelContext } from './components/game/PanelContext.jsx';
export { PanelDebug } from './components/game/PanelDebug.jsx';
export { ForcedSetSection } from './components/game/ForcedSetSection.jsx';
export { WorldbookOverlaySection, RegexScriptsSection } from './components/game/WorldbookSections.jsx';
