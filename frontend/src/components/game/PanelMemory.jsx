/* 记忆面板(记忆 tab)—— 纯机械从 game-panels.jsx 搬出,零行为变化。
   注意:pinned/notes/facts 各自独立渲染路径(历史病灶),逐字复制,勿统一。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../game-icons.jsx';
import { ForcedSetSection } from './ForcedSetSection.jsx';

function PanelMemory({ state, density }) {
  const { t } = useTranslation();
  const m = state.memory;
  return (
    <div className="gp-stack">
      <div className="gp-section">
        <div className="section-head"><h3>{t('game.memory.current_objective')}</h3><span className="pill">{t('game.memory.main_quest_pill')}</span></div>
        <p className="serif gp-quest">{m.main_quest}</p>
        <p className="muted" style={{fontSize: 13, marginTop: 6}}>{m.current_objective}</p>
      </div>

      <ForcedSetSection state={state} />

      <div className="gp-section">
        <div className="section-head">
          <h3>{t('game.memory.pinned')}<span className="muted-2" style={{marginLeft: 8, fontSize: 11, textTransform: "none"}}>{t('game.memory.pinned_subtitle')}</span></h3>
          <button className="iconbtn" data-tip={t('game.memory.add_pinned_tip')} data-tip-pos="below" aria-label={t('game.memory.add_pinned_tip')}
            onClick={async () => {
              const txt = await window.__prompt({ title: t('game.memory.add_pinned_prompt') });
              if (!txt) return;
              // bucket=pinned(后端 Pydantic 字段名,旧版误用 kind 被 extra='ignore' 吞掉
              // 实际全落 notes 桶,等于固定记忆按钮一直在加到笔记 — 现修)
              try { await window.api.game.memoryAdd({ bucket: "pinned", text: txt }); try { window.dispatchEvent(new CustomEvent('game-state-refresh')); } catch (_) {} window.__apiToast?.(t('game.memory.added_ok'), { kind: "ok" }); }
              catch (e) { window.__apiToast?.(t('game.memory.add_failed'), { kind: "danger", detail: e?.message }); }
            }}>
            <Icon name="plus" />
          </button>
        </div>
        <ul className="gp-pin-list">
          {(m.pinned || []).map((item, i) => (
            <li key={i}>
              <span className="gp-pin-mark"><Icon name="pin" size={12} /></span>
              <span className="serif">{item}</span>
              <button className="iconbtn" data-tip={t('game.memory.unpin_tip')} aria-label={t('game.memory.unpin_tip')}
                onClick={async () => {
                  if (!await window.__confirm({ message: t('game.memory.unpin_confirm'), danger: true })) return;
                  try { await window.api.game.memoryRemove({ bucket: "pinned", index: i }); try { window.dispatchEvent(new CustomEvent('game-state-refresh')); } catch (_) {} window.__apiToast?.(t('game.memory.unpinned_ok'), { kind: "ok" }); }
                  catch (e) { window.__apiToast?.(t('game.memory.action_failed'), { kind: "danger", detail: e?.message }); }
                }}>
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="gp-section">
        <div className="section-head"><h3>{t('game.memory.facts')}<span className="muted-2" style={{marginLeft: 8, fontSize: 11, textTransform: "none"}}>{t('game.memory.facts_subtitle')}</span></h3></div>
        <ul className="gp-flat-list">
          {(m.facts || []).map((item, i) => (<li key={i}><span>{item}</span></li>))}
        </ul>
      </div>

      <div className="gp-section">
        <div className="section-head"><h3>{t('game.memory.notes')}</h3>
          <button className="iconbtn" data-tip={t('game.memory.add_note_tip')} data-tip-pos="below"
            onClick={async () => {
              const txt = await window.__prompt({ title: t('game.memory.add_note_prompt') });
              if (!txt) return;
              try { await window.api.game.memoryAdd({ bucket: "notes", text: txt }); try { window.dispatchEvent(new CustomEvent('game-state-refresh')); } catch (_) {} window.__apiToast?.(t('game.memory.added_ok'), { kind: "ok" }); }
              catch (e) { window.__apiToast?.(t('game.memory.add_failed'), { kind: "danger", detail: e?.message }); }
            }}>
            <Icon name="plus" />
          </button>
        </div>
        <ul className="gp-flat-list">
          {(m.notes || []).map((item, i) => (
            <li key={i} style={{display: "flex", alignItems: "center", gap: 6}}>
              <span style={{flex: 1}}>{item}</span>
              <button className="iconbtn" data-tip={t('game.memory.edit_note_tip', { defaultValue: '编辑这条' })}
                onClick={async () => {
                  // 就地编辑(原来只能删了重加 — 群反馈 行者无疆):预填当前文本,改完直接覆盖该条。
                  const txt = await window.__prompt({ title: t('game.memory.edit_note_prompt', { defaultValue: '编辑笔记' }), default: item });
                  if (txt == null || !txt.trim() || txt === item) return;
                  try { await window.api.game.memoryUpdate({ bucket: "notes", index: i, text: txt }); try { window.dispatchEvent(new CustomEvent('game-state-refresh')); } catch (_) {} window.__apiToast?.(t('game.memory.saved_ok', { defaultValue: '已保存' }), { kind: "ok" }); }
                  catch (e) { window.__apiToast?.(t('game.memory.action_failed'), { kind: "danger", detail: e?.message }); }
                }}>
                <Icon name="edit" size={12} />
              </button>
              <button className="iconbtn" data-tip={t('game.memory.delete_note_tip')}
                onClick={async () => {
                  if (!await window.__confirm({ message: t('game.memory.delete_note_confirm'), danger: true })) return;
                  try { await window.api.game.memoryRemove({ bucket: "notes", index: i }); try { window.dispatchEvent(new CustomEvent('game-state-refresh')); } catch (_) {} window.__apiToast?.(t('game.memory.deleted_ok'), { kind: "ok" }); }
                  catch (e) { window.__apiToast?.(t('game.memory.action_failed'), { kind: "danger", detail: e?.message }); }
                }}>
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="gp-section">
        <div className="section-head">
          <h3>{t('game.memory.retrieval')}<span className="muted-2" style={{marginLeft: 8, fontSize: 11, textTransform: "none"}}>{t('game.memory.retrieval_subtitle')}</span></h3>
          <span className="pill mono">{t('game.memory.retrieval_chunks', { count: (state.memory && state.memory.last_context && state.memory.last_context.retrieval_chunks) || 0 })}</span>
        </div>
        <pre className="gp-quote">{m.last_retrieval || t('game.memory.retrieval_empty')}</pre>
      </div>
    </div>
  );
}

export { PanelMemory };
