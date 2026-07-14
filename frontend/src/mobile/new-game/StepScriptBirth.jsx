/* new-game/StepScriptBirth.jsx — 向导 STEP 0:剧本与出生点。
   出生点步骤=进度信号病灶 UI,从 pages/MobileNewGame.jsx 逐字复制(区块逐字节等价,
   DOM/视觉/行为零变化);「从故事开头开始」哨兵语义见 helpers.js BIRTHPOINT_FROM_START。 */
import React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { BIRTHPOINT_FROM_START, isFromStartBirthpoint, scriptBlockReason } from './helpers.js';
import { FieldLabel, ErrBar, Loading } from './shared.jsx';

/* ================================================================
   STEP 0 — 剧本与出生点
   ================================================================ */
function StepScriptBirth({ scripts, lockedScriptId, scriptId, setScriptId, birthpoint, setBirthpoint, onBirthpointRequiredChange }) {
  const { t } = useTranslation();
  const [phases, setPhases] = useState([]);
  const [bpLoading, setBpLoading] = useState(false);
  const [bpErr, setBpErr] = useState('');
  const [openPhase, setOpenPhase] = useState(null);

  const fetchBp = useCallback(() => {
    if (!scriptId) { setPhases([]); return; }
    setBpLoading(true); setBpErr('');
    (async () => {
      try {
        const r = await window.api.scripts.birthpoints(parseInt(scriptId, 10));
        const data = r || {};
        if (Array.isArray(data.phases) && data.phases.length > 0) {
          setPhases(data.phases);
          setOpenPhase(prev => prev || (data.phases[0]?.phase_label ?? null));
        } else {
          setPhases([]);
        }
      } catch (_) {
        setBpErr(t('mobile.new_game.birthpoint.load_error'));
        setPhases([]);
      } finally {
        setBpLoading(false);
      }
    })();
  }, [scriptId]);

  useEffect(() => { fetchBp(); }, [fetchBp]);

  // 把「本剧本是否存在出生点锚点数据」上报给父级,用于 step0Valid 判定:
  // 有数据 → 必须显式选择(含从头开始哨兵);无数据(锚点未提取)→ 不锁死,自动放行。
  useEffect(() => {
    if (!scriptId) { onBirthpointRequiredChange?.(false); return; }
    if (bpLoading) return; // 加载中维持上一次已知状态,避免闪烁误判
    onBirthpointRequiredChange?.(phases.length > 0);
  }, [scriptId, bpLoading, phases.length, onBirthpointRequiredChange]);

  // 剧本切换时清空出生点
  const prevScriptRef = useRef(scriptId);
  useEffect(() => {
    if (prevScriptRef.current !== scriptId) {
      setBirthpoint(null);
      prevScriptRef.current = scriptId;
    }
  }, [scriptId, setBirthpoint]);

  const selScript = scripts.find(s => String(s.id) === String(scriptId)) || null;
  const blockReason = scriptBlockReason(selScript);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 剧本选择 */}
      {!lockedScriptId && (
        <div>
          <FieldLabel hint={t('mobile.new_game.script.hint')}>{t('mobile.new_game.script.label')}</FieldLabel>
          {scripts.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '10px 0' }}>
              {t('mobile.new_game.script.empty')}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 7 }}>
              {scripts.map(sc => {
                const reason = scriptBlockReason(sc);
                const sel = String(sc.id) === String(scriptId);
                return (
                  <button
                    key={sc.id}
                    disabled={!!reason}
                    onClick={() => { setScriptId(String(sc.id)); setBirthpoint(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '12px 13px', border: sel ? '1px solid var(--accent-edge)' : '1px solid var(--line-soft)',
                      borderRadius: 12, background: sel ? 'var(--accent-soft)' : 'var(--panel)',
                      textAlign: 'left', transition: 'border-color .12s, background .12s',
                      opacity: reason ? 0.5 : 1, cursor: reason ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: sel ? 'var(--accent)' : 'var(--muted-3)' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: 'var(--font-serif)', fontSize: 14, color: sel ? 'var(--accent)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.title}</span>
                      {reason && <span style={{ display: 'block', fontSize: 11, color: 'var(--warn)', marginTop: 2 }}>{reason}</span>}
                      {!reason && sc.chapter_count != null && <span style={{ display: 'block', fontSize: 10.5, color: 'var(--muted-2)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{t('mobile.new_game.script.chapter_count', { count: sc.chapter_count })}</span>}
                    </span>
                    {sel && <Icon name="check" size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {lockedScriptId && selScript && (
        <div style={{ padding: '10px 13px', border: '1px solid var(--accent-edge)', borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="book_open" size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--accent)' }}>{selScript.title}</span>
        </div>
      )}

      {blockReason && (
        <div style={{ padding: '9px 12px', border: '1px solid rgba(212,179,102,.3)', borderRadius: 10, background: 'var(--warn-soft)', fontSize: 12.5, color: 'var(--warn)' }}>
          {blockReason}
        </div>
      )}

      {/* 出生点 */}
      {scriptId && !blockReason && (
        <div>
          <FieldLabel hint={t('mobile.new_game.birthpoint.hint')}>{t('mobile.new_game.birthpoint.label')}</FieldLabel>
          <ErrBar msg={bpErr} />
          {bpLoading && <Loading text={t('mobile.new_game.birthpoint.loading')} />}
          {!bpLoading && phases.length > 0 && !birthpoint && (
            <div style={{
              fontSize: 12, color: 'var(--warn)', padding: '7px 11px', marginBottom: 6,
              border: '1px solid rgba(212,179,102,.3)', borderRadius: 8, background: 'var(--warn-soft)',
            }}>
              {t('mobile.new_game.birthpoint.please_select')}
            </div>
          )}
          {!bpLoading && phases.length === 0 && !bpErr && (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
              {t('mobile.new_game.birthpoint.empty')}
              <button onClick={fetchBp} style={{ marginLeft: 8, fontSize: 12, color: 'var(--accent)' }}>{t('common.refresh')}</button>
            </div>
          )}
          {!bpLoading && phases.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              {/* 显式「从故事开头开始」选项:必须用户主动点选,不做静默默认 */}
              {(() => {
                const isStartSel = isFromStartBirthpoint(birthpoint);
                return (
                  <label style={{
                    display: 'grid', gridTemplateColumns: '16px 1fr', gap: 10,
                    padding: '10px 13px', borderRadius: 10, cursor: 'pointer',
                    border: isStartSel ? '1px solid var(--accent-edge)' : '1px solid var(--line-soft)',
                    background: isStartSel ? 'var(--accent-soft)' : 'var(--panel)',
                    alignItems: 'center', transition: 'border-color .12s, background .12s',
                  }}>
                    <input
                      type="radio"
                      checked={isStartSel}
                      onChange={() => setBirthpoint({ anchor_id: BIRTHPOINT_FROM_START, from_start: true })}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 13.5, color: isStartSel ? 'var(--accent)' : 'var(--text)' }}>
                      {t('mobile.new_game.birthpoint.from_start')}
                    </span>
                  </label>
                );
              })()}
              {phases.map(phase => {
                const isOpen = openPhase === phase.phase_label;
                return (
                  <div key={phase.phase_label} style={{ border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>
                    <button
                      onClick={() => setOpenPhase(isOpen ? null : phase.phase_label)}
                      style={{
                        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: 10, padding: '10px 13px',
                        background: isOpen ? 'var(--panel-2)' : 'transparent',
                        borderBottom: isOpen ? '1px solid var(--line-soft)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name={isOpen ? 'chevron_down' : 'chevron_right'} size={11} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 13.5 }}>{phase.phase_label}</span>
                      </div>
                      <span style={{ fontSize: 10.5, color: 'var(--muted-2)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {t('mobile.new_game.birthpoint.chapter_range', { min: phase.chapter_min, max: phase.chapter_max })}
                      </span>
                    </button>
                    {isOpen && (
                      <div style={{ display: 'grid', gap: 4, padding: '8px 10px' }}>
                        {(phase.anchors || []).map(anchor => {
                          const isSel = birthpoint && birthpoint.anchor_id === anchor.anchor_id;
                          return (
                            <label key={anchor.anchor_id} style={{
                              display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: 10,
                              padding: '10px 11px', borderRadius: 9, cursor: 'pointer',
                              border: isSel ? '1px solid var(--accent-edge)' : '1px solid var(--line-soft)',
                              background: isSel ? 'var(--accent-soft)' : 'var(--panel)',
                              alignItems: 'start', transition: 'border-color .12s, background .12s',
                            }}>
                              <input type="radio" checked={!!isSel} onChange={() => setBirthpoint({
                                phase_label: phase.phase_label,
                                anchor_id: anchor.anchor_id,
                                chapter_min: anchor.chapter_min,
                                chapter_max: anchor.chapter_max,
                                story_time_label: anchor.story_time_label,
                              })} style={{ marginTop: 2, accentColor: 'var(--accent)' }} />
                              <div>
                                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: isSel ? 'var(--accent)' : 'var(--text)' }}>{anchor.story_time_label}</div>
                                {anchor.sample_summary && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>{anchor.sample_summary}</div>}
                              </div>
                              <span style={{ fontSize: 10.5, color: 'var(--muted-2)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                                {anchor.chapter_max !== anchor.chapter_min
                                  ? t('mobile.new_game.birthpoint.chapter_range', { min: anchor.chapter_min, max: anchor.chapter_max })
                                  : t('mobile.new_game.birthpoint.chapter_single', { n: anchor.chapter_min })}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { StepScriptBirth };
