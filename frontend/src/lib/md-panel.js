// md-panel.js — CodeMirror 顶部提示条淡入淡出显隐收口。
// 从 lib/md-continue.js(AI 续写待定条)与 lib/md-diff.js(章节 diff 顶栏)两处
// 逐字节相同的 setPanelVisible 提炼,纯机械收口,行为零变化。

// 面板显隐做 120ms 淡入淡出而非硬切 display;dom._hideTimer 记录进行中的隐藏定时器,
// 显示时若隐藏还未完成(定时器仍在)要先清理,避免旧 timer 之后把刚显示的面板又摸黑藏起来。
export function setPanelVisible(dom, visible) {
  if (visible) {
    const wasHiding = !!dom._hideTimer;
    if (dom._hideTimer) { clearTimeout(dom._hideTimer); dom._hideTimer = null; }
    if (dom.style.display !== 'flex' || wasHiding) {
      dom.style.transition = 'opacity 120ms ease';
      dom.style.opacity = '0';
      dom.style.display = 'flex';
      requestAnimationFrame(() => { dom.style.opacity = '1'; });
    }
  } else if (!dom._hideTimer && dom.style.display !== 'none') {
    dom.style.transition = 'opacity 120ms ease';
    dom.style.opacity = '0';
    dom._hideTimer = setTimeout(() => {
      dom.style.display = 'none';
      dom._hideTimer = null;
    }, 120);
  }
}

export default setPanelVisible;
