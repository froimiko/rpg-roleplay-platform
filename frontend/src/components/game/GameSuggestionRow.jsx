/* Game Console composer — 建议行(SuggestionRow)。
   纯机械从 game-composer.jsx 搬出,DOM/视觉/行为零变化。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../game-icons.jsx';

function SuggestionRow({ suggestions, onPick }) {
  const { t } = useTranslation();
  if (!suggestions?.length) return null;
  return (
    <div className="gc-suggestions">
      <div className="gc-suggestions-label muted-2">
        <Icon name="compass" size={12} /> {t('game.composer.based_on_story')}
      </div>
      <div className="gc-suggestions-row">
        {suggestions.map((s, i) => (
          <button key={i} className="gc-suggestion serif" onClick={() => onPick(s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}

export { SuggestionRow };
