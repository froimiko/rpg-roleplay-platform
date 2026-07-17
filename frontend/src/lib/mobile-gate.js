// mobile-gate.js — 移动壳灰度开关收口。
// 从 entries/platform.jsx(MOBILE_V2_ENABLED)与 entries/game-console.jsx
// (MOBILE_GAME_ENABLED)两处逐字节相同的 IIFE 提炼,纯机械收口,行为零变化;
// 求值时机仍由调用处在模块加载期立即执行(const X = isMobileV2Enabled();)。
//
// 移动外壳灰度开关:迁移期默认关闭(零影响真机用户),开发用 ?m2=1 或 localStorage。
// P8 收尾时改为 width<600 默认开。
import { lsGet, lsSet, lsRemove } from './storage.js';

export function isMobileV2Enabled() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('m2') === '1') { lsSet('rpg_mobile_v2', '1'); return true; }
    if (q.get('m2') === '0') { lsRemove('rpg_mobile_v2'); return false; }
    return lsGet('rpg_mobile_v2') === '1';
  } catch (_) { return false; }
}

export default isMobileV2Enabled;
