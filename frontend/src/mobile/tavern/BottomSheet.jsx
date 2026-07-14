/* MobileTavern 底部 sheet 容器(grip + scrim + 滑入 + 拖拽下滑关闭)—— 从 pages/MobileTavern.jsx 拆出,逐字节不变。
   防误合点名项:BottomSheet show 契约一个字不改。 */

import React from 'react';

/* ─── 底部 sheet(通用):带 grip + scrim + 滑入动画 + 拖拽下滑关闭 ─── */
function BottomSheet({ show, onClose, children, maxHeight = '82%' }) {
  const [dy, setDy] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const startY = React.useRef(0);
  const active = React.useRef(false);

  const onDown = React.useCallback((e) => {
    active.current = true; setDragging(true);
    startY.current = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
  }, []);
  const onMove = React.useCallback((e) => {
    if (!active.current) return;
    const y = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    setDy(Math.max(0, y - startY.current));
  }, []);
  const onUp = React.useCallback(() => {
    if (!active.current) return;
    active.current = false; setDragging(false);
    setDy((d) => { if (d > 110 && onClose) onClose(); return 0; });
  }, [onClose]);

  const sheetStyle = {
    maxHeight,
    ...(dy > 0 ? { transform: `translateY(${dy}px)` } : {}),
    ...(dragging ? { transition: 'none' } : {}),
  };

  return (
    <div className={`sheet-wrap${show ? ' show' : ''}`}>
      <div
        className="sheet-scrim"
        onClick={onClose}
        style={dragging ? { transition: 'none', opacity: Math.max(0, 1 - dy / 420) } : undefined}
      />
      <div className="sheet" style={sheetStyle}>
        <div
          className="sheet-grip"
          style={{ touchAction: 'none', cursor: 'grab', padding: '8px 0' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        {children}
      </div>
    </div>
  );
}

export { BottomSheet };
