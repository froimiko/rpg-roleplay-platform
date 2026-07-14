/* MobileCards 卡片编辑表单 CardEditForm(用户卡 + NPC 共用)—— 从 pages/MobileCards.jsx 拆出,逐字节不变。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Field, ScopeSelect } from './shared.jsx';
// 开关行统一到 mobile/Field.jsx(语义统一 #36);本地原 SetRow(toggle)与之 DOM/CSS 逐字节一致,
// import 为同名 SetRow,调用点零变化。本文件的竖排 Field(内置 input,非通用控件)保留本地实现。
import { ToggleRow as SetRow } from '../Field.jsx';

/* ═══════════════════════════════════════════════════════════════════
   卡片编辑表单(用户卡 + NPC 共用)
   ═══════════════════════════════════════════════════════════════════ */
function CardEditForm({ form, u, kind = 'user' }) {
  const { t } = useTranslation();
  const isNpc = kind === 'npc';
  return (
    <>
      {/* 基本信息 */}
      <div className="pl-sec-head" style={{ marginTop: 0, marginBottom: 12, padding: '0 2px' }}>
        <h2>{t('mobile.cards.form.section_basic')}</h2>
      </div>
      <Field label={t('mobile.cards.form.name_label')} value={form.name} placeholder={t('mobile.cards.form.name_placeholder')} onChange={(v) => u('name', v)} />
      <Field label={t('mobile.cards.form.full_name_label')} value={form.full_name} placeholder={t('mobile.cards.form.full_name_placeholder')} desc={t('mobile.cards.form.full_name_desc')} onChange={(v) => u('full_name', v)} />
      <Field label={t('mobile.cards.form.identity_label')} value={form.identity} placeholder={t('mobile.cards.form.identity_placeholder')} onChange={(v) => u('identity', v)} />
      <Field label={t('mobile.cards.form.aliases_label')} value={form.aliases} placeholder={t('mobile.cards.form.comma_separated')} desc={t('mobile.cards.form.aliases_desc')} onChange={(v) => u('aliases', v)} />
      <Field label={t('mobile.cards.form.tags_label')} value={form.tags} placeholder={t('mobile.cards.form.comma_separated')} desc={t('mobile.cards.form.tags_desc')} onChange={(v) => u('tags', v)} />

      {/* 人物档案 */}
      <div className="pl-sec-head" style={{ marginTop: 8, marginBottom: 12, padding: '0 2px' }}>
        <h2>{t('mobile.cards.form.section_profile')}</h2>
      </div>
      <Field label={t('mobile.cards.form.background_label')} value={form.background} rows={3} placeholder={t('mobile.cards.form.background_placeholder')} onChange={(v) => u('background', v)} />
      <Field label={t('mobile.cards.form.appearance_label')} value={form.appearance} rows={2} placeholder={t('mobile.cards.form.appearance_placeholder')} onChange={(v) => u('appearance', v)} />
      <Field label={t('mobile.cards.form.personality_label')} value={form.personality} rows={3} placeholder={t('mobile.cards.form.personality_placeholder')} onChange={(v) => u('personality', v)} />
      <Field label={t('mobile.cards.form.speech_style_label')} value={form.speech_style} rows={2} placeholder={t('mobile.cards.form.speech_style_placeholder')} onChange={(v) => u('speech_style', v)} />
      <Field label={t('mobile.cards.form.current_status_label')} value={form.current_status} rows={2} placeholder={t('mobile.cards.form.current_status_placeholder')} desc={t('mobile.cards.form.current_status_desc')} onChange={(v) => u('current_status', v)} />

      {/* 叙事设定 */}
      <div className="pl-sec-head" style={{ marginTop: 8, marginBottom: 12, padding: '0 2px' }}>
        <h2>{t('mobile.cards.form.section_story')}</h2>
      </div>
      <Field label={t('mobile.cards.form.secrets_label')} value={form.secrets} rows={3} placeholder={t('mobile.cards.form.secrets_placeholder')} desc={t('mobile.cards.form.secrets_desc')} onChange={(v) => u('secrets', v)} />
      <Field label={t('mobile.cards.form.sample_dialogue_label')} value={form.sample_dialogue} rows={4} placeholder={t('mobile.cards.form.sample_dialogue_placeholder')} desc={t('mobile.cards.form.sample_dialogue_desc')} onChange={(v) => u('sample_dialogue', v)} />

      {/* 注入参数 */}
      <div className="pl-sec-head" style={{ marginTop: 8, marginBottom: 12, padding: '0 2px' }}>
        <h2>{t('mobile.cards.form.section_inject')}</h2>
      </div>
      <div className="pl-field">
        <div className="pl-slider-head">
          <span className="lab">{t('mobile.cards.form.token_budget_label')}</span>
          <span className="val">{form.token_budget}</span>
        </div>
        <input className="pl-slider" type="range" min={100} max={1200} step={20}
          value={form.token_budget} onChange={(e) => u('token_budget', +e.target.value)} />
        <div className="pl-slider-desc">{t('mobile.cards.form.token_budget_desc')}</div>
      </div>
      <Field label={t('mobile.cards.form.importance_label')} value={String(form.importance)} type="number" placeholder="100" desc={t('mobile.cards.form.importance_desc')} onChange={(v) => u('importance', v)} />
      {isNpc && (
        <Field label={t('mobile.cards.form.first_revealed_label')} value={String(form.first_revealed_chapter)} type="number" placeholder="1" desc={t('mobile.cards.form.first_revealed_desc')} onChange={(v) => u('first_revealed_chapter', v)} />
      )}
      <Field label={t('mobile.cards.form.priority_label')} value={String(form.priority)} type="number" placeholder="100" desc={t('mobile.cards.form.priority_desc')} onChange={(v) => u('priority', v)} />
      <ScopeSelect value={form.scope} onChange={(v) => u('scope', v)} isNpc={isNpc} />
      <div className="pl-group" style={{ marginBottom: 18 }}>
        <SetRow label={t('mobile.cards.form.enabled_label')} desc={t('mobile.cards.form.enabled_desc')} checked={!!form.enabled} onChange={(v) => u('enabled', v)} />
      </div>
    </>
  );
}

export { CardEditForm };
