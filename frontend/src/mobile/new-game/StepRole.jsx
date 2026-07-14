/* new-game/StepRole.jsx — 向导 STEP 1:角色卡。
   从 pages/MobileNewGame.jsx 纯机械搬出(区块逐字节等价,DOM/视觉/行为零变化)。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { FieldLabel } from './shared.jsx';

/* ================================================================
   STEP 1 — 角色卡
   ================================================================ */
function StepRole({ personas, userCards, roleMode, setRoleMode, pickedCard, setPickedCard, newCardName, setNewCardName, newCardRole, setNewCardRole, newCardBg, setNewCardBg }) {
  const { t } = useTranslation();
  const allOpts = [
    ...personas.map(p => ({ key: `persona:${p.id || p.slug}`, kind: 'persona', name: p.name || t('mobile.new_game.role.unnamed'), subtitle: p.role || t('mobile.new_game.role.kind_persona'), id: p.id, slug: p.slug, pinned: !!p.is_default })),
    ...userCards.map(c => ({ key: `user:${c.id || c.slug}`, kind: 'user_card', name: c.name || t('mobile.new_game.role.unnamed'), subtitle: c.identity || c.role || t('mobile.new_game.role.kind_card'), id: c.id, slug: c.slug, pinned: false })),
  ];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 模式切换 */}
      <div>
        <FieldLabel>{t('mobile.new_game.role.source_label')}</FieldLabel>
        <div className="pl-seg2" style={{ marginBottom: 16 }}>
          <button className={roleMode === 'existing' ? 'active' : ''} disabled={allOpts.length === 0} onClick={() => setRoleMode('existing')}>
            {t('mobile.new_game.role.pick_existing')}
          </button>
          <button className={roleMode === 'new' ? 'active' : ''} onClick={() => setRoleMode('new')}>
            {t('mobile.new_game.role.create_new')}
          </button>
        </div>
      </div>

      {/* 现有卡列表 */}
      {roleMode === 'existing' && (
        allOpts.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '10px 0', lineHeight: 1.6 }}>
            {t('mobile.new_game.role.existing_empty')}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 7 }}>
            {allOpts.map(opt => {
              const sel = pickedCard === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setPickedCard(opt.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 13px',
                    border: sel ? '1px solid var(--accent-edge)' : '1px solid var(--line-soft)',
                    borderRadius: 12, background: sel ? 'var(--accent-soft)' : 'var(--panel)',
                    textAlign: 'left', transition: 'border-color .12s, background .12s', width: '100%',
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    display: 'grid', placeItems: 'center',
                    background: sel ? 'var(--accent)' : 'var(--panel-3)',
                    border: '1px solid var(--line)',
                    fontFamily: 'var(--font-serif)', fontSize: 17,
                    color: sel ? '#fff8f3' : 'var(--text)',
                  }}>
                    {opt.name.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: sel ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.name}</span>
                      {opt.pinned && <span className="pill accent" style={{ fontSize: 10 }}>{t('mobile.new_game.role.default_badge')}</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 2 }}>
                      {opt.subtitle} · {opt.kind === 'persona' ? t('mobile.new_game.role.kind_persona') : t('mobile.new_game.role.kind_card')}
                    </div>
                  </div>
                  {sel && <Icon name="check" size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )
      )}

      {/* 新建角色 */}
      {roleMode === 'new' && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="pl-field">
            <label>{t('mobile.new_game.role.new_name_label')} <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              className="pl-input"
              placeholder={t('mobile.new_game.role.new_name_placeholder')}
              value={newCardName}
              onChange={e => setNewCardName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="pl-field">
            <label>{t('mobile.new_game.role.new_role_label')}</label>
            <input
              className="pl-input"
              placeholder={t('mobile.new_game.role.new_role_placeholder')}
              value={newCardRole}
              onChange={e => setNewCardRole(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="pl-field">
            <label>{t('mobile.new_game.role.new_bg_label')}</label>
            <textarea
              className="pl-input"
              placeholder={t('mobile.new_game.role.new_bg_placeholder')}
              value={newCardBg}
              onChange={e => setNewCardBg(e.target.value)}
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export { StepRole };
