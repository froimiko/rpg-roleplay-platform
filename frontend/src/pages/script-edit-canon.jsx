/* 路由壳 — CanonEntityEditorView / AnchorEditorView 两个编辑视图已拆到
   components/script-edit/(纯机械搬家,零 DOM/视觉/行为变化)。
   本文件只保留具名 export 转发,保持既有 import 路径不变
   (components/scripts/ScriptDetail.jsx 从这里 import CanonEntityEditorView)。 */

export { CanonEntityEditorView } from '../components/script-edit/CanonEntityEditorView.jsx';
export { AnchorEditorView } from '../components/script-edit/AnchorEditorView.jsx';
