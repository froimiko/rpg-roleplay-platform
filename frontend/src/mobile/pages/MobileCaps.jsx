/**
 * MobileCaps.jsx — 能力与反馈(移动原生 UI)
 * 覆盖路由: plugins / mcp / skills / apis / feedback
 * 铁律:零 Cloudscape / 零电脑端组件复用。数据层全接 window.api.*。
 */
import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { PluginsSection } from '../caps/PluginsSection.jsx';
import { McpSection } from '../caps/McpSection.jsx';
import { SkillsSection } from '../caps/SkillsSection.jsx';
import { ApisSection } from '../caps/ApisSection.jsx';
import { FeedbackSection } from '../caps/FeedbackSection.jsx';

/* ──────────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────────── */
const TABS = [
  { id: 'plugins', labelKey: 'mobile.caps.tab.plugins', icon: 'plug'    },
  { id: 'mcp',     labelKey: 'mobile.caps.tab.mcp',     icon: 'diamond' },
  { id: 'skills',  labelKey: 'mobile.caps.tab.skills',  icon: 'spark'   },
  { id: 'apis',    labelKey: 'mobile.caps.tab.apis',    icon: 'braces'  },
  { id: 'feedback',labelKey: 'mobile.caps.tab.feedback',icon: 'feedback'},
];

/* ──────────────────────────────────────────────────────────────────
   Root Component
   ────────────────────────────────────────────────────────────────── */
export function MobileCaps({ nav }) {
  const { t } = useTranslation();
  // Derive initial section from nav.page
  const initial = (() => {
    const p = nav?.page || '';
    if (TABS.find(tab => tab.id === p)) return p;
    return 'plugins';
  })();
  const [section, setSection] = useState(initial);

  // Sync when nav.page changes externally
  const prevPage = useRef(nav?.page);
  if (nav?.page !== prevPage.current) {
    prevPage.current = nav?.page;
    const p = nav?.page || '';
    if (TABS.find(tab => tab.id === p) && p !== section) {
      setSection(p);
    }
  }

  const toast = useCallback((msg, kind = 'info') => {
    nav?.toast?.(msg, kind);
  }, [nav]);

  return (
    <>
      {/* Header */}
      <div className="pl-head">
        <button className="pl-back" onClick={() => nav?.pop?.() || nav?.switchTab?.('me')} aria-label={t('mobile.caps.header.back')}>
          <Icon name="chevron_left" size={18} />
        </button>
        <div className="pl-head-title">
          <strong>{t('mobile.caps.header.title')}</strong>
        </div>
      </div>

      {/* Tab bar (horizontal scrollable pill row) */}
      <div className="pl-seg-scroll" style={{ borderBottom: '1px solid var(--line-soft)', padding: '10px 16px 11px' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={'pl-pill' + (section === tab.id ? ' active' : '')}
            onClick={() => setSection(tab.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name={tab.icon} size={13} />
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pl-body">
        {section === 'plugins'  && <PluginsSection  toast={toast} />}
        {section === 'mcp'      && <McpSection      toast={toast} />}
        {section === 'skills'   && <SkillsSection   toast={toast} />}
        {section === 'apis'     && <ApisSection     toast={toast} />}
        {section === 'feedback' && <FeedbackSection toast={toast} />}
      </div>
    </>
  );
}

export default MobileCaps;
