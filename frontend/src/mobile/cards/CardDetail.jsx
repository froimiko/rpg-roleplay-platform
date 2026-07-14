/* MobileCards 卡片详情只读面板 CardDetail(信息 / 设定 两 Tab)—— 从 pages/MobileCards.jsx 拆出,逐字节不变。 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { SubHead, CardAv, Tag, ProseBlock } from './shared.jsx';

/* ═══════════════════════════════════════════════════════════════════
   卡片详情只读面板(信息 / 设定 两 Tab)
   ═══════════════════════════════════════════════════════════════════ */
function CardDetail({ card, kind, onEdit, onDuplicate, onDelete, onBack, onExportTavern, children }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('info');
  const raw = card._raw || card;
  const fullName = raw.full_name && raw.full_name !== raw.name ? raw.full_name : null;
  const aliases = Array.isArray(raw.aliases) ? raw.aliases : [];
  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  const dialogues = Array.isArray(raw.sample_dialogue) ? raw.sample_dialogue : [];
  const isPublic = !!(raw.is_public ?? card.is_public);

  const scopeLabel = { script: t('mobile.cards.scope.script'), private: t('mobile.cards.scope.private'), public: t('mobile.cards.scope.public') };
  const sourceLabel = { extracted: t('mobile.cards.detail.source_extracted'), user: t('mobile.cards.detail.source_user'), persona: t('mobile.cards.detail.source_persona'), platform: t('mobile.cards.detail.source_platform') };
  const cardTypeLabel = { npc: 'NPC', pc: t('mobile.cards.detail.type_pc'), persona: t('mobile.cards.detail.type_persona') };

  return (
    <>
      <SubHead
        title={card.name || t('mobile.cards.unnamed')}
        sub={kind === 'npc' ? t('mobile.cards.detail.sub_npc') : t('mobile.cards.detail.sub_user')}
        onBack={onBack}
        actions={
          <button className="pl-headbtn accent" onClick={onEdit} aria-label={t('common.edit')}>
            <Icon name="edit" size={17} />
          </button>
        }
      />
      <div className="pl-body tabbed">
        {/* Tab 切换 */}
        <div style={{ display: 'flex', gap: 7, padding: '10px 16px 4px', borderBottom: '1px solid var(--line-soft)' }}>
          {[{ id: 'info', l: t('mobile.cards.detail.tab_info') }, { id: 'lore', l: t('mobile.cards.detail.tab_lore') }].map((tb) => (
            <button key={tb.id} className={'pl-pill' + (tab === tb.id ? ' active' : '')} onClick={() => setTab(tb.id)}>
              {tb.l}
            </button>
          ))}
        </div>

        <div className="pl-pad">
          {/* 头像 + 名字 */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
            <CardAv src={raw.avatar_path || raw.avatar_url} name={card.name} enabled={raw.enabled} size={72} radius={20} zoomable />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>
                {card.name || t('mobile.cards.unnamed')}
              </div>
              {fullName && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, fontStyle: 'italic' }}>{fullName}</div>}
              {(raw.identity || card.role) && (
                <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 4 }}>
                  {String(raw.identity || card.role).slice(0, 60)}
                </div>
              )}
              {(aliases.length > 0 || tags.length > 0) && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                  {aliases.map((a) => <Tag key={'a' + a} label={a} />)}
                  {tags.map((tg) => <Tag key={'t' + tg} label={tg} color="green" />)}
                </div>
              )}
            </div>
          </div>

          {tab === 'info' && (
            <div className="pl-kvgrid">
              {[
                [t('mobile.cards.detail.type'), cardTypeLabel[raw.card_type] || (kind === 'npc' ? 'NPC' : t('mobile.cards.detail.type_pc'))],
                [t('mobile.cards.detail.source'), sourceLabel[raw.source] || card.origin || '—'],
                [t('mobile.cards.detail.scope'), scopeLabel[raw.scope] || t('mobile.cards.scope.private')],
                [t('mobile.cards.detail.status'), raw.enabled === false ? t('mobile.cards.detail.status_disabled') : t('mobile.cards.detail.status_enabled')],
                [t('mobile.cards.detail.importance'), raw.importance != null ? String(raw.importance) : '—'],
                ...(kind === 'npc' && raw.first_revealed_chapter > 1 ? [[t('mobile.cards.detail.first_chapter'), t('mobile.cards.detail.chapter_n', { n: raw.first_revealed_chapter })]] : []),
                [t('mobile.cards.detail.token_budget'), String(raw.token_budget ?? 450)],
                [t('mobile.cards.detail.priority'), String(raw.priority ?? 100)],
                [t('mobile.cards.detail.uses'), String(card.uses || 0)],
                [t('mobile.cards.detail.updated'), card.updated || '—'],
              ].map(([k, v]) => (
                <div key={k} className="pl-kv">
                  <div className="k">{k}</div>
                  <div className="v">{v}</div>
                </div>
              ))}
              {isPublic && kind !== 'npc' && (
                <div className="pl-kv" style={{ gridColumn: '1/-1' }}>
                  <div className="k">{t('mobile.cards.detail.public_status')}</div>
                  <div className="v" style={{ color: 'var(--ok)' }}>{t('mobile.cards.detail.published')}</div>
                </div>
              )}
            </div>
          )}

          {tab === 'lore' && (
            <>
              {[
                [t('mobile.cards.form.background_label'), raw.background],
                [t('mobile.cards.form.appearance_label'), raw.appearance],
                [t('mobile.cards.form.personality_label'), raw.personality],
                [t('mobile.cards.form.speech_style_label'), raw.speech_style],
                [t('mobile.cards.form.current_status_label'), raw.current_status],
                [t('mobile.cards.form.secrets_label'), raw.secrets],
              ].map(([lbl, val]) => <ProseBlock key={lbl} label={lbl} value={val} />)}
              {dialogues.length > 0 && (
                <div className="pl-prose-block">
                  <div className="lbl">{t('mobile.cards.form.sample_dialogue_label')}</div>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {dialogues.map((d, i) => (
                      <div key={i} style={{ borderLeft: '2px solid var(--accent-edge)', paddingLeft: 10, color: 'var(--text-quiet)', fontSize: 13, lineHeight: 1.65, fontFamily: 'var(--font-serif)' }}>
                        {typeof d === 'string' ? d : `${d.role ? d.role + ': ' : ''}${d.content || ''}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!raw.background && !raw.appearance && !raw.personality && !raw.speech_style && !raw.current_status && !raw.secrets && dialogues.length === 0 && (
                <div className="pl-empty">{t('mobile.cards.detail.no_lore')}</div>
              )}
            </>
          )}

          {/* 操作区 */}
          <div style={{ display: 'grid', gap: 9, marginTop: 22 }}>
            <button className="pl-btn-primary" onClick={onEdit}>
              <Icon name="edit" size={16} /> {t('mobile.cards.detail.btn_edit')}
            </button>
            {kind === 'user' && (
              <button className="pl-btn-ghost" onClick={onExportTavern}>
                <Icon name="download" size={16} /> {t('mobile.cards.detail.btn_export_tavern')}
              </button>
            )}
            {kind === 'user' && (
              <button className="pl-btn-ghost" onClick={() => {
                const url = window.api?.cards?.exportPng?.(card.id);
                if (url) window.open(url, '_blank');
              }}>
                <Icon name="image" size={16} /> {t('mobile.cards.detail.btn_export_png')}
              </button>
            )}
            <button className="pl-btn-ghost" onClick={onDuplicate}>
              <Icon name="copy" size={16} /> {t('mobile.cards.detail.btn_duplicate')}
            </button>
            <button className="pl-btn-ghost danger" onClick={onDelete}>
              <Icon name="trash" size={16} /> {t('mobile.cards.detail.btn_delete')}
            </button>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

export { CardDetail };
