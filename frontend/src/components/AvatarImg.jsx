import React from 'react';

/* AvatarImg — 通用头像组件。
   有 src → 渲 <img>，onError 回退到首字母 div；
   无 src → 直接渲首字母 div，复用调用方传入的 className 现有样式。

   props:
     src        : 图片 URL（可为空/null/undefined）
     name       : 显示名，用于取首字母兜底
     size       : 宽高 px（number；传 null/undefined 则不覆盖，由 className 控制）
     shape      : 'circle'(border-radius:50%) | 'rounded'(r-2 变量) | 'square'
     className  : 透传给 img 或 div 的 CSS class（复用现有如 pl-card-avatar / tv-chat-avatar）
*/
export default function AvatarImg({ src, name, size, shape, className }) {
  const { useState } = React;
  const [imgError, setImgError] = useState(false);

  const initial = (typeof name === 'string' && name.length > 0)
    ? name.slice(0, 1)
    : '?';

  const shapeStyle = shape === 'circle'
    ? { borderRadius: '50%' }
    : shape === 'rounded'
      ? { borderRadius: 'var(--r-2, 6px)' }
      : {};

  const sizeStyle = (size != null && typeof size === 'number')
    ? { width: size, height: size, flexShrink: 0 }
    : {};

  const commonStyle = { ...sizeStyle, ...shapeStyle };

  // 有 src 且尚未出错 → 渲 img
  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || ''}
        className={className || ''}
        style={{
          objectFit: 'cover',
          display: 'block',
          ...commonStyle,
        }}
        onError={() => setImgError(true)}
      />
    );
  }

  // 无 src 或 img 加载失败 → 渲首字母 div（复用传入的 className，如 pl-card-avatar）
  return (
    <div
      className={className || ''}
      style={commonStyle}
      aria-label={name || ''}
    >
      {initial}
    </div>
  );
}
