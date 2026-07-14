/* MobileNewGame — 移动端新游戏向导(5 步)
   铁律:
   ① 只用 mobile.css 已有 class 或 .m-ng-* 前缀新 class + inline style。
   ② 逻辑数据复用 window.api.* / window.__createAndEnterSave。
   ③ 出身×身份联动约束严格对齐 saves.jsx ALLOWED_SOURCES 逻辑。
   ④ export function MobileNewGame({ nav, scriptId, onDone }) + export default。
   props:
     nav       — MobileRoot nav 对象(nav.pop / nav.toast 等)
     scriptId  — 传入时锁定剧本跳过步骤 1 的剧本选择
     onDone    — 可选:创建成功回调

   页面主体已纯机械拆到 ../new-game/*(常量&工具 helpers.js / 共用小件 shared.jsx /
   五步组件 Step*.jsx),区块逐字节等价、DOM/视觉/行为零变化;本文件保留主组件
   (向导状态机 + 草稿恢复 + 提交)与具名/default export。
*/

import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../icons.jsx';
import { lsGet, lsSet, lsGetJSON, lsSetJSON, lsRemove } from '../../lib/storage.js';
import {
  STEPS, TOTAL_STEPS,
  NEWGAME_ACTIVE_IMPORT_STATUSES, NEWGAME_IMPORT_TERMINAL_STATUSES,
  isFromStartBirthpoint, scriptBlockReason,
} from '../new-game/helpers.js';
import { StepDots, ErrBar, Loading } from '../new-game/shared.jsx';
import { StepScriptBirth } from '../new-game/StepScriptBirth.jsx';
import { StepRole } from '../new-game/StepRole.jsx';
import { StepIdentity } from '../new-game/StepIdentity.jsx';
import { StepMeta } from '../new-game/StepMeta.jsx';
import { StepConfirm } from '../new-game/StepConfirm.jsx';

/* ================================================================
   主组件
   ================================================================ */
export function MobileNewGame({ nav, scriptId: propScriptId, onDone }) {
  const { t } = useTranslation();
  const lockedScriptId = propScriptId ? String(propScriptId) : null;

  // ── 数据加载 ──
  const [scripts, setScripts] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [userCards, setUserCards] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataErr, setDataErr] = useState('');

  // ── Step 0 state ──
  const [scriptId, setScriptId] = useState(lockedScriptId || '');
  const [birthpoint, setBirthpoint] = useState(null);
  // 本剧本是否存在出生点锚点数据(由 StepScriptBirth 上报)。true=必须显式选择才能进入下一步。
  // null=尚未确认(StepScriptBirth 本次会话还没挂载过,例如草稿直接恢复到 step>0)——
  // 保守起见按"需要选择"处理,避免绕过必选闸(用户回到 step0 即可解锁)。
  const [birthpointRequired, setBirthpointRequired] = useState(null);

  // ── Step 1 state ──
  const [roleMode, setRoleMode] = useState('existing');
  const [pickedCard, setPickedCard] = useState('');
  const [newCardName, setNewCardName] = useState('');
  const [newCardRole, setNewCardRole] = useState('');
  const [newCardBg, setNewCardBg] = useState('');

  // ── Step 2 state ──
  const [playerOrigin, setPlayerOrigin] = useState('soul');
  const [identity, setIdentity] = useState(null);
  const [identityKnown, setIdentityKnown] = useState(true);

  // ── Step 3 state ──
  const [foreknowledge, setForeknowledge] = useState('none');
  const [npcAwareness, setNpcAwareness] = useState('oblivious');
  const [steering, setSteering] = useState('guided');
  const [spoiler, setSpoiler] = useState('loose');
  const [storyIntent, setStoryIntent] = useState('');

  // ── Step 4 state ──
  const [title, setTitle] = useState('');

  // ── 向导控制 ──
  const [step, setStep] = useState(0);
  const [submitErr, setSubmitErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── 草稿恢复 ──
  const DRAFT_KEY = 'mobile_newgame.draft.v1';
  const draftReadyRef = useRef(false);

  // ── 加载数据 ──
  useEffect(() => {
    draftReadyRef.current = false;
    setDataLoading(true); setDataErr('');
    (async () => {
      let scList = []; let psList = []; let ucList = [];
      try { const r = await window.api.scripts.list(); scList = Array.isArray(r) ? r : (r?.items || r?.scripts || []); } catch (_) {}
      try { const p = await window.api.account.personas.list(); psList = (p && (p.items || p.personas)) || []; } catch (_) {}
      try { const c = await window.api.cards.myList(); ucList = (c && (c.items || c.cards)) || []; } catch (_) {}
      setScripts(scList);
      setPersonas(psList);
      setUserCards(ucList);

      // 默认剧本
      if (!lockedScriptId) {
        let pickId = lsGet('newgame.lastScriptId') || '';
        if (!pickId || !scList.some(x => String(x.id) === pickId && !scriptBlockReason(x))) {
          const first = scList.find(x => !scriptBlockReason(x));
          pickId = first ? String(first.id) : (scList.length ? String(scList[0].id) : '');
        }
        setScriptId(pickId);
        // 默认存档名
        const sc = scList.find(x => String(x.id) === pickId);
        const scTitle = (sc && (sc.title || '').replace(/^《|》$/g, '')) || '';
        setTitle(scTitle ? `${scTitle} ${t('mobile.new_game.default_save_suffix')}` : '');
      } else {
        const sc = scList.find(x => String(x.id) === lockedScriptId);
        const scTitle = (sc && (sc.title || '').replace(/^《|》$/g, '')) || '';
        setTitle(scTitle ? `${scTitle} ${t('mobile.new_game.default_save_suffix')}` : '');
      }

      // 默认角色
      if (psList.length) { setRoleMode('existing'); setPickedCard(`persona:${psList[0].id || psList[0].slug}`); }
      else if (ucList.length) { setRoleMode('existing'); setPickedCard(`user:${ucList[0].id || ucList[0].slug}`); }
      else { setRoleMode('new'); setPickedCard(''); }

      // 草稿恢复
      try {
        const draft = lsGetJSON(DRAFT_KEY, null);
        if (draft && typeof draft === 'object') {
          const sameScript = !lockedScriptId || String(draft.scriptId) === lockedScriptId;
          if (sameScript) {
            if (typeof draft.title === 'string') setTitle(draft.title);
            if (draft.scriptId && scList.some(x => String(x.id) === String(draft.scriptId))) setScriptId(String(draft.scriptId));
            if (draft.roleMode) setRoleMode(draft.roleMode);
            if (typeof draft.pickedCard === 'string') setPickedCard(draft.pickedCard);
            if (typeof draft.newCardName === 'string') setNewCardName(draft.newCardName);
            if (typeof draft.newCardRole === 'string') setNewCardRole(draft.newCardRole);
            if (typeof draft.newCardBg === 'string') setNewCardBg(draft.newCardBg);
            if ('birthpoint' in draft) setBirthpoint(draft.birthpoint);
            if (draft.playerOrigin) setPlayerOrigin(draft.playerOrigin);
            if ('identity' in draft) setIdentity(draft.identity);
            if ('identityKnown' in draft) setIdentityKnown(draft.identityKnown);
            if (draft.foreknowledge) setForeknowledge(draft.foreknowledge);
            if (draft.npcAwareness) setNpcAwareness(draft.npcAwareness);
            if (draft.steering) setSteering(draft.steering);
            if (draft.spoiler) setSpoiler(draft.spoiler);
            if (typeof draft.storyIntent === 'string') setStoryIntent(draft.storyIntent);
            if (typeof draft.step === 'number' && draft.step < TOTAL_STEPS) setStep(draft.step);
          }
        }
      } catch (_) {}

      setDataLoading(false);
      draftReadyRef.current = true;
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 草稿回写
  useEffect(() => {
    if (!draftReadyRef.current) return;
    lsSetJSON(DRAFT_KEY, {
      scriptId, title, roleMode, pickedCard, newCardName, newCardRole, newCardBg,
      birthpoint, playerOrigin, identity, identityKnown,
      foreknowledge, npcAwareness, steering, spoiler, storyIntent, step,
    });
  }, [scriptId, title, roleMode, pickedCard, newCardName, newCardRole, newCardBg,
      birthpoint, playerOrigin, identity, identityKnown,
      foreknowledge, npcAwareness, steering, spoiler, storyIntent, step]);

  // ── 各步骤校验 ──
  const allRoleOptions = [
    ...personas.map(p => ({ key: `persona:${p.id || p.slug}`, kind: 'persona', id: p.id || null, slug: p.slug || '', name: p.name || t('mobile.new_game.role.unnamed'), subtitle: p.role || t('mobile.new_game.role.kind_persona'), pinned: !!p.is_default })),
    ...userCards.map(c => ({ key: `user:${c.id || c.slug}`, kind: 'user_card', id: c.id || null, slug: c.slug || '', name: c.name || t('mobile.new_game.role.unnamed'), subtitle: c.identity || c.role || t('mobile.new_game.role.kind_card'), pinned: false })),
  ];

  const selScript = scripts.find(s => String(s.id) === String(scriptId)) || null;
  // 出生点:剧本有锚点数据时必须显式选择(含「从头开始」哨兵);无锚点数据(未提取)不锁死;
  // birthpointRequired 为 null(本次会话尚未走过 step0 确认)时保守按"需要选择"处理。
  const birthpointOk = birthpointRequired === false || !!birthpoint;
  const step0Valid = !!scriptId && !scriptBlockReason(selScript) && birthpointOk;
  const step1Valid = (roleMode === 'existing' && !!pickedCard) || (roleMode === 'new' && !!newCardName.trim());
  const step2Valid = true; // 身份是可选项
  const step3Valid = true; // meta 都有默认值
  const step4Valid = !!title.trim() && step0Valid && step1Valid;

  const canNext = [step0Valid, step1Valid, step2Valid, step3Valid][step] ?? true;

  // ── 提交 ──
  const handleCreate = async () => {
    setSubmitErr(''); setSubmitting(true);
    try {
      // 有效性最终检查
      const sc = scripts.find(s => String(s.id) === String(scriptId));
      const blockRsn = scriptBlockReason(sc);
      if (blockRsn) throw new Error(blockRsn);

      // 有活跃 job 时再 check 一次
      const activeJob = scriptId ? await window.api.scripts.activeJob(parseInt(scriptId, 10)).catch(() => null) : null;
      if (activeJob) {
        const ajStatus = String(activeJob?.status || activeJob?.active_job?.status || '').toLowerCase();
        if (ajStatus && NEWGAME_ACTIVE_IMPORT_STATUSES.has(ajStatus) && !NEWGAME_IMPORT_TERMINAL_STATUSES.has(ajStatus)) {
          throw new Error(t('mobile.new_game.script_block.importing_retry'));
        }
      }

      // 新建角色卡
      let charId = null; let charKind = null;
      let finalRoleMode = roleMode;
      if (roleMode === 'existing') {
        const opt = allRoleOptions.find(o => o.key === pickedCard);
        charId = opt ? (opt.id || opt.slug || null) : null;
        charKind = opt ? opt.kind : null;
      } else {
        const r = await window.api.cards.myUpsert({
          name: newCardName.trim(),
          identity: newCardRole.trim() || undefined,
          background: newCardBg.trim() || undefined,
          kind: 'user',
        });
        const created = r && r.card;
        if (!created || !(created.id || created.slug)) throw new Error(t('mobile.new_game.role.create_failed'));
        charId = created.id || created.slug;
        charKind = 'user_card';
        finalRoleMode = 'existing';
      }

      const payload = {
        title: title.trim(),
        script_id: parseInt(scriptId, 10),
        character_id: charId,
        character_kind: charKind,
        new_card: null,
        role_mode: finalRoleMode,
        // 「从头开始」哨兵仅用于前端强制显式选择,后端语义仍是 birthpoint=null(从第一章开局)。
        birthpoint: (birthpoint && !isFromStartBirthpoint(birthpoint)) ? birthpoint : null,
        identity: identity ? {
          name: identity.name || '',
          role: identity.role || '',
          background: identity.background || '',
          source: identity.source || 'custom',
        } : null,
        story_intent: storyIntent.trim() || null,
        player_origin: playerOrigin || 'soul',
        ...(identity && playerOrigin !== 'body' ? { identity_known: identityKnown } : {}),
        // 注意:foreknowledge_mode/npc_awareness/steering_strength/spoiler_guard 是
        // 游戏设置字段,saves.create 的 payload 后端不消费(由 updateSettings 写入),
        // 已删除以避免后端无效字段警告。
      };

      // window.__createAndEnterSave 仅在桌面 PlatformShellCS 注册;移动外壳(MobileRoot)下它 undefined,
      // 调用即 TypeError → 移动端新游戏永远失败。改为直接 saves.create + 写设置 + nav.openGame(=launchSave 激活并跳游戏台)。
      const created = await window.api.saves.create(payload);
      if (created && created.ok === false) throw new Error(created.error || created.detail || t('mobile.new_game.create_failed'));
      const save = (created && (created.save || created)) || null;
      const newSaveId = save && save.id;
      if (newSaveId) {
        try {
          await window.api.saves.updateSettings(newSaveId, {
            foreknowledge_mode: foreknowledge,
            npc_awareness: npcAwareness,
            steering_strength: steering,
            spoiler_guard: spoiler,
          }, true);
        } catch (settingsErr) {
          // 设置写失败不阻断进入游戏,但给用户非阻塞提示。
          window.__apiToast?.(
            t('m_newgame_extra.settings_save_failed', { error: settingsErr?.message || t('m_newgame_extra.settings_write_error') }),
            { kind: 'warn', duration: 5000 }
          );
        }
      }
      lsRemove(DRAFT_KEY);
      onDone?.();
      if (newSaveId && nav.openGame) { nav.openGame(save); }   // 激活存档 + 跳转游戏台
      else { nav.pop(); }
    } catch (e) {
      const msg = e?.message || (e?.payload && (e.payload.error || e.payload.detail)) || t('mobile.new_game.create_failed');
      setSubmitErr(msg);
    }
    setSubmitting(false);
  };

  // ── 渲染 ──
  return (
    <>
      {/* 顶栏 */}
      <div className="pl-head">
        <button className="pl-back" onClick={() => step > 0 ? setStep(s => s - 1) : nav.pop()} aria-label={t('mobile.new_game.back_label')}>
          <Icon name="chevron_left" size={17} />
        </button>
        <div className="pl-head-title">
          <strong>{t(STEPS[step].titleKey)}</strong>
          <StepDots step={step} total={TOTAL_STEPS} />
        </div>
      </div>

      {/* 内容区 */}
      <div className="pl-body" style={{ paddingBottom: 100 }}>
        <div className="pl-pad">
          {dataLoading ? (
            <Loading text={t('mobile.new_game.loading_wizard')} />
          ) : dataErr ? (
            <ErrBar msg={dataErr} />
          ) : (
            <>
              {step === 0 && (
                <StepScriptBirth
                  scripts={scripts}
                  lockedScriptId={lockedScriptId}
                  scriptId={scriptId}
                  setScriptId={v => { setScriptId(v); lsSet('newgame.lastScriptId', v); }}
                  birthpoint={birthpoint}
                  setBirthpoint={setBirthpoint}
                  onBirthpointRequiredChange={setBirthpointRequired}
                />
              )}
              {step === 1 && (
                <StepRole
                  personas={personas}
                  userCards={userCards}
                  roleMode={roleMode}
                  setRoleMode={setRoleMode}
                  pickedCard={pickedCard}
                  setPickedCard={setPickedCard}
                  newCardName={newCardName}
                  setNewCardName={setNewCardName}
                  newCardRole={newCardRole}
                  setNewCardRole={setNewCardRole}
                  newCardBg={newCardBg}
                  setNewCardBg={setNewCardBg}
                />
              )}
              {step === 2 && (
                <StepIdentity
                  scriptId={scriptId}
                  birthpoint={birthpoint}
                  pickedCard={pickedCard}
                  allRoleOptions={allRoleOptions}
                  playerOrigin={playerOrigin}
                  setPlayerOrigin={setPlayerOrigin}
                  identity={identity}
                  setIdentity={setIdentity}
                  identityKnown={identityKnown}
                  setIdentityKnown={setIdentityKnown}
                />
              )}
              {step === 3 && (
                <StepMeta
                  foreknowledge={foreknowledge}
                  setForeknowledge={setForeknowledge}
                  npcAwareness={npcAwareness}
                  setNpcAwareness={setNpcAwareness}
                  steering={steering}
                  setSteering={setSteering}
                  spoiler={spoiler}
                  setSpoiler={setSpoiler}
                  storyIntent={storyIntent}
                  setStoryIntent={setStoryIntent}
                />
              )}
              {step === 4 && (
                <StepConfirm
                  title={title}
                  setTitle={setTitle}
                  scripts={scripts}
                  scriptId={scriptId}
                  birthpoint={birthpoint}
                  birthpointRequired={birthpointRequired}
                  roleMode={roleMode}
                  pickedCard={pickedCard}
                  newCardName={newCardName}
                  allRoleOptions={allRoleOptions}
                  playerOrigin={playerOrigin}
                  identity={identity}
                  foreknowledge={foreknowledge}
                  npcAwareness={npcAwareness}
                  steering={steering}
                  spoiler={spoiler}
                  submitErr={submitErr}
                  submitting={submitting}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* 底部按钮栏 */}
      {!dataLoading && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '12px 16px calc(var(--safe-bottom) + 12px)',
          background: 'linear-gradient(to bottom, transparent, var(--bg) 30%)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* 快速开始:剧本+角色就绪后,跳过可选设定(身份/元知识)直接创建 —— 对齐酒馆「直接开聊」,
              身份/元知识保持各自默认值。仅在已看过角色步骤(step≥1)且未在最后一步时出现。 */}
          {step >= 1 && step < TOTAL_STEPS - 1 && step0Valid && step1Valid && (
            <button
              className="pl-btn-ghost"
              style={{ width: '100%', fontSize: 13, opacity: submitting ? 0.45 : 1 }}
              disabled={submitting}
              onClick={handleCreate}
            >
              {submitting
                ? <><Icon name="spinner" size={14} className="spin" /> {t('mobile.new_game.nav.creating')}</>
                : <><Icon name="play" size={14} /> {t('mobile.new_game.nav.quick_start')}</>}
            </button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button className="pl-btn-ghost" style={{ flex: 1 }} onClick={() => setStep(s => s - 1)}>
              <Icon name="chevron_left" size={15} /> {t('mobile.new_game.nav.prev')}
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button
              className="pl-btn-primary"
              style={{ flex: 2, opacity: (canNext && !submitting) ? 1 : 0.45 }}
              disabled={!canNext || dataLoading || submitting}
              onClick={() => { if (canNext) setStep(s => s + 1); }}
            >
              {t('mobile.new_game.nav.next')} <Icon name="chevron_right" size={15} />
            </button>
          ) : (
            <button
              className="pl-btn-primary"
              style={{ flex: 2, opacity: (step4Valid && !submitting) ? 1 : 0.45 }}
              disabled={!step4Valid || submitting}
              onClick={handleCreate}
            >
              {submitting ? <><Icon name="spinner" size={15} className="spin" /> {t('mobile.new_game.nav.creating')}</> : <><Icon name="play" size={15} /> {t('mobile.new_game.nav.start')}</>}
            </button>
          )}
          </div>
        </div>
      )}
    </>
  );
}

export default MobileNewGame;
