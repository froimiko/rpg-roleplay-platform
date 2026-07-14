/* MobileMe · VIEW 成就墙 Wall —— 从 pages/MobileMe.jsx 拆出,逐字节不变。 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { fmtDate, ACHV_CAT_ORDER, TIER_COLOR } from './helpers.js';
import { PageHead } from './shared.jsx';

/* ═══════════════════════════════════════════════════════════════════
   VIEW: 成就墙 Wall
   ═══════════════════════════════════════════════════════════════════ */
function ViewWall({ nav, user }) {
  const { t } = useTranslation();
  const [achv, setAchv] = useState(null);
  const [err, setErr] = useState('');
  // 支持查看他人公开墙：从 nav.params.username 读 or 查自己
  const targetUser = (nav.params && nav.params.username) || null;
  const isOther = !!targetUser && targetUser !== user?.username;

  useEffect(() => {
    let cancelled = false;
    setErr('');
    (async () => {
      try {
        if (isOther) {
          const r = await window.api.account.publicWall(targetUser);
          if (!cancelled) setAchv(r);
        } else {
          const r = await window.api.account.achievements();
          if (!cancelled) setAchv({ items: (r && r.items) || [], display_name: user?.display_name, username: user?.username, unlocked_count: ((r && r.items) || []).filter(a => a.unlocked).length, total: ((r && r.items) || []).length });
        }
      } catch (e) {
        if (!cancelled) setErr((e && e.message) || t('mobile.me.wall.load_error'));
      }
    })();
    return () => { cancelled = true; };
  }, [isOther, targetUser]);

  const items = achv?.items || [];
  const unlockedCount = achv?.unlocked_count ?? items.filter(a => a.unlocked).length;
  const total = achv?.total ?? items.length;

  // 按分类分组
  const groups = (() => {
    const m = new Map();
    items.forEach(a => {
      const cat = a.category || t('mobile.me.wall.other_category');
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat).push(a);
    });
    return [...m.keys()]
      .sort((x, y) => (ACHV_CAT_ORDER.indexOf(x) < 0 ? 99 : ACHV_CAT_ORDER.indexOf(x)) - (ACHV_CAT_ORDER.indexOf(y) < 0 ? 99 : ACHV_CAT_ORDER.indexOf(y)))
      .map(k => [k, m.get(k)]);
  })();

  const onCopyWallLink = async () => {
    const u = user?.username || '';
    const url = `${location.origin}/wall?u=${encodeURIComponent(u)}`;
    try {
      await navigator.clipboard.writeText(url);
      nav.toast(t('mobile.me.wall.link_copied'), 'ok', 'copy');
    } catch (_) {
      nav.toast(url, 'ok', 'info');
    }
  };

  return (
    <>
      <PageHead
        title={isOther ? (achv?.display_name || targetUser || t('mobile.me.wall.title')) : t('mobile.me.wall.my_title')}
        sub={achv ? t('mobile.me.wall.unlocked_sub', { unlocked: unlockedCount, total }) : t('common.loading')}
        onBack={() => nav.go('me')}
        actions={!isOther && unlockedCount > 0 && (
          <button className="pl-headbtn" onClick={onCopyWallLink} aria-label={t('mobile.me.wall.share_link')}>
            <Icon name="link" size={17} />
          </button>
        )}
      />
      <div className="pl-body tabbed">
        <div className="pl-pad">
          {err ? (
            <div className="pl-empty">{err.includes('404') || err.includes('not found') ? t('mobile.me.wall.not_public') : err}</div>
          ) : achv === null ? (
            <div className="pl-empty">{t('common.loading')}</div>
          ) : items.length === 0 ? (
            <div className="pl-empty">{t('mobile.me.overview.no_achievements')}</div>
          ) : (
            groups.map(([cat, list]) => {
              const unl = list.filter(a => a.unlocked).length;
              return (
                <div key={cat} className="pl-sec">
                  <div className="pl-sec-head">
                    <h2>{cat}</h2>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>{unl}/{list.length}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {list.map(a => (
                      <div key={a.id} style={{
                        padding: '10px 11px', borderRadius: 10,
                        background: a.unlocked ? 'var(--panel)' : 'var(--bg)',
                        border: '1px solid ' + (a.unlocked ? (TIER_COLOR[a.tier] ? TIER_COLOR[a.tier] + '66' : 'var(--line-soft)') : 'var(--line-soft)'),
                        opacity: a.unlocked ? 1 : 0.55,
                        display: 'flex', gap: 9, alignItems: 'flex-start',
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                          display: 'grid', placeItems: 'center', fontSize: 18,
                          background: a.unlocked ? (TIER_COLOR[a.tier] ? TIER_COLOR[a.tier] + '22' : 'var(--panel-2)') : 'var(--panel-3)',
                          border: '1px solid ' + (a.unlocked && TIER_COLOR[a.tier] ? TIER_COLOR[a.tier] + '44' : 'var(--line-soft)'),
                        }}>
                          {a.icon ? a.icon : (a.unlocked ? <Icon name="check" size={14} /> : <Icon name="lock" size={12} />)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{a.desc}</div>
                          {a.unlocked ? (
                            <div className="mono" style={{ fontSize: 10, color: TIER_COLOR[a.tier] || 'var(--ok)', marginTop: 3 }}>
                              {a.unlocked_at ? fmtDate(a.unlocked_at) : t('mobile.me.wall.achieved')}
                              {a.rarity != null ? ` · ${a.rarity}%` : ''}
                            </div>
                          ) : (
                            a.target != null && (
                              <div style={{ marginTop: 5 }}>
                                <div style={{ height: 3, borderRadius: 2, background: 'var(--panel-3)', overflow: 'hidden', marginBottom: 2 }}>
                                  <div style={{ width: (a.pct || 0) + '%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                                </div>
                                <div className="mono" style={{ fontSize: 10, color: 'var(--muted-2)' }}>
                                  {Number(a.value || 0).toLocaleString()} / {Number(a.target || 0).toLocaleString()}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

export { ViewWall };
