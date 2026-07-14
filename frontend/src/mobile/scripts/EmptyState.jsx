/* 通用空态 —— 从 pages/MobileScripts.jsx 拆出,逐字节不变。 */

import React from 'react';
import { Icon } from '../icons.jsx';

/* ─── 通用空态 ─────────────────────────────────── */
function EmptyState({ icon = 'book_open', title, desc, action }) {
  return (
    <div className="pl-empty">
      <div className="ic"><Icon name={icon} size={24} /></div>
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
      {action}
    </div>
  );
}

export { EmptyState };
