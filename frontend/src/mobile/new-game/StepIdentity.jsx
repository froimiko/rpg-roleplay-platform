/* new-game/StepIdentity.jsx — 向导 STEP 2:出身与身份(出身×身份联动约束对齐 saves.jsx ALLOWED_SOURCES)。
   从 pages/MobileNewGame.jsx 纯机械搬出(区块逐字节等价,DOM/视觉/行为零变化)。 */
import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { ALLOWED_SOURCES, ORIGIN_OPTIONS } from './helpers.js';
import { FieldLabel, ErrBar, Loading } from './shared.jsx';

/* ================================================================
   STEP 2 — 出身与身份
   ================================================================ */
function StepIdentity({ scriptId, birthpoint, pickedCard, allRoleOptions, playerOrigin, setPlayerOrigin, identity, setIdentity, identityKnown, setIdentityKnown }) {
  const { t } = useTranslation();
  // 允许的身份来源
  const allowedSources = ALLOWED_SOURCES[playerOrigin] || ['none', 'npc', 'ai', 'manual'];

  // 当前选中的来源
  const srcOf = id => !id ? 'none' : (id._from === 'npc_card' ? 'npc' : id._from === 'ai' ? 'ai' : 'manual');
  const [idSrc, setIdSrc] = useState(() => srcOf(identity));

  // NPC 卡列表(当 idSrc === 'npc' 时加载)
  const [npcCards, setNpcCards] = useState([]);
  const [npcLoading, setNpcLoading] = useState(false);
  // AI 推荐
  const [recs, setRecs] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsErr, setRecsErr] = useState('');
  // 手动填写
  const [manualName, setManualName] = useState('');
  const [manualRole, setManualRole] = useState('');
  const [manualBg, setManualBg] = useState('');

  // 出身变化时校验来源兼容性
  useEffect(() => {
    const allowed = ALLOWED_SOURCES[playerOrigin] || ['none', 'npc', 'ai', 'manual'];
    if (!allowed.includes(idSrc)) {
      setIdSrc(allowed[0]);
      setIdentity(null);
    } else if (identity && identity.player_origin !== playerOrigin) {
      setIdentity({ ...identity, player_origin: playerOrigin });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerOrigin]);

  // identity 从外部更新时同步 tab
  useEffect(() => {
    if (identity) setIdSrc(srcOf(identity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity ? `${identity._from || ''}:${identity.npc_card_id || ''}:${identity.name || ''}` : null]);

  const allowedNow = ALLOWED_SOURCES[playerOrigin] || ['none', 'npc', 'ai', 'manual'];

  // 加载 NPC 卡
  useEffect(() => {
    if (idSrc !== 'npc' || !scriptId) { setNpcCards([]); return; }
    let alive = true;
    setNpcLoading(true);
    (async () => {
      try {
        const r = await window.api.cards.scriptList(parseInt(scriptId, 10));
        const list = (r && (r.items || r.cards)) || (Array.isArray(r) ? r : []);
        if (alive) setNpcCards(Array.isArray(list) ? list : []);
      } catch (_) { if (alive) setNpcCards([]); }
      if (alive) setNpcLoading(false);
    })();
    return () => { alive = false; };
  }, [idSrc, scriptId]);

  const pickRec = rec => setIdentity({ name: rec.name || '', role: rec.role || '', background: rec.background || '', source: 'ai', _from: 'ai', player_origin: playerOrigin });
  const pickNpc = card => {
    const nm = card.name || card.title || '';
    const role = card.identity || card.role || card.archetype || '';
    const bg = card.background || card.persona || card.summary || card.description || card.bio || '';
    setIdentity({ name: nm, role, background: bg, source: 'npc_card', _from: 'npc_card', npc_card_id: card.id || card.slug || null, player_origin: playerOrigin });
    setIdentityKnown(false);
  };
  const applyManual = () => {
    const role = manualRole.trim(); const bg = manualBg.trim();
    if (!role && !bg) return;
    setIdentity({ name: manualName.trim(), role, background: bg, source: 'custom', _from: 'custom', player_origin: playerOrigin });
  };
  const clearIdentity = () => {
    setIdentity(null);
    setIdSrc('none');
  };
  const chooseSource = sid => {
    setIdSrc(sid);
    if (sid === 'none') clearIdentity();
  };

  const fetchAiRecs = useCallback(async () => {
    if (!scriptId) return;
    setRecsLoading(true); setRecsErr(''); setRecs([]);
    const pickedRole = allRoleOptions ? allRoleOptions.find(o => o.key === pickedCard) : null;
    try {
      const r = await fetch(`${window.__API_BASE || ''}/api/scripts/${parseInt(scriptId, 10)}/recommend-identity`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthpoint_phase: birthpoint?.phase_label || '',
          birthpoint_label: birthpoint?.story_time_label || '',
          character_card_id: pickedRole ? (pickedRole.id || null) : null,
          character_card_kind: pickedRole ? pickedRole.kind : null,
          player_origin: playerOrigin,
          n: 4,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.ok === false) {
        setRecsErr((data && data.error) || t('mobile.new_game.identity.ai_request_failed', { status: r.status }));
      } else if (data && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        setRecs(data.recommendations);
      } else {
        setRecsErr(t('mobile.new_game.identity.ai_empty'));
      }
    } catch (e) { setRecsErr(String(e?.message || e)); }
    setRecsLoading(false);
  }, [scriptId, birthpoint, pickedCard, allRoleOptions, playerOrigin]);

  return (
    <div style={{ display: 'grid', gap: 22 }}>

      {/* ── 出身来源 ── */}
      <div>
        <FieldLabel hint={t('mobile.new_game.identity.origin_hint')}>{t('mobile.new_game.identity.origin_step')}</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {ORIGIN_OPTIONS.map(orig => {
            const sel = playerOrigin === orig.value;
            return (
              <button
                key={orig.value}
                onClick={() => setPlayerOrigin(orig.value)}
                style={{
                  textAlign: 'left', padding: '11px 12px', borderRadius: 10, cursor: 'pointer',
                  border: sel ? `1px solid ${orig.accentBorder}` : '1px solid var(--line-soft)',
                  background: sel ? orig.accentBg : 'var(--panel)',
                  display: 'grid', gap: 5, transition: 'border-color .12s, background .12s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0, color: sel ? orig.accentColor : 'var(--muted-2)', fontFamily: 'var(--font-serif)' }}>{orig.icon}</span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 13.5, fontWeight: 700, color: sel ? orig.accentColor : 'var(--text)', lineHeight: 1.2 }}>{t(orig.labelKey)}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: sel ? orig.accentColor : 'var(--muted)', lineHeight: 1.3 }}>{t(orig.essenceKey)}</span>
                <span style={{ fontSize: 10.5, color: 'var(--muted-2)', lineHeight: 1.5 }}>{t(orig.mappingKey)}</span>
                {sel && <span style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.5, borderTop: `1px solid ${orig.accentBorder}`, paddingTop: 5, marginTop: 2 }}>{t(orig.hintKey)}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 身份来源 ── */}
      <div>
        <FieldLabel hint={t('mobile.new_game.identity.src_hint')}>{t('mobile.new_game.identity.src_step')}</FieldLabel>

        {/* 来源选择器 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            ['none', t('mobile.new_game.identity.src_none')],
            ['npc', t('mobile.new_game.identity.src_npc')],
            ['ai', t('mobile.new_game.identity.src_ai')],
            ['manual', t('mobile.new_game.identity.src_manual')],
          ].filter(([sid]) => allowedNow.includes(sid)).map(([sid, lbl]) => {
            const sel = idSrc === sid;
            return (
              <button
                key={sid}
                onClick={() => chooseSource(sid)}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: sel ? '1px solid var(--accent-edge)' : '1px solid var(--line-soft)',
                  background: sel ? 'var(--accent-soft)' : 'var(--panel)',
                  color: sel ? 'var(--accent)' : 'var(--text)', transition: 'all .12s',
                }}
              >
                {lbl}
              </button>
            );
          })}
        </div>

        {/* 已选预览 */}
        {identity && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
            padding: '11px 13px', border: '1px solid var(--accent-edge)', borderRadius: 11,
            background: 'var(--accent-soft)', marginBottom: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 3 }}>
                <span className="pill accent" style={{ fontSize: 10 }}>
                  {identity._from === 'ai' ? 'AI' : identity._from === 'npc_card' ? 'NPC' : t('mobile.new_game.identity.badge_manual')}
                </span>
                {identity.name && <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--text)' }}>{identity.name}</strong>}
                {identity.role && <span style={{ fontSize: 12.5, color: 'var(--text-quiet)' }}>{identity.role}</span>}
              </div>
              {identity.background && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{identity.background}</div>}
            </div>
            <button onClick={() => chooseSource('none')} style={{ flexShrink: 0, fontSize: 12, color: 'var(--muted-2)', padding: '2px 6px' }}>{t('mobile.new_game.identity.clear')}</button>
          </div>
        )}

        {/* 从原著角色 */}
        {idSrc === 'npc' && (
          npcLoading ? <Loading text={t('mobile.new_game.identity.npc_loading')} /> :
          npcCards.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '8px 0' }}>{t('mobile.new_game.identity.npc_empty')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {npcCards.map((card, i) => {
                const cid = card.id || card.slug || i;
                const isSel = identity && identity._from === 'npc_card' && String(identity.npc_card_id) === String(card.id || card.slug);
                const nm = card.name || card.title || '';
                const role = card.identity || card.role || card.archetype || '';
                const bg = card.background || card.persona || card.summary || card.description || card.bio || '';
                return (
                  <button key={cid} onClick={() => pickNpc(card)} style={{
                    textAlign: 'left', padding: '11px 13px', borderRadius: 11,
                    border: isSel ? '1px solid var(--accent-edge)' : '1px solid var(--line-soft)',
                    background: isSel ? 'var(--accent-soft)' : 'var(--panel)',
                    display: 'grid', gap: 4, transition: 'border-color .12s, background .12s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {nm && <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 14 }}>{nm}</strong>}
                      {role && <span className="pill" style={{ fontSize: 10.5 }}>{role}</span>}
                      {isSel && <span className="pill accent" style={{ fontSize: 10, marginLeft: 'auto' }}>{t('mobile.new_game.identity.selected_badge')}</span>}
                    </div>
                    {bg && <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{bg}</span>}
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* AI 生成 */}
        {idSrc === 'ai' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <button className="pl-btn-ghost" onClick={fetchAiRecs} disabled={recsLoading} style={{ height: 40, fontSize: 13 }}>
              {recsLoading ? <><Icon name="spinner" size={13} className="spin" /> {t('mobile.new_game.identity.ai_generating')}</> : recs.length > 0 ? t('mobile.new_game.identity.ai_regenerate') : t('mobile.new_game.identity.ai_generate_btn')}
            </button>
            <ErrBar msg={recsErr} />
            {recs.length > 0 && (
              <div style={{ display: 'grid', gap: 6 }}>
                {recs.map((rec, i) => {
                  const isSel = identity && identity._from === 'ai' && identity.name === rec.name && identity.role === rec.role;
                  return (
                    <button key={i} onClick={() => pickRec(rec)} style={{
                      textAlign: 'left', padding: '11px 13px', borderRadius: 11,
                      border: isSel ? '1px solid var(--accent-edge)' : '1px solid var(--line-soft)',
                      background: isSel ? 'var(--accent-soft)' : 'var(--panel)',
                      display: 'grid', gap: 4, transition: 'border-color .12s, background .12s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {rec.name && <strong style={{ fontFamily: 'var(--font-serif)', fontSize: 14 }}>{rec.name}</strong>}
                        {rec.role && <span className="pill" style={{ fontSize: 10.5 }}>{rec.role}</span>}
                        {isSel && <span className="pill accent" style={{ fontSize: 10, marginLeft: 'auto' }}>{t('mobile.new_game.identity.selected_badge')}</span>}
                      </div>
                      {rec.background && <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{rec.background}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 手动填写 */}
        {idSrc === 'manual' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="pl-field" style={{ marginBottom: 0 }}>
              <label>{t('mobile.new_game.identity.manual_alias_label')}</label>
              <input className="pl-input" placeholder={t('mobile.new_game.identity.manual_alias_placeholder')} value={manualName} onChange={e => setManualName(e.target.value)} />
            </div>
            <div className="pl-field" style={{ marginBottom: 0 }}>
              <label>{t('mobile.new_game.identity.manual_role_label')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="pl-input" placeholder={t('mobile.new_game.identity.manual_role_placeholder')} value={manualRole} onChange={e => setManualRole(e.target.value)} />
            </div>
            <div className="pl-field" style={{ marginBottom: 0 }}>
              <label>{t('mobile.new_game.identity.manual_bg_label')}</label>
              <textarea className="pl-input" rows={3} placeholder={t('mobile.new_game.identity.manual_bg_placeholder')} value={manualBg} onChange={e => setManualBg(e.target.value)} />
            </div>
            <button className="pl-btn-primary" onClick={applyManual} disabled={!manualRole.trim() && !manualBg.trim()} style={{ height: 42, fontSize: 13 }}>
              <Icon name="check" size={14} /> {t('mobile.new_game.identity.manual_confirm_btn')}
            </button>
          </div>
        )}
      </div>

      {/* ── 是否知道这个身份 ── */}
      {identity && playerOrigin !== 'body' && (
        <div>
          <FieldLabel hint={t('mobile.new_game.identity.known_hint')}>{t('mobile.new_game.identity.known_step')}</FieldLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { val: true, label: t('mobile.new_game.identity.known_yes'), desc: t('mobile.new_game.identity.known_yes_desc') },
              { val: false, label: t('mobile.new_game.identity.known_no'), desc: t('mobile.new_game.identity.known_no_desc') },
            ].map(({ val, label, desc }) => {
              const sel = identityKnown === val;
              return (
                <button key={String(val)} onClick={() => setIdentityKnown(val)} style={{
                  flex: '1 1 0', textAlign: 'left', padding: '10px 12px', cursor: 'pointer',
                  border: sel ? '1px solid var(--accent-edge)' : '1px solid var(--line-soft)',
                  borderRadius: 10, background: sel ? 'var(--accent-soft)' : 'var(--panel)',
                  display: 'grid', gap: 3, transition: 'border-color .12s, background .12s',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: sel ? 'var(--accent)' : 'var(--text)' }}>{label}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { StepIdentity };
