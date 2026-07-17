/* useDismissOnOutsideOrEscape — 「Esc + 点击外部关闭」浮层/弹层 effect 收口。
 *
 * 从 components/game/GameComposerMenus.jsx(CommandMenu/AttachMenu)、
 * GameComposerPopovers.jsx(ModelPopover/PermissionPopover)、GameContextUsage.jsx
 * (ContextBreakdownPanel)五处逐字节/等价重复的 effect 提炼,纯机械收口,行为零变化。
 */
import React from 'react';

export function useDismissOnOutsideOrEscape(contentRef, triggerRef, onClose) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    const onOutside = (e) => {
      const inMenu = contentRef.current && contentRef.current.contains(e.target);
      const inTrigger = triggerRef && triggerRef.current && triggerRef.current.contains(e.target);
      if (!inMenu && !inTrigger) onClose && onClose();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onOutside, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onOutside, true);
    };
  }, [onClose, triggerRef]);
}

export default useDismissOnOutsideOrEscape;
