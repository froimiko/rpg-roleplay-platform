/* Saves page shell —— 路由入口 (存档列表 / 分支管理)。
   页面主体已按「列表 / 分支+继续 / 新游戏」拆到 ../components/saves/*(纯机械搬家,零行为变化)。
   具名 export 全部保留转发,外部(entries/platform.jsx / platform-app.jsx / scripts 等)引用面不变。 */

import React from 'react';
import { SavesListView } from '../components/saves/SavesList.jsx';
import { BranchesPage, ContinuePicker } from '../components/saves/Branches.jsx';
import { NewGameModal } from '../components/saves/NewGame.jsx';

/* ---------------------------- SAVES ---------------------------- */
function SavesPage({ subPage = "list" }) {
  return (
    <div className="pl-stack">
      {subPage === "branches" ? <BranchesPage /> : <SavesListView />}
    </div>
  );
}

export { SavesPage, SavesListView, BranchesPage, ContinuePicker, NewGameModal };
