/* 移动端裸开关(pl-toggle)—— 权威单一实现,mobile/caps 与 mobile/settings 两侧 shared.jsx
   经 re-export 共用。以 caps 版为蓝本(功能更全:支持 disabled 灰化 + 拦截 onChange)逐字复制。
   settings 侧现有调用均不传 disabled,行为与旧的无 disabled 版逐字一致(!undefined→true)。 */
import React from 'react';

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      className={'pl-toggle' + (on ? ' on' : '')}
      onClick={() => !disabled && onChange(!on)}
      role="switch"
      aria-checked={on}
      style={disabled ? { opacity: 0.45, pointerEvents: 'none' } : undefined}
    />
  );
}

export { Toggle };
