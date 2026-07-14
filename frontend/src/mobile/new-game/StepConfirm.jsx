/* new-game/StepConfirm.jsx — 向导 STEP 4:确认。
   从 pages/MobileNewGame.jsx 纯机械搬出(区块逐字节等价,DOM/视觉/行为零变化)。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { ORIGIN_OPTIONS, isFromStartBirthpoint } from './helpers.js';
import { ErrBar } from './shared.jsx';

/* ================================================================
   STEP 4 — 确认
   ================================================================ */
function StepConfirm({ title, setTitle, scripts, scriptId, birthpoint, birthpointRequired, roleMode, pickedCard, newCardName, allRoleOptions, playerOrigin, identity, foreknowledge, npcAwareness, steering, spoiler, submitErr, submitting }) {
  const { t } = useTranslation();
  const selScript = scripts.find(s => String(s.id) === String(scriptId)) || null;
  const pickedOpt = allRoleOptions.find(o => o.key === pickedCard);
  const roleName = roleMode === 'new' ? (newCardName.trim() || t('mobile.new_game.confirm.new_role_fallback')) : (pickedOpt?.name || '—');
  const origLabel = (() => { const o = ORIGIN_OPTIONS.find(x => x.value === playerOrigin); return o ? t(o.labelKey) : playerOrigin; })();
  // 出生点未选:剧本本身没有锚点数据(不锁死)才算合法的"从开头"；
  // 若剧本要求选择但仍为空(理论上正常流程已挡在 step0,这里是兜底防御),渲染警示样式而非普通文案。
  const birthpointMissingButRequired = !birthpoint && birthpointRequired !== false;
  const birthpointLabel = birthpoint
    ? (isFromStartBirthpoint(birthpoint) ? t('mobile.new_game.confirm.from_start') : birthpoint.story_time_label)
    : (birthpointMissingButRequired ? t('mobile.new_game.confirm.birthpoint_unselected') : t('mobile.new_game.confirm.from_start'));

  const rows = [
    { k: t('mobile.new_game.confirm.row_save_name'), v: title.trim() || '—', highlight: !title.trim() },
    { k: t('mobile.new_game.confirm.row_script'), v: selScript?.title || '—', highlight: !selScript },
    { k: t('mobile.new_game.confirm.row_birthpoint'), v: birthpointLabel, highlight: birthpointMissingButRequired },
    { k: t('mobile.new_game.confirm.row_role'), v: roleName, highlight: !roleName || roleName === '—' },
    { k: t('mobile.new_game.confirm.row_origin'), v: origLabel },
    { k: t('mobile.new_game.confirm.row_identity'), v: identity ? `${identity.name || ''} ${identity.role || ''}`.trim() || t('mobile.new_game.confirm.identity_set') : t('mobile.new_game.confirm.identity_none') },
    { k: t('mobile.new_game.confirm.row_foreknowledge'), v: { none: t('mobile.new_game.meta.foreknowledge_none'), partial: t('mobile.new_game.meta.foreknowledge_partial'), omniscient: t('mobile.new_game.meta.foreknowledge_omniscient') }[foreknowledge] || foreknowledge },
    { k: t('mobile.new_game.confirm.row_steering'), v: { rail: t('mobile.new_game.meta.steering_rail'), guided: t('mobile.new_game.meta.steering_guided'), free: t('mobile.new_game.meta.steering_free') }[steering] || steering },
    { k: t('mobile.new_game.confirm.row_spoiler'), v: { strict: t('mobile.new_game.meta.spoiler_strict'), loose: t('mobile.new_game.meta.spoiler_loose') }[spoiler] || spoiler },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="pl-field">
        <label>{t('mobile.new_game.confirm.save_name_label')} <span style={{ color: 'var(--danger)' }}>*</span></label>
        <input
          className="pl-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('mobile.new_game.confirm.save_name_placeholder')}
          autoFocus
        />
      </div>

      <div style={{ border: '1px solid var(--line-soft)', borderRadius: 12, overflow: 'hidden' }}>
        {rows.map((row, i) => (
          <div key={row.k} style={{
            display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, alignItems: 'baseline',
            padding: '10px 13px', borderTop: i > 0 ? '1px solid var(--line-soft)' : 'none',
          }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted-2)' }}>{row.k}</span>
            <span style={{ fontSize: 13.5, color: row.highlight ? 'var(--danger)' : 'var(--text)', fontFamily: 'var(--font-serif)' }}>{row.v}</span>
          </div>
        ))}
      </div>

      <ErrBar msg={submitErr} />

      {submitting && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--muted)', justifyContent: 'center', padding: '6px 0' }}>
          <Icon name="spinner" size={13} className="spin" /> {t('mobile.new_game.confirm.creating')}
        </div>
      )}
    </div>
  );
}

export { StepConfirm };
