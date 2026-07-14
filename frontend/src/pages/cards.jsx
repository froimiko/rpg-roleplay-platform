/* Cards page shell —— 路由入口(用户卡 / NPC 卡 / 在线卡库)。
   页面主体已按职责拆到 ../components/cards/*(纯机械搬家,DOM / 视觉 / 行为零变化)。
   具名 export 全部保留转发,外部(entries/platform · tavern · scripts · saves · mobile)引用面不变。 */

import React from 'react';
import { OnlineCardsView, UserCardsView, NpcCardsView } from '../components/cards/CardViews.jsx';
import { CardGrid } from '../components/cards/CardGrid.jsx';
import { CardEditModal } from '../components/cards/CardEditModal.jsx';
import { TavernImportModal } from '../components/cards/TavernImportModal.jsx';
import { CardSheet, CardEditFields } from '../components/cards/CardFields.jsx';
import { cardSnippet, cardFormInit, cardFormPayload, npcToUserCardBody } from '../components/cards/helpers.js';

function CardsPage({ subPage = "user" }) {
  return (
    <div className="pl-stack">
      {subPage === "npc" ? <NpcCardsView />
        : subPage === "online" ? <OnlineCardsView />
        : <UserCardsView />}
    </div>
  );
}

export { CardsPage, CardGrid, UserCardsView, NpcCardsView, CardEditModal, TavernImportModal, CardSheet, cardSnippet, CardEditFields, cardFormInit, cardFormPayload, npcToUserCardBody };
