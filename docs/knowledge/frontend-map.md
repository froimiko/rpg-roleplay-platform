# 前端地图(frontend/src/)

React(Vite + Cloudscape Design)前端逐目录/模块职责。给 AI 协作者:找「某 UI 住哪」先查这里。
权威真相源(api-client / storage / toast / AgentModelPicker)见根 `CLAUDE.md`,不在此重复。
**UI 铁律**:不要 emoji / 装饰图标(状态用文字/边框/高亮,图标用 Cloudscape `iconName`);加设置项前先 grep 后端有没有真读那个 pref。

## 构建与入口

- **多入口**:`entries/`——`platform.jsx`(平台主 SPA)、`game-console.jsx`(游戏台)、`tavern.jsx`(酒馆)、`login.jsx`。对应根 HTML(`Platform.html`/`Game Console.html`/`Tavern.html`/`Login.html`)。Vite 配置见 `frontend/vite.config.js`。
- `router.js` — Platform SPA 轻量 History 路由(`plNavigate(id)` + `pl-navigate` 事件,干净 URL)。
- **顶层 App 壳**:`platform-app.jsx`、`game-app.jsx`、`tavern-app.jsx`、`login-app.jsx`。

## 核心通信/工具(必用,别自造)

- `api-client.js` — **后端 API 单一入口**,装 `window.api.<group>.<method>()`,同源 Cookie 会话 + SSE helper(`/api/chat`、`/api/opening`),离线回退 MOCK。
- `lib/storage.js` — localStorage 封装(`lsGet`/`lsSet`/`lsGetJSON`/`lsSetJSON`/`lsRemove`)。`lib/prefs.js` — 偏好读写。`lib/creds.js`/`lib/crypto-safe.js` — 凭据/加密。
- `toast.jsx` — **双 toast 总线**:`createToastChannel` + `setWindowToast`(平台 `window.toast`)/ `setApiToast`(游戏 `window.__apiToast`)。两条独立总线是刻意的,别合并、别自己 mount stack。
- `data-loader.js`、`state-event-bridge.js`、`runtime-telemetry.js`/`web-vitals-rum.js`(埋点)、`i18n/`(`index.js` + `locales/en.json`、`zh-CN.json`)。

## 页面(pages/)

整页视图:`admin.jsx`、`cards.jsx`、`saves.jsx`、`feedback.jsx`、`device.jsx`、`rath.jsx`(RATH 观测台)、`tavern.jsx`、`md-editor.jsx`(三栏 IDE 剧本编辑器)、`script-review.jsx`、`script-edit-canon.jsx`/`script-edit-worldbook.jsx`、`script-modules-panel.jsx`。

- **[拆分中]** `settings.jsx` 与 `scripts.jsx` 正被拆到 `components/settings/`、`components/scripts/`。当前壳很薄,**以完成后结构为准,别按行号引用**。TODO:拆分收尾后补全本节子模块清单。

## 组件(components/)

- `components/platform/` — 平台外壳页:`AuthPage.jsx`、`LibraryPage.jsx`、`ModulesPage.jsx`、`ProfilePage.jsx`、`UsagePage.jsx`、`CapPages.jsx`、`UnifiedSearch.jsx`、`DialogHost.jsx`、`WelcomeModal.jsx`、`achievements.jsx`、`me-pages.jsx`、`shared.jsx`。
- `components/settings/` — 设置分区(settings.jsx 拆分目标):`account-section`、`models-section`/`module-models-section`/`modelparams-section`、`memory-section`、`perm-section`、`deploy-section`、`danger-section`、`pref-sections`。
- `components/scripts/` — 剧本相关:`ScriptsList.jsx`、`ScriptDetail.jsx`、`ScriptsImport.jsx`。
- **可复用**:`AgentModelPicker.jsx`(**按需 LLM 增强统一用它**)、`Modal.jsx`/`ConfirmDialog.jsx`/`DetailDrawer.jsx`、`DesktopDialogHost.jsx`(桌面裸 confirm/prompt 的抽屉 Host)、`GlobalTaskFloater.jsx`(全局后台任务浮窗)、`HelpDrawer.jsx`(文档 iframe)、`ErrorBoundary.jsx`、`ToolCallBlock.jsx`、`PolicyNoticeBanner.jsx`、`AdultSplash.jsx`、`ModelConfigInterceptModal.jsx`。
- **编辑器/媒体**:`CodeMirrorEditor.jsx`、`MdEditorAgent.jsx`(写作搭档)、`EditorKbPanel.jsx`、`EditorPlaytest.jsx`、`GmStyleEditor.jsx`、`MediaStudio.jsx`/`MediaUploadZone.jsx`/`GenerateImageModal.jsx`/`ImageLightbox.jsx`/`ImageSizePicker.jsx`、`ModuleMatrixOverview.jsx`/`ModuleStatusCard.jsx`、`RebuildEstimateModal.jsx`/`RebuildJobBanner.jsx`、`AcceptanceAbPanel.jsx`(A/B 验收)、`FileLibrary.jsx`、`AvatarImg.jsx`/`CharacterCardHero.jsx`。

## 游戏台(顶层散件)

`game-app.jsx`(壳)、`game-composer.jsx`(输入区)、`game-panels.jsx`(侧栏面板)、`game-icons.jsx`、`console-assistant-navigation.jsx`、`branch-graph.jsx`(分支图)、`narrative-strip.js`、`markdown-render.jsx`、`worldbook-status-toast.js`。样式:`game-console.css`、`markdown-render.css`、`tavern.css`、`platform.css`、`media.css`、`motion.css`、`tokens.css`。

## Hooks / UI kit

- `hooks/` — `useTavernChatRun.js`(酒馆聊天回合)、`useImageGeneration.js`、`useStickToBottom.js`。
- `ui/` — `kit.jsx` + `kit.css`(共享 UI 原子)。
- `cloudscape-theme.js`、`responsive.jsx`、`ui-atlas.js`、`agent-modules.js`、`mock-data.js`。

## 移动 Web 壳(frontend/src/mobile/)

**注意:这是 web 前端内的响应式移动壳(`?m2=1` 门控),不是顶层 `mobile/` 那个独立 Expo app。**
`MobileRoot.jsx`(壳)、`MobileHome.jsx`、`chrome.jsx`、`launch.js`、`Composer.jsx`/`Field.jsx`/`Sheet.jsx`/`dialog.jsx`/`icons.jsx`、`game/`(`MobileGame.jsx`、`panels.jsx`)、`pages/`(`MobileSaves`/`MobileScripts`/`MobileCards`/`MobileTavern`/`MobileSettings`/`MobileMe`/`MobileNewGame`/`MobileCaps`/`MobileAdmin`)。

## 测试

- `__tests__/`(vitest 单测,真 EditorView / 真组件)、`e2e/`(Playwright,`playwright.config.js`)。
- 跑法:`cd frontend && npm run build && npm test`。类型:`npm run typecheck`(见 `TYPESCRIPT.md`)。
