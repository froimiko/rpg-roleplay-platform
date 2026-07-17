/* Shared icon set for the RPG console — minimal stroke icons.
   All icons are 24x24 viewBox, currentColor stroke. */
import React from 'react';
import { SHARED_ICON_PATHS } from './lib/icon-paths.jsx';

const Icon = ({ name, size = 16, strokeWidth = 1.6, style }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style,
  };
  const paths = {
    ...SHARED_ICON_PATHS,

    // navigation / chrome — 平台独有 + 与 mobile/icons.jsx 同名不同形(见 icon-paths.jsx 头注)
    minus: <path d="M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    settings: <><path d="M19.4 14.6a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /><circle cx="12" cy="12" r="3" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    message_square: <><path d="M5 5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><path d="M8 10h8M8 14h5" /></>,
    user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c1.5-3.4 4.1-5 7-5s5.5 1.6 7 5" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)

    // platform nav — 与 mobile/icons.jsx 同名不同形
    folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    plug: <><path d="M10.5 3a1.5 1.5 0 0 0-1.5 1.5V7H6a2 2 0 0 0-2 2v3.5h2.5a1.5 1.5 0 0 1 0 3H4V19a2 2 0 0 0 2 2h3.5v-2.5a1.5 1.5 0 0 1 3 0V21H16a2 2 0 0 0 2-2v-3.5h2.5a1.5 1.5 0 0 0 0-3H18V9a2 2 0 0 0-2-2h-3v-2.5A1.5 1.5 0 0 0 11.5 3z" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    diamond: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M8 6h8M7.5 8l3 8M16.5 8l-3 8" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    braces: <><path d="M9 4H7a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h2" /><path d="M15 4h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-2" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    usage: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)

    // right-panel tabs — 平台独有
    context: <><path d="M5 4h14v5H5z" /><path d="M5 13h14v7H5z" /><path d="M9 16h6" /></>,
    debug: <><path d="M12 7v10M8 9l-2-2M16 9l2-2M8 15l-2 2M16 15l2 2" /><rect x="9" y="7" width="6" height="10" rx="3" /></>,

    // composer / actions — 平台独有
    attach: <path d="M21 11.5l-9 9a5 5 0 1 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" />,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    diamond_sm: <><path d="M12 4 20 12 12 20 4 12z" /></>,

    // statuses — 平台独有 + 与 mobile/icons.jsx 同名不同形
    spinner: <><path d="M12 3a9 9 0 1 1-9 9" /></>,
    err: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
    drag: <><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></>,
    git_branch: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><circle cx="6" cy="18" r="2" /><path d="M6 8v8M8 6h6a4 4 0 0 1 4 4v6" /></>,
    grid: <><rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    list: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r=".5" /><circle cx="4" cy="12" r=".5" /><circle cx="4" cy="18" r=".5" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    upload: <><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    download: <><path d="M12 4v12M6 14l6 6 6-6" /><path d="M4 4h16" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    more: <><circle cx="6" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18" cy="12" r="1" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    link: <><path d="M10 14a4 4 0 0 0 5 .5l3-3a4 4 0 0 0-5.6-5.6L11 7" /><path d="M14 10a4 4 0 0 0-5-.5l-3 3a4 4 0 0 0 5.6 5.6L13 17" /></>, // DIVERGED: 与另一端同名不同形,待设计定夺(2026-07-17 审计)
    quote: <><path d="M6 7h4v4l-3 5H4V11a4 4 0 0 1 2-4zM16 7h4v4l-3 5h-3V11a4 4 0 0 1 2-4z" /></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
};

window.Icon = Icon;
export { Icon };
