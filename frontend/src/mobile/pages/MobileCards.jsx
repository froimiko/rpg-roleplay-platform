/* MobileCards — 移动端角色卡管理(我的 / NPC / 在线库)
   覆盖路由: cards / cards-npc / cards-online
   铁律:
   - 零 Cloudscape/CS* 组件
   - 数据层 100% 复用 window.api.cards.*
   - 样式只用 mobile.css 已有 class + inline style
   - 子视图(列表→详情→编辑)用 useState 管理,不依赖外部路由 */

/* 页面主体已按职责纯机械拆到 ../cards/*(逐字节等价、DOM/视觉/行为零变化):
   helpers.js(clamp/fmtBytes)、shared.jsx(SubHead/CardAv/Tag/ProseBlock/Field/ScopeSelect)、
   CardForm.jsx(CardEditForm)、CardDetail.jsx、CardEditor.jsx、sheets.jsx(ImportSheet/DeleteSheet)、
   UserView.jsx / NpcView.jsx / OnlineView.jsx。跨端 import(pages/cards.jsx 的 cardFormInit/cardFormPayload)
   随 CardEditor 原样保留;MobileRoot.jsx 引用不变:具名 export function MobileCards + default。 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserView } from '../cards/UserView.jsx';
import { NpcView } from '../cards/NpcView.jsx';
import { OnlineView } from '../cards/OnlineView.jsx';

/* ═══════════════════════════════════════════════════════════════════
   根组件 MobileCards
   pageId 区分: 'cards' → 用户卡, 'cards-npc' → NPC, 'cards-online' → 在线库
   ═══════════════════════════════════════════════════════════════════ */
export function MobileCards({ nav }) {
  const { t } = useTranslation();
  // 由 pageId 决定初始 tab,也支持底部 tab pill 切换
  const initTab = () => {
    const pid = nav?.pageId || 'cards';
    if (pid === 'cards-npc') return 'npc';
    if (pid === 'cards-online') return 'online';
    return 'user';
  };
  const [tab, setTab] = useState(initTab);

  const TABS = [
    { id: 'user', l: t('mobile.cards.tabs.my') },
    { id: 'npc', l: 'NPC' },
    { id: 'online', l: t('mobile.cards.tabs.online') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab 切换条(固定在顶部下方) */}
      <div className="pl-seg-scroll" style={{ flexShrink: 0, padding: '8px 16px 0', borderBottom: '1px solid var(--line-soft)', background: 'var(--bg)' }}>
        {TABS.map((t) => (
          <button key={t.id} className={'pl-pill' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            {t.l}
          </button>
        ))}
        <div style={{ flex: 1 }} />
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'user' && <UserView key="user" nav={nav} />}
        {tab === 'npc' && <NpcView key="npc" nav={nav} />}
        {tab === 'online' && <OnlineView key="online" nav={nav} />}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default MobileCards;
