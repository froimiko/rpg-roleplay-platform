/* new-game/StepMeta.jsx — 向导 STEP 3:引导与防剧透 + 故事意图。
   从 pages/MobileNewGame.jsx 纯机械搬出(区块逐字节等价,DOM/视觉/行为零变化)。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FieldLabel } from './shared.jsx';

/* ================================================================
   STEP 3 — 引导与防剧透 + 故事意图
   ================================================================ */
function StepMeta({ foreknowledge, setForeknowledge, steering, setSteering, storyIntent, setStoryIntent }) {
  const { t } = useTranslation();
  const segOpts = (opts, cur, set) => (
    <div className="pl-seg2">
      {opts.map(([v, lbl]) => (
        <button key={v} className={cur === v ? 'active' : ''} onClick={() => set(v)}>{lbl}</button>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {/* 元知识 */}
      <div>
        <FieldLabel hint={t('mobile.new_game.meta.foreknowledge_hint')}>{t('mobile.new_game.meta.foreknowledge_label')}</FieldLabel>
        {segOpts([
          ['none', t('mobile.new_game.meta.foreknowledge_none')],
          ['partial', t('mobile.new_game.meta.foreknowledge_partial')],
          ['omniscient', t('mobile.new_game.meta.foreknowledge_omniscient')],
        ], foreknowledge, setForeknowledge)}
      </div>

      {/* 引导强度 */}
      <div>
        <FieldLabel hint={t('mobile.new_game.meta.steering_hint')}>{t('mobile.new_game.meta.steering_label')}</FieldLabel>
        {segOpts([
          ['rail', t('mobile.new_game.meta.steering_rail')],
          ['guided', t('mobile.new_game.meta.steering_guided')],
          ['free', t('mobile.new_game.meta.steering_free')],
        ], steering, setSteering)}
      </div>

      {/* 故事意图 */}
      <div>
        <FieldLabel hint={t('mobile.new_game.meta.intent_hint')}>{t('mobile.new_game.meta.intent_label')}</FieldLabel>
        <textarea
          className="pl-input"
          rows={4}
          value={storyIntent}
          onChange={e => setStoryIntent(e.target.value)}
          placeholder={t('mobile.new_game.meta.intent_placeholder')}
        />
      </div>
    </div>
  );
}

export { StepMeta };
