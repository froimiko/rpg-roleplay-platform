// 个人中心 转发壳(概览 / 编辑资料 / 用户设置 三页面级组件已二次拆分到同目录)。
// platform-app.jsx 只引用 MePage,此壳保持其 import 面不变。
import React from 'react';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import { MeOverview } from './MeOverview.jsx';
import { MeEditProfile } from './MeEditProfile.jsx';
import { MeUserSettings } from './MeUserSettings.jsx';

function MePage({ subPage = "overview" }) {
  // 顶部 概览/编辑资料/用户设置 子导航已移除 —— 与侧栏「设置 & 账户」的
  // 个人主页 / 编辑资料 / 隐私与安全 完全重复,统一交给侧栏。
  return (
    <CSSpaceBetween size="l">
      {subPage === "overview" && <MeOverview />}
      {subPage === "edit" && <MeEditProfile />}
      {subPage === "settings" && <MeUserSettings />}
    </CSSpaceBetween>
  );
}

export { MePage };
