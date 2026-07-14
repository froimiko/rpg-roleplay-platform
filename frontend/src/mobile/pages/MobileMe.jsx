/* MobileMe.jsx — 移动端"我的中心"路由壳(overview / edit / settings / usage / wall)。
   页面主体已按职责纯机械拆到 ../me/*(逐字节等价、DOM/视觉/行为零变化)。
   铁律:零 Cloudscape / 零电脑端 UI 复用;数据全接 window.api.*;
        ConfirmSheet 纯 inline scrim0.6/圆角20/无滑入,防误合清单点名项,原样保留(见 ../me/shared.jsx)。
   nav={go, switchTab, push, pop, toast, page, params:{section}} */
import React, { useState } from 'react';
import { useReactiveUser } from '../../platform-app.jsx';
import { ViewOverview } from '../me/ViewOverview.jsx';
import { ViewEdit } from '../me/ViewEdit.jsx';
import { ViewSettings } from '../me/ViewSettings.jsx';
import { ViewUsage } from '../me/ViewUsage.jsx';
import { ViewWall } from '../me/ViewWall.jsx';

/* ═══════════════════════════════════════════════════════════════════
   主组件 MobileMe
   ═══════════════════════════════════════════════════════════════════ */
export function MobileMe({ nav }) {
  const user = useReactiveUser();

  // 初始 view 由 nav.page 决定
  const [view, setView] = useState(() => {
    const p = nav?.page || 'me';
    if (p === 'me-edit') return 'edit';
    if (p === 'me-settings') return 'settings';
    if (p === 'usage') return 'usage';
    if (p === 'wall') return 'wall';
    return 'overview';
  });

  // 包装 nav.go 使内部可跳转到同组件的其他 view
  const innerNav = {
    ...nav,
    go: (pageId) => {
      const viewMap = { me: 'overview', 'me-edit': 'edit', 'me-settings': 'settings', usage: 'usage', wall: 'wall' };
      if (viewMap[pageId] !== undefined) {
        setView(viewMap[pageId]);
      } else {
        nav.go?.(pageId);
      }
    },
  };

  if (view === 'edit') return <ViewEdit nav={innerNav} user={user} />;
  if (view === 'settings') return <ViewSettings nav={innerNav} user={user} />;
  if (view === 'usage') return <ViewUsage nav={innerNav} />;
  if (view === 'wall') return <ViewWall nav={innerNav} user={user} />;
  return <ViewOverview nav={innerNav} user={user} />;
}

export default MobileMe;
