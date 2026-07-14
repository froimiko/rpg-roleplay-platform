/* Admin pages — 整页系统管理集合的转发壳。
   8+ 个管理页面组件已纯机械拆到 components/admin/*(DOM / props / fetch 路径零变化);
   本文件只保留具名 export 转发,供 platform-app.jsx(再转发给 entries/platform.jsx)消费。
   模块级副作用:无——原文件仅 fmtTime 纯函数(→ components/admin/shared.jsx)
   与 achv 常量(→ achievements-section.jsx),均随组件搬走。 */

export { AdminUsersPage } from '../components/admin/users-section.jsx';
export { AdminGlobalUsagePage } from '../components/admin/usage-section.jsx';
export { AdminAuditPage } from '../components/admin/audit-section.jsx';
export { AdminHealthPage } from '../components/admin/health-section.jsx';
export { AdminLogsPage } from '../components/admin/logs-section.jsx';
export { AdminRegistrationPage } from '../components/admin/registration-section.jsx';
export { AdminSecurityPage } from '../components/admin/security-section.jsx';
export { AdminDmcaTakedownsPage, AdminDmcaStrikesPage } from '../components/admin/dmca-sections.jsx';
export { AdminCsamReportsPage } from '../components/admin/csam-section.jsx';
export { AdminAupActionsPage } from '../components/admin/aup-section.jsx';
export { AdminMaintenancePage } from '../components/admin/maintenance-section.jsx';
export { AdminFeedbackPage } from '../components/admin/feedback-section.jsx';
export { AdminAchievementsPage } from '../components/admin/achievements-section.jsx';
