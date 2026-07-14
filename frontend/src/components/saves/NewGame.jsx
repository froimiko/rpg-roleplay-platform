/* 新游戏向导 (存档名 / 剧本 → 角色卡 → 出生点 → 初始身份 → 故事意图) + 剧本就绪判定纯工具。
   从 pages/saves.jsx 拆出,JSX / props 流逐字节不变。 */

import React from 'react';
import { createPortal } from 'react-dom';
import { useState as useStatePL } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../game-icons.jsx';
import { plNavigate } from '../../router.js';
import { CardSheet, CardEditFields, cardFormInit, cardFormPayload } from '../../pages/cards.jsx';
import { lsGet, lsSet, lsGetJSON, lsSetJSON, lsRemove } from '../../lib/storage.js';
import CSHeader from '@cloudscape-design/components/header';
import CSContainer from '@cloudscape-design/components/container';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSButton from '@cloudscape-design/components/button';
import CSBox from '@cloudscape-design/components/box';
import CSBadge from '@cloudscape-design/components/badge';
import CSStatusIndicator from '@cloudscape-design/components/status-indicator';
import CSKeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import CSSelect from '@cloudscape-design/components/select';
import CSModal from '@cloudscape-design/components/modal';
import CSInput from '@cloudscape-design/components/input';
import CSFormField from '@cloudscape-design/components/form-field';
import CSTextarea from '@cloudscape-design/components/textarea';
import CSSegmentedControl from '@cloudscape-design/components/segmented-control';
import CSColumnLayout from '@cloudscape-design/components/column-layout';
import CSAlert from '@cloudscape-design/components/alert';

const NEWGAME_ACTIVE_IMPORT_STATUSES = new Set(["queued", "pending", "running", "processing", "importing", "started"]);
const NEWGAME_IMPORT_TERMINAL_STATUSES = new Set(["done", "done_with_errors", "partial", "failed", "cancelled"]);
const NEWGAME_BLOCKING_READINESS_KEYS = new Set(["chunks", "anchors"]);

function newGameReadinessLabel(key, t) {
  return t(`scripts.my.readiness_label_${key}`, { defaultValue: key });
}

function newGameActiveJobBlockReason(payload, t) {
  const job = payload?.job || payload?.active_job || payload;
  const status = String(job?.status || payload?.status || "").trim().toLowerCase();
  if (status && NEWGAME_ACTIVE_IMPORT_STATUSES.has(status) && !NEWGAME_IMPORT_TERMINAL_STATUSES.has(status)) {
    return t('saves.new_game.script_not_ready_importing');
  }
  if (payload?.active === true && (!status || !NEWGAME_IMPORT_TERMINAL_STATUSES.has(status))) {
    return t('saves.new_game.script_not_ready_importing');
  }
  return "";
}

function newGameScriptBlockReason(script, t) {
  if (!script) return "";
  const status = String(
    script.import_status
    || script.job_status
    || script.active_job?.status
    || script.readiness?.active_job?.status
    || ""
  ).trim().toLowerCase();
  if (status && NEWGAME_ACTIVE_IMPORT_STATUSES.has(status) && !NEWGAME_IMPORT_TERMINAL_STATUSES.has(status)) {
    return t('saves.new_game.script_not_ready_importing');
  }
  const missing = Array.isArray(script.readiness?.missing) ? script.readiness.missing : [];
  const blocking = missing.filter((key) => NEWGAME_BLOCKING_READINESS_KEYS.has(key));
  if (blocking.length > 0) {
    return t('saves.new_game.script_not_ready_missing', {
      items: blocking.map((key) => newGameReadinessLabel(key, t)).join('、'),
    });
  }
  if (Number(script.chapter_count || 0) <= 0) {
    return t('saves.new_game.script_not_ready_missing', { items: newGameReadinessLabel('chunks', t) });
  }
  return "";
}

/* =====================================================================
   NEW GAME WIZARD  (4-step)
   Step 1: 存档名称 + 剧本
   Step 2: 角色卡
   Step 3: 出生点 (按 phase 分组)
   Step 4: 初始身份 (LLM 推荐 + 自定义)
   ===================================================================== */

/* --- mock birthpoints (backend not yet available) --- */
const MOCK_BIRTHPOINTS_PHASES = [
  {
    phase_label: "初期穿越与火星线",
    chapter_min: 1, chapter_max: 299, chapter_count: 255,
    summary: "主角穿越初期，身份混乱，火星阴谋渐浮水面。",
    anchors: [
      { anchor_id: 1001, story_time_label: "初次睁眼", chapter_min: 1, chapter_max: 1, chapter_count: 1, sample_summary: "穿越者第一次在异世界睁开眼睛，一切尚未展开。" },
      { anchor_id: 1002, story_time_label: "宫廷初入", chapter_min: 8, chapter_max: 12, chapter_count: 5, sample_summary: "初次踏入皇宫，身份尚未明确，诸方势力窥探。" },
      { anchor_id: 1003, story_time_label: "火星密谋曝光", chapter_min: 40, chapter_max: 55, chapter_count: 16, sample_summary: "第一条涉及火星的线索浮现，主角卷入阴谋漩涡。" },
      { anchor_id: 1004, story_time_label: "第一次逃亡", chapter_min: 88, chapter_max: 92, chapter_count: 5, sample_summary: "形势急转直下，主角不得不出逃皇都。" },
      { anchor_id: 1005, story_time_label: "结盟关键人物", chapter_min: 150, chapter_max: 160, chapter_count: 11, sample_summary: "主角与关键盟友达成协议，局势暂时稳定。" },
    ],
  },
  {
    phase_label: "权力博弈中期",
    chapter_min: 300, chapter_max: 699, chapter_count: 400,
    summary: "各方势力明争暗斗，主角逐渐掌握更多筹码。",
    anchors: [
      { anchor_id: 2001, story_time_label: "摄政风波", chapter_min: 302, chapter_max: 310, chapter_count: 9, sample_summary: "摄政王势力与皇族正面交锋，朝堂动荡。" },
      { anchor_id: 2002, story_time_label: "秘密组织现身", chapter_min: 380, chapter_max: 395, chapter_count: 16, sample_summary: "隐藏在幕后的秘密组织第一次正式出手。" },
      { anchor_id: 2003, story_time_label: "关键背叛", chapter_min: 450, chapter_max: 455, chapter_count: 6, sample_summary: "信任之人倒戈，主角陷入孤立无援的困境。" },
      { anchor_id: 2004, story_time_label: "反击开始", chapter_min: 510, chapter_max: 530, chapter_count: 21, sample_summary: "主角积蓄力量完毕，全面反击开始。" },
      { anchor_id: 2005, story_time_label: "中期决战", chapter_min: 650, chapter_max: 660, chapter_count: 11, sample_summary: "双方兵力正面碰撞，局势出现根本性转变。" },
    ],
  },
  {
    phase_label: "星际危机爆发",
    chapter_min: 700, chapter_max: 1199, chapter_count: 500,
    summary: "星际殖民地局势失控，地球与火星矛盾激化。",
    anchors: [
      { anchor_id: 3001, story_time_label: "殖民地叛乱", chapter_min: 705, chapter_max: 715, chapter_count: 11, sample_summary: "火星第三殖民地宣告独立，引发连锁反应。" },
      { anchor_id: 3002, story_time_label: "舰队集结", chapter_min: 800, chapter_max: 820, chapter_count: 21, sample_summary: "地球联合政府派遣大规模舰队前往镇压。" },
      { anchor_id: 3003, story_time_label: "太空会战", chapter_min: 950, chapter_max: 975, chapter_count: 26, sample_summary: "双方舰队在火星轨道外展开史诗级对决。" },
      { anchor_id: 3004, story_time_label: "生化武器事件", chapter_min: 1050, chapter_max: 1060, chapter_count: 11, sample_summary: "神秘生化武器被引爆，局势急剧恶化。" },
      { anchor_id: 3005, story_time_label: "停火谈判", chapter_min: 1150, chapter_max: 1165, chapter_count: 16, sample_summary: "各方被迫坐上谈判桌，利益重新分配。" },
    ],
  },
  {
    phase_label: "终局与清算",
    chapter_min: 1200, chapter_max: 1599, chapter_count: 400,
    summary: "所有伏线汇聚，主角做出最终抉择，历史走向改变。",
    anchors: [
      { anchor_id: 4001, story_time_label: "真相揭露", chapter_min: 1205, chapter_max: 1215, chapter_count: 11, sample_summary: "穿越背后的真实原因终于浮出水面。" },
      { anchor_id: 4002, story_time_label: "大清算前夜", chapter_min: 1320, chapter_max: 1325, chapter_count: 6, sample_summary: "各方势力在最终对决前夕静待时机。" },
      { anchor_id: 4003, story_time_label: "最终决战", chapter_min: 1450, chapter_max: 1480, chapter_count: 31, sample_summary: "决定世界命运的终极战役全面爆发。" },
      { anchor_id: 4004, story_time_label: "新秩序建立", chapter_min: 1550, chapter_max: 1570, chapter_count: 21, sample_summary: "旧世界崩塌，新的权力格局逐渐成形。" },
      { anchor_id: 4005, story_time_label: "尾声时间线", chapter_min: 1595, chapter_max: 1599, chapter_count: 5, sample_summary: "时间线最末端，所有人物迎来各自结局。" },
    ],
  },
  {
    phase_label: "番外与支线",
    chapter_min: 1600, chapter_max: 1699, chapter_count: 100,
    summary: "脱离主线的独立故事，探索配角与平行世界。",
    anchors: [
      { anchor_id: 5001, story_time_label: "配角外传·序", chapter_min: 1601, chapter_max: 1605, chapter_count: 5, sample_summary: "从主要配角视角重述关键事件。" },
      { anchor_id: 5002, story_time_label: "平行宇宙节点", chapter_min: 1630, chapter_max: 1640, chapter_count: 11, sample_summary: "如果关键选择不同，历史将走向何方？" },
      { anchor_id: 5003, story_time_label: "后日谈·五年后", chapter_min: 1680, chapter_max: 1690, chapter_count: 11, sample_summary: "五年后的世界，人们如何与历史和解。" },
    ],
  },
];

/* --- Wizard step progress bar --- */
function WizardProgress({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            height: 3,
            flex: 1,
            borderRadius: 99,
            background: i < step ? "var(--accent)" : i === step ? "var(--accent-edge)" : "var(--line)",
            transition: "background 0.2s",
          }}
        />
      ))}
      <span className="muted-2" style={{ fontSize: 11, whiteSpace: "nowrap", marginLeft: 4 }}>
        {step + 1} / {total}
      </span>
    </div>
  );
}

/* --- Inline error bar --- */
function InlineErr({ msg }) {
  if (!msg) return null;
  return (
    <div role="alert" style={{
      color: "var(--danger)", padding: "8px 10px",
      border: "1px solid var(--danger-soft)", borderRadius: 6,
      fontSize: 12.5, background: "var(--danger-soft)",
    }}>
      {msg}
    </div>
  );
}

/* ============================================================
   Step 3: 出生点选择
   ============================================================ */
function BirthpointStep({ scriptId, birthpoint, setBirthpoint }) {
  const { t } = useTranslation();
  const [phases, setPhases] = React.useState([]);
  const [loadingBP, setLoadingBP] = React.useState(true);
  const [bpErr, setBpErr] = React.useState("");
  const [bpEmpty, setBpEmpty] = React.useState(false);
  const [openPhase, setOpenPhase] = React.useState(null); // accordion state

  const fetchBirthpoints = React.useCallback(() => {
    if (!scriptId) return;
    setLoadingBP(true); setBpErr(""); setBpEmpty(false);
    (async () => {
      try {
        const r = await fetch(
          `${window.__API_BASE || ""}/api/scripts/${scriptId}/birthpoints`,
          { credentials: "include", headers: { Accept: "application/json" } }
        );
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        if (data && Array.isArray(data.phases) && data.phases.length > 0) {
          setPhases(data.phases);
          // auto-open first phase
          setOpenPhase(data.phases[0].phase_label);
        } else {
          // backend returned empty — show empty state, do not fall back to mock
          setPhases([]);
          setBpEmpty(true);
        }
      } catch (_) {
        // fetch failed — show empty state, do not fall back to mock
        setPhases([]);
        setBpEmpty(true);
      } finally {
        setLoadingBP(false);
      }
    })();
  }, [scriptId]);

  React.useEffect(() => { fetchBirthpoints(); }, [fetchBirthpoints]);

  if (loadingBP) {
    return (
      <div className="muted" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "16px 0" }}>
        <Icon name="spinner" size={13} className="spin" /> {t('saves.birthpoint.loading')}
      </div>
    );
  }

  if (bpEmpty) {
    return (
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        <p style={{ color: "var(--text-status-inactive, var(--muted))", marginBottom: 6 }}>
          {t('saves.new_game.birthpoints_empty')}
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
          {t('saves.new_game.birthpoints_empty_hint')}
        </p>
        <button
          onClick={fetchBirthpoints}
          style={{
            fontSize: 12, padding: "4px 14px",
            border: "1px solid var(--line)", borderRadius: 6,
            background: "var(--panel-2)", cursor: "pointer", color: "inherit",
          }}
        >
          {t('saves.new_game.retry')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <InlineErr msg={bpErr} />
      {phases.map(phase => {
        const isOpen = openPhase === phase.phase_label;
        return (
          <div key={phase.phase_label} style={{
            border: "1px solid var(--line-soft)",
            borderRadius: "var(--r-3, 8px)",
            overflow: "hidden",
          }}>
            {/* accordion header */}
            <button
              onClick={() => setOpenPhase(isOpen ? null : phase.phase_label)}
              style={{
                width: "100%", textAlign: "left",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 10, padding: "9px 14px",
                background: isOpen ? "var(--panel-2)" : "transparent",
                border: "none", cursor: "pointer",
                borderBottom: isOpen ? "1px solid var(--line-soft)" : "none",
                transition: "background 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Icon
                  name={isOpen ? "chevron_down" : "chevron_right"}
                  size={11}
                  style={{ flexShrink: 0, color: "var(--muted)" }}
                />
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 13.5, letterSpacing: "0.02em" }}>
                  {phase.phase_label}
                </span>
              </div>
              <span className="muted-2" style={{ fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>
                {t('saves.birthpoint.chapter_range', { min: phase.chapter_min, max: phase.chapter_max, count: phase.chapter_count })}
              </span>
            </button>

            {/* accordion body */}
            {isOpen && (
              <div style={{ display: "grid", gap: 4, padding: "8px 10px" }}>
                {phase.anchors.map(anchor => {
                  const isSelected = birthpoint && birthpoint.anchor_id === anchor.anchor_id;
                  return (
                    <label
                      key={anchor.anchor_id}
                      className={`pl-newgame-card${isSelected ? " active" : ""}`}
                      style={{ gridTemplateColumns: "14px 1fr auto", gap: 10, cursor: "pointer" }}
                    >
                      <input
                        type="radio"
                        checked={!!isSelected}
                        onChange={() => setBirthpoint({
                          phase_label: phase.phase_label,
                          anchor_id: anchor.anchor_id,
                          chapter_min: anchor.chapter_min,
                          chapter_max: anchor.chapter_max,
                          story_time_label: anchor.story_time_label,
                        })}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 13, letterSpacing: "0.02em" }}>
                          {anchor.story_time_label}
                        </div>
                        {anchor.sample_summary && (
                          <div className="muted-2" style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.5 }}>
                            {anchor.sample_summary}
                          </div>
                        )}
                      </div>
                      <span className="muted-2" style={{ fontSize: 10.5, whiteSpace: "nowrap", alignSelf: "center" }}>
                        {anchor.chapter_max !== anchor.chapter_min
                          ? t('saves.birthpoint.chapter_range_short', { min: anchor.chapter_min, max: anchor.chapter_max })
                          : t('saves.birthpoint.chapter_single', { min: anchor.chapter_min })}
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
  );
}

/* ============================================================
   Step 4: 初始身份
   ============================================================ */
function IdentityStep({ scriptId, birthpoint, pickedCard, allRoleOptions, identity, setIdentity, playerOrigin, setPlayerOrigin, identityKnown, setIdentityKnown }) {
  const { t } = useTranslation();
  const [recs, setRecs] = React.useState([]);
  const [recsLoading, setRecsLoading] = React.useState(false);
  const [recsErr, setRecsErr] = React.useState("");
  const [customOpen, setCustomOpen] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customRole, setCustomRole] = React.useState("");
  const [customBg, setCustomBg] = React.useState("");
  // 反馈#1:从原著 NPC 角色卡里选一个作为主角"失忆的真实身份"(与角色卡不冲突,只是开局不自知)。
  const [npcCards, setNpcCards] = React.useState([]);
  // 重做:身份来源统一成一个选择器(none / npc / ai / manual),驱动第二层只显示对应面板。
  const _srcOf = (id) => !id ? 'none' : (id._from === 'npc_card' ? 'npc' : id._from === 'ai' ? 'ai' : 'manual');
  const [identitySource, setIdentitySource] = React.useState(() => _srcOf(identity));

  const pickedRole = allRoleOptions ? allRoleOptions.find(o => o.key === pickedCard) : null;
  const pickedName = pickedRole?.name || t('saves.identity.no_card_selected');
  // 选「本剧本 NPC」开局 = 你就是这个 NPC 本人 → 出身强制锁「本世界人」(native):
  // 穿越类出身(灵魂/整体/双魂)与「我就是原著这个角色」语义矛盾,这里直接锁死,
  // 非 native 卡片不可点(实际 native 的强制由 NewGameModal 的 effect 落地)。
  const npcLocked = pickedRole?.kind === 'script_card';

  const fetchAiRecs = React.useCallback(async () => {
    if (!scriptId) {
      setRecsErr(t('saves.identity.no_script'));
      return;
    }
    setRecsLoading(true); setRecsErr(""); setRecs([]);
    const args = {
      birthpoint_phase: birthpoint ? birthpoint.phase_label : "",
      birthpoint_label: birthpoint ? birthpoint.story_time_label : "",
      character_card_id: pickedRole ? (pickedRole.id || null) : null,
      character_card_kind: pickedRole ? pickedRole.kind : null,
      player_origin: playerOrigin,  // 'isekai' | 'native' — 给 LLM prompt 决定身份类型
      n: 4,
    };
    try {
      const r = await fetch(
        `${window.__API_BASE || ""}/api/scripts/${parseInt(scriptId, 10)}/recommend-identity`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(args),
        }
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        // 502 (LLM 失败) / 500 (工具失败) / 403 (无权) 一律显示后端真实错误
        const msg = (data && data.error) || t('saves.identity.ai_req_fail', { status: r.status });
        setRecsErr(msg);
        return;
      }
      if (data && data.ok === false && data.error) {
        setRecsErr(data.error);
        return;
      }
      if (data && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        setRecs(data.recommendations);
      } else {
        setRecsErr(t('saves.identity.ai_empty'));
      }
    } catch (e) {
      setRecsErr(t('saves.identity.ai_net_err', { err: e.message || String(e) }));
    } finally {
      setRecsLoading(false);
    }
  }, [scriptId, birthpoint, pickedRole, playerOrigin]);

  const pickRec = (rec) => {
    setIdentity({
      name: rec.name || "",
      role: rec.role || "",
      background: rec.background || "",
      source: "ai",
      _from: "ai",
      player_origin: playerOrigin,  // 'isekai' | 'native' — GM 由此判断玩家定位
    });
  };

  const applyCustom = () => {
    const role = customRole.trim();
    const bg = customBg.trim();
    if (!role && !bg) return;
    setIdentity({
      name: customName.trim(),
      role,
      background: bg,
      source: "custom",
      _from: "custom",
      player_origin: playerOrigin,
    });
  };

  const clearIdentity = () => {
    setIdentity(null);
  };

  // 反馈#1:拉取该剧本的原著 NPC 角色卡,供「失忆身份」选择。
  React.useEffect(() => {
    if (!scriptId) { setNpcCards([]); return; }
    let alive = true;
    (async () => {
      try {
        const r = await window.api.cards.scriptList(parseInt(scriptId, 10));
        const list = (r && (r.items || r.cards)) || (Array.isArray(r) ? r : []);
        if (alive) setNpcCards(Array.isArray(list) ? list : []);
      } catch (_) { if (alive) setNpcCards([]); }
    })();
    return () => { alive = false; };
  }, [scriptId]);

  // 选一张 NPC 卡当失忆身份:把卡的姓名/定位/背景填进 identity,标记来源 npc_card,
  // 并默认「不知道身份卡」(失忆)——何时想起由游戏内玩家选择决定。与原 NPC 卡共存,不删除。
  const pickNpcIdentity = (card) => {
    if (!card) return;
    const nm = card.name || card.title || "";
    const role = card.identity || card.role || card.archetype || card.title || "";
    const bg = card.background || card.persona || card.summary || card.description || card.bio || "";
    setIdentity({
      name: nm,
      role,
      background: bg,
      source: "npc_card",
      _from: "npc_card",
      npc_card_id: card.id || card.slug || null,
      player_origin: playerOrigin,
    });
    setIdentityKnown(false);
  };

  // 身份卡来源随出身条件化(消除矛盾组合):
  //  灵魂穿越=占据某原住民肉身→全开;整体穿越=彻底外来者无本地身份→仅不挂;
  //  双魂同体=须有共体的原住民本体→不能不挂;本世界人=你就是该角色→不能再选另一个原著人物。
  const ALLOWED_SOURCES = {
    soul: ['none', 'npc', 'ai', 'manual'],
    body: ['none'],
    dual: ['npc', 'ai', 'manual'],
    native: ['none', 'ai', 'manual'],
  };
  const allowedSources = ALLOWED_SOURCES[playerOrigin] || ['none', 'npc', 'ai', 'manual'];

  // 切出身:若当前身份来源与新出身不兼容,重置到首个允许来源(并清掉已选身份);否则只同步标记。
  React.useEffect(() => {
    if (!allowedSources.includes(identitySource)) {
      clearIdentity();
      setIdentitySource(allowedSources[0]);
    } else if (identity && identity.player_origin !== playerOrigin) {
      setIdentity({ ...identity, player_origin: playerOrigin });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerOrigin]);

  // identity 从外部到位时(草稿恢复 / 选中)同步来源 tab;identity 为 null 时不重置,
  // 以免把"刚点了某来源 tab 但还没选具体身份"的状态打回 none。
  React.useEffect(() => {
    if (identity) setIdentitySource(_srcOf(identity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity ? `${identity._from || ''}:${identity.npc_card_id || ''}:${identity.name || ''}` : null]);

  const noIdentity = !identity;
  // 暖色面板样式(与角色档 CardSheet 一致)
  const panel = {
    background: 'var(--panel-2, #282623)', border: '1px solid var(--line-soft, #2a2724)',
    borderRadius: 12, padding: '14px 16px',
  };
  const labelEyebrow = { fontSize: 11, letterSpacing: '.06em', color: 'var(--accent, #c96442)', fontWeight: 600, textTransform: 'uppercase' };

  const chooseSource = (sid) => { setIdentitySource(sid); if (sid === 'none') clearIdentity(); };
  const idPreview = identity ? (
    <div style={{
      ...panel, borderColor: 'var(--accent, #c96442)', background: 'var(--accent-soft, rgba(201,100,66,.12))',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CSBadge color={identity._from === 'ai' ? 'blue' : (identity._from === 'npc_card' ? 'red' : 'grey')}>{identity._from === 'ai' ? t('saves.identity.badge_ai') : (identity._from === 'npc_card' ? t('saves.identity.badge_npc') : t('saves.identity.badge_manual'))}</CSBadge>
          {identity.name && <strong style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 15, color: 'var(--text, #ebe7df)' }}>{identity.name}</strong>}
          {identity.role && <span style={{ fontSize: 13, color: 'var(--text-quiet, #c8c2b7)' }}>{identity.role}</span>}
        </div>
        {identity.background && <span style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--muted, #968f85)' }}>{identity.background}</span>}
      </div>
      <CSButton iconName="close" variant="inline-link" onClick={() => chooseSource('none')}>{t('saves.identity.btn_clear')}</CSButton>
    </div>
  ) : null;

  const originCard = ({ value, icon, labelKey, essenceKey, mappingKey, hintKey, accentColor, accentBg, accentBorder }) => {
    const selected = playerOrigin === value;
    // 选了本剧本 NPC → 锁定 native;其余出身禁用(不可点、变灰)。
    const locked = npcLocked && value !== 'native';
    return (
      <button key={value} type="button" role="radio" aria-checked={selected} disabled={locked}
        onClick={() => { if (!locked) setPlayerOrigin(value); }}
        title={locked ? t('saves.identity.origin_locked_npc', { defaultValue: '已选择扮演本剧本 NPC,出身锁定为「本世界人」' }) : undefined}
        style={{ textAlign: 'left', padding: '11px 13px', cursor: locked ? 'not-allowed' : 'pointer',
          opacity: locked ? 0.4 : 1,
          border: selected ? `1px solid ${accentBorder}` : '1px solid var(--line-soft, #2a2724)',
          borderRadius: 10, background: selected ? accentBg : 'var(--panel, #211f1d)',
          display: 'grid', gap: 6, transition: 'border-color .12s, background .12s', outline: 'none' }}
        onFocus={(e) => { e.currentTarget.style.outlineOffset = '2px'; e.currentTarget.style.outline = `1px solid ${accentBorder}`; }}
        onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, color: selected ? accentColor : 'var(--muted-2, #6b655e)', transition: 'color .12s', fontFamily: 'var(--font-serif)' }}>{icon}</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 700, color: selected ? accentColor : 'var(--text, #ebe7df)', transition: 'color .12s', lineHeight: 1.2 }}>{t(`saves.identity.${labelKey}`)}</span>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: selected ? accentColor : 'var(--muted, #968f85)', lineHeight: 1.3, transition: 'color .12s' }}>{t(`saves.identity.${essenceKey}`)}</span>
        <span style={{ fontSize: 11, color: 'var(--muted-2, #6b655e)', lineHeight: 1.5, letterSpacing: '0.01em' }}>{t(`saves.identity.${mappingKey}`)}</span>
        {selected && (<span style={{ fontSize: 11.5, color: 'var(--muted, #968f85)', lineHeight: 1.5, borderTop: `1px solid ${accentBorder}`, paddingTop: 6, marginTop: 2 }}>{t(`saves.identity.${hintKey}`)}</span>)}
      </button>
    );
  };
  const ORIGINS = [
    { value: 'soul', icon: '◈', labelKey: 'origin_soul_label', essenceKey: 'origin_soul_essence', mappingKey: 'origin_soul_mapping', hintKey: 'origin_soul_hint', accentColor: '#8db4e8', accentBg: 'rgba(85,130,200,.14)', accentBorder: 'rgba(85,130,200,.38)' },
    { value: 'body', icon: '◉', labelKey: 'origin_body_label', essenceKey: 'origin_body_essence', mappingKey: 'origin_body_mapping', hintKey: 'origin_body_hint', accentColor: '#e8a87c', accentBg: 'rgba(220,140,80,.14)', accentBorder: 'rgba(220,140,80,.38)' },
    { value: 'dual', icon: '◑', labelKey: 'origin_dual_label', essenceKey: 'origin_dual_essence', mappingKey: 'origin_dual_mapping', hintKey: 'origin_dual_hint', accentColor: '#b8a0e8', accentBg: 'rgba(160,130,210,.14)', accentBorder: 'rgba(160,130,210,.38)' },
    { value: 'native', icon: '◎', labelKey: 'origin_native_label', essenceKey: 'origin_native_essence', mappingKey: 'origin_native_mapping', hintKey: 'origin_native_hint', accentColor: '#b8b0a5', accentBg: 'rgba(150,143,133,.14)', accentBorder: 'rgba(150,143,133,.32)' },
  ];
  const cardBtnStyle = (sel) => ({
    textAlign: 'left', padding: '11px 13px', cursor: 'pointer',
    border: sel ? '1px solid var(--accent, #c96442)' : '1px solid var(--line-soft, #2a2724)',
    borderRadius: 10, background: sel ? 'var(--accent-soft, rgba(201,100,66,.12))' : 'var(--panel, #211f1d)',
    display: 'grid', gap: 5, transition: 'border-color .12s, background .12s',
  });

  return (
    <CSSpaceBetween size="m">
      {/* 说明 */}
      <CSBox key="intro" color="text-body-secondary" fontSize="body-s">
        {t('saves.identity.intro')}
      </CSBox>

      {/* ── 第 1 步:本体来源(你如何进入这个世界)── */}
      <div key="origin-selector" style={{ ...panel, display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ ...labelEyebrow }}>{t('saves.identity.step1')} · {t('saves.identity.origin_section_label')}</span>
          <span style={{ fontSize: 12, color: 'var(--muted, #968f85)', lineHeight: 1.55 }}>{t('saves.identity.origin_section_hint')}</span>
        </div>
        {npcLocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderRadius: 8,
            background: 'rgba(150,143,133,.14)', border: '1px solid rgba(150,143,133,.32)',
            fontSize: 12, color: 'var(--text-quiet, #c8c2b7)', lineHeight: 1.5 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#b8b0a5', flexShrink: 0 }}>◎</span>
            <span>{t('saves.identity.origin_locked_banner', { name: pickedName, defaultValue: `已选择扮演本剧本 NPC「${pickedName}」—— 出身锁定为「本世界人」(你就是这个角色本人,GM 严格守世界观)。` })}</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }} role="radiogroup" aria-label={t('saves.identity.origin_section_label')}>
          {ORIGINS.map(originCard)}
        </div>
      </div>

      {/* ── 第 2 步:角色身份(可选)— 统一选择器:不挂 / 从原著 / AI / 手动 ── */}
      <div key="id-source" style={{ ...panel, display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ ...labelEyebrow }}>{t('saves.identity.step2')} · {t('saves.identity.id_section_label')}</span>
          <span style={{ fontSize: 12, color: 'var(--muted, #968f85)', lineHeight: 1.55 }}>{t(`saves.identity.id_section_hint_${playerOrigin}`, { name: pickedName, defaultValue: t('saves.identity.id_section_hint', { name: pickedName }) })}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label={t('saves.identity.id_section_label')}>
          {[['none', 'src_none'], ['npc', 'src_npc'], ['ai', 'src_ai'], ['manual', 'src_manual']].filter(([sid]) => allowedSources.includes(sid)).map(([sid, lk]) => {
            const sel = identitySource === sid;
            return (
              <button key={sid} type="button" role="radio" aria-checked={sel} onClick={() => chooseSource(sid)}
                style={{ padding: '7px 14px', cursor: 'pointer', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: sel ? '1px solid var(--accent, #c96442)' : '1px solid var(--line-soft, #2a2724)',
                  background: sel ? 'var(--accent-soft, rgba(201,100,66,.12))' : 'var(--panel, #211f1d)',
                  color: sel ? 'var(--accent, #c96442)' : 'var(--text, #ebe7df)', transition: 'all .12s' }}>
                {t(`saves.identity.${lk}`)}
              </button>
            );
          })}
        </div>
        {idPreview}

        {/* 从原著角色选身份 */}
        {identitySource === 'npc' && (npcCards.length > 0 ? (
          <CSColumnLayout columns={2}>
            {npcCards.map((card, i) => {
              const cid = card.id || card.slug || i;
              const isSel = identity && identity._from === 'npc_card' && String(identity.npc_card_id) === String(card.id || card.slug);
              const nm = card.name || card.title || '';
              const role = card.identity || card.role || card.archetype || '';
              const bg = card.background || card.persona || card.summary || card.description || card.bio || '';
              return (
                <button key={cid} type="button" onClick={() => pickNpcIdentity(card)} style={cardBtnStyle(isSel)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {nm && <strong style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 14, color: 'var(--text, #ebe7df)' }}>{nm}</strong>}
                    {role && <span style={{ whiteSpace: 'nowrap' }}><CSBadge>{role}</CSBadge></span>}
                    {isSel && (<span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}><CSBadge color="green">✓ {t('saves.identity.badge_selected')}</CSBadge></span>)}
                  </div>
                  {bg && <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--muted, #968f85)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{bg}</span>}
                </button>
              );
            })}
          </CSColumnLayout>
        ) : (
          <CSBox fontSize="body-s" color="text-status-inactive">{t('saves.identity.npc_empty')}</CSBox>
        ))}

        {/* AI 生成身份候选 */}
        {identitySource === 'ai' && (
          <CSSpaceBetween size="s">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--muted, #968f85)', lineHeight: 1.55, flex: '1 1 200px' }}>{t(`saves.identity.ai_desc_${playerOrigin}`, t('saves.identity.ai_desc'))}</span>
              <CSButton iconName={recs.length > 0 ? 'refresh' : 'gen-ai'} loading={recsLoading} disabled={recsLoading} onClick={fetchAiRecs}>
                {recs.length > 0 ? t('saves.identity.btn_regen') : t('saves.identity.btn_gen')}
              </CSButton>
            </div>
            {recsErr && <CSAlert type="error">{recsErr}</CSAlert>}
            {recs.length > 0 && (
              <CSColumnLayout columns={2}>
                {recs.map((rec, i) => {
                  const isSelected = identity && identity._from === 'ai' && identity.name === rec.name && identity.role === rec.role;
                  return (
                    <button key={i} type="button" onClick={() => pickRec(rec)} style={cardBtnStyle(isSelected)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {rec.name && <strong style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 14, color: 'var(--text, #ebe7df)' }}>{rec.name}</strong>}
                        {rec.role && <span style={{ whiteSpace: 'nowrap' }}><CSBadge>{rec.role}</CSBadge></span>}
                        {isSelected && (<span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}><CSBadge color="green">✓ {t('saves.identity.badge_selected')}</CSBadge></span>)}
                      </div>
                      {rec.background && <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--muted, #968f85)' }}>{rec.background}</span>}
                    </button>
                  );
                })}
              </CSColumnLayout>
            )}
          </CSSpaceBetween>
        )}

        {/* 手动创建 */}
        {identitySource === 'manual' && (
          <CSSpaceBetween size="l">
            <CSColumnLayout columns={2}>
              <CSFormField label={t('saves.identity.field_alias')} description={t('saves.identity.field_alias_desc')}>
                <CSInput value={customName} onChange={({ detail }) => setCustomName(detail.value)} placeholder={t('saves.identity.field_alias_placeholder')} />
              </CSFormField>
              <CSFormField label={t('saves.identity.field_role')} constraintText={t('saves.identity.field_role_constraint')}>
                <CSInput value={customRole} onChange={({ detail }) => setCustomRole(detail.value)} placeholder={t('saves.identity.field_role_placeholder')} />
              </CSFormField>
              <div style={{ gridColumn: '1 / -1' }}>
                <CSFormField label={t('saves.identity.field_bg')}>
                  <CSTextarea rows={3} value={customBg} onChange={({ detail }) => setCustomBg(detail.value)} placeholder={t('saves.identity.field_bg_placeholder')} />
                </CSFormField>
              </div>
            </CSColumnLayout>
            <div style={{ textAlign: 'right' }}>
              <CSButton variant="primary" iconName="check" onClick={applyCustom} disabled={!customRole.trim() && !customBg.trim()}>{t('saves.identity.btn_apply')}</CSButton>
            </div>
          </CSSpaceBetween>
        )}
      </div>

      {/* ── 第 3 步:开局是否知道这个身份(仅当挂了身份 且 本体≠纯肉穿)── */}
      {identity && playerOrigin !== 'body' && (
        <div key="known" style={{ ...panel, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ ...labelEyebrow }}>{t('saves.identity.step3')} · {t('saves.identity.identity_known_label')}</span>
            <span style={{ fontSize: 12, color: 'var(--muted, #968f85)', lineHeight: 1.55 }}>{t('saves.identity.identity_known_hint')}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }} role="radiogroup" aria-label={t('saves.identity.identity_known_label')}>
            {[
              { val: true, labelKey: 'identity_known_true_label', descKey: 'identity_known_true_desc' },
              { val: false, labelKey: 'identity_known_false_label', descKey: 'identity_known_false_desc' },
            ].map(({ val, labelKey, descKey }) => {
              const sel = identityKnown === val;
              return (
                <button key={String(val)} type="button" role="radio" aria-checked={sel} onClick={() => setIdentityKnown(val)}
                  style={{ flex: '1 1 0', textAlign: 'left', padding: '9px 12px', cursor: 'pointer',
                    border: sel ? '1px solid var(--accent-edge, rgba(201,100,66,.42))' : '1px solid var(--line-soft, #2a2724)',
                    borderRadius: 8, background: sel ? 'var(--accent-soft, rgba(201,100,66,.12))' : 'var(--panel, #211f1d)',
                    display: 'grid', gap: 3, transition: 'border-color .12s, background .12s', outline: 'none' }}
                  onFocus={(e) => { e.currentTarget.style.outline = '1px solid var(--accent-edge)'; e.currentTarget.style.outlineOffset = '2px'; }}
                  onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: sel ? 'var(--accent, #c96442)' : 'var(--text, #ebe7df)', transition: 'color .12s' }}>{t(`saves.identity.${labelKey}`)}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--muted, #968f85)', lineHeight: 1.5 }}>{t(`saves.identity.${descKey}`)}</span>
                </button>
              );
            })}
          </div>
          {identity._from === 'npc_card' && (
            <CSBox fontSize="body-s" color="text-body-secondary">{t('saves.identity.npc_known_hint')}</CSBox>
          )}
        </div>
      )}
      {identity && playerOrigin === 'body' && (
        <CSBox key="known-na" fontSize="body-s" color="text-status-inactive">{t('saves.identity.known_na_body')}</CSBox>
      )}
    </CSSpaceBetween>
  );
}

/* ============================================================
   MAIN WIZARD COMPONENT
   ============================================================ */
function NewGameModal({ open, onClose, onConfirm, defaultScriptId = null }) {
  const { t } = useTranslation();
  // ── shared data ──────────────────────────────────────────────
  const [scripts, setScripts] = useStatePL([]);
  const [personas, setPersonas] = useStatePL([]);
  const [userCards, setUserCards] = useStatePL([]);
  // 本剧本 NPC 角色卡:可直接「扮演 NPC」开局(character_kind='script_card')。配合下方「本世界人」
  // 出身即「你就是这个 NPC,GM 守世界观」的闭环。后端早已支持(create_save kind='script_card')。
  const [scriptNpcCards, setScriptNpcCards] = useStatePL([]);
  const [loading, setLoading] = useStatePL(true);

  // ── Step 1 state ─────────────────────────────────────────────
  const [title, setTitle] = useStatePL("");
  const [scriptId, setScriptId] = useStatePL("");

  // ── Step 2 state ─────────────────────────────────────────────
  const [roleMode, setRoleMode] = useStatePL("existing");
  const [pickedCard, setPickedCard] = useStatePL("");
  // 新建角色卡:复用 cards.jsx 的完整字段表单(与「新建用户角色卡」对齐)
  const [newCardForm, setNewCardForm] = useStatePL(() => cardFormInit(null));
  const uNewCard = (k, v) => setNewCardForm(f => ({ ...f, [k]: v }));
  // 角色卡预览(只读 CardSheet)
  const [previewCard, setPreviewCard] = useStatePL(null);

  // ── Step 3 state ─────────────────────────────────────────────
  const [birthpoint, setBirthpoint] = useStatePL(null);

  // ── Step 4 state ─────────────────────────────────────────────
  const [identity, setIdentity] = useStatePL(null);

  // ── Step 5 state ─────────────────────────────────────────────
  const [storyIntent, setStoryIntent] = useStatePL("");

  // 玩家定位类型 (soul/body/dual/native) — 与身份卡 overlay 正交。
  // 提到 NewGameModal 顶层,IdentityStep 通过 prop 读写,
  // payload 独立带上 player_origin 字段(身份卡为 null 时也要带)。
  const [playerOrigin, setPlayerOrigin] = useStatePL('soul');
  // 是否知道身份卡 — body 时置 null(无身份卡); 其余默认 true(知道)。
  const [identityKnown, setIdentityKnown] = useStatePL(true);

  // ── submit ───────────────────────────────────────────────────
  const [submitErr, setSubmitErr] = useStatePL("");
  const [submitting, setSubmitting] = useStatePL(false);
  const [reviewGateBlocked, setReviewGateBlocked] = useStatePL(false);

  // 反馈#4:新游戏表单草稿本地持久化——填到一半切页/关弹窗回来不丢,仅"成功开始游戏"后清空。
  const NEWGAME_DRAFT_KEY = 'newgame.draft.v1';
  const draftReadyRef = React.useRef(false);  // 草稿恢复完成前不回写,避免初始 reset 把草稿覆盖
  // 失败重试去重:roleMode==='new' 时只创建一次角色卡,重试复用已创建的 id,
  // 避免每次 handleSubmit 重试都 myUpsert 落一张新卡。
  const createdCardRef = React.useRef(null);
  const clearNewgameDraft = React.useCallback(() => {
    lsRemove(NEWGAME_DRAFT_KEY);
  }, []);

  // ── load data when opened ────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    draftReadyRef.current = false;  // 反馈#4:恢复完成前禁止回写草稿
    createdCardRef.current = null;  // 新一轮开窗清空已创建卡引用
    // reset transient state
    setTitle(""); setSubmitErr(""); setSubmitting(false); setReviewGateBlocked(false); setLoading(true); setPlayerOrigin('soul'); setIdentityKnown(true);
    setNewCardForm(cardFormInit(null)); setPreviewCard(null);
    setBirthpoint(null); setIdentity(null); setStoryIntent("");
    (async () => {
      let scList = [];
      try {
        const r = await window.api.scripts.list();
        scList = Array.isArray(r) ? r : (r?.items || r?.scripts || []);
      } catch (_) {}
      let psList = [];
      try {
        const p = await window.api.account.personas.list();
        psList = (p && (p.items || p.personas)) || [];
      } catch (_) {}
      let ucList = [];
      try {
        const c = await window.api.cards.myList();
        ucList = (c && (c.items || c.cards)) || [];
      } catch (_) {}
      setScripts(scList);
      setPersonas(psList);
      setUserCards(ucList);
      // task 108: script priority: 1) caller defaultScriptId 2) localStorage 3) first
      let pickId = "";
      if (defaultScriptId && scList.some(x => String(x.id) === String(defaultScriptId))) {
        pickId = String(defaultScriptId);
      } else {
        const remembered = lsGet("newgame.lastScriptId") || "";
        if (remembered && scList.some(x => String(x.id) === remembered && !newGameScriptBlockReason(x, t))) {
          pickId = remembered;
        } else {
          const firstPlayable = scList.find(x => !newGameScriptBlockReason(x, t));
          pickId = firstPlayable ? String(firstPlayable.id) : (scList.length ? String(scList[0].id) : "");
        }
      }
      setScriptId(pickId);
      // default character
      if (psList.length) { setRoleMode("existing"); setPickedCard(`persona:${psList[0].id || psList[0].slug}`); }
      else if (ucList.length) { setRoleMode("existing"); setPickedCard(`user:${ucList[0].id || ucList[0].slug}`); }
      else { setRoleMode("new"); setPickedCard(""); }
      // task 127: 默认存档名只用剧本名 — 角色还没选,不要预设角色名
      // (之前用 psList[0].name 但用户还没"选",误导)
      try {
        const sc = scList.find(x => String(x.id) === pickId);
        const scTitle = (sc && (sc.title || "").replace(/^《|》$/g, "")) || "";
        if (scTitle) setTitle(`${scTitle} · ${t('saves.page.new_save_suffix')}`);
        else setTitle(t('saves.new_game.page_title'));
      } catch (_) { setTitle(t('saves.new_game.page_title')); }
      // 反馈#4:在默认值之上覆盖本地草稿——无指定剧本(通用入口)或草稿剧本与本次一致时整体恢复,
      // 避免在 A 剧本开新游戏却恢复了 B 剧本的草稿。
      try {
        const draft = lsGetJSON(NEWGAME_DRAFT_KEY, null);
        const sameScript = !defaultScriptId || (draft && String(draft.scriptId) === String(defaultScriptId));
        if (draft && typeof draft === 'object' && sameScript) {
          if (typeof draft.title === 'string') setTitle(draft.title);
          if (draft.scriptId && scList.some(x => String(x.id) === String(draft.scriptId))) setScriptId(String(draft.scriptId));
          if (draft.roleMode) setRoleMode(draft.roleMode);
          if (typeof draft.pickedCard === 'string') setPickedCard(draft.pickedCard);
          if (draft.newCardForm && typeof draft.newCardForm === 'object') setNewCardForm(draft.newCardForm);
          if ('birthpoint' in draft) setBirthpoint(draft.birthpoint);
          if ('identity' in draft) setIdentity(draft.identity);
          if (draft.playerOrigin) setPlayerOrigin(draft.playerOrigin);
          if ('identityKnown' in draft) setIdentityKnown(draft.identityKnown);
          if (typeof draft.storyIntent === 'string') setStoryIntent(draft.storyIntent);
        }
      } catch (_) {}
      setLoading(false);
      draftReadyRef.current = true;  // 反馈#4:此后字段变化才回写草稿
    })();
  }, [open]);

  // 本剧本 NPC 卡:随所选剧本加载,供「选择角色 → 扮演 NPC」。换剧本即换 NPC 列表。
  React.useEffect(() => {
    if (!open || !scriptId) { setScriptNpcCards([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await window.api.cards.scriptList(parseInt(scriptId, 10));
        const list = Array.isArray(r) ? r : (r?.items || r?.cards || []);
        if (!cancelled) setScriptNpcCards(Array.isArray(list) ? list : []);
      } catch (_) { if (!cancelled) setScriptNpcCards([]); }
    })();
    return () => { cancelled = true; };
  }, [open, scriptId]);

  // 反馈#4:任一表单字段变化即写回草稿(恢复完成后才写,避免初始 reset/默认值覆盖已存草稿)
  React.useEffect(() => {
    if (!open || !draftReadyRef.current) return;
    lsSetJSON(NEWGAME_DRAFT_KEY, {
      title, scriptId, roleMode, pickedCard, newCardForm,
      birthpoint, identity, playerOrigin, identityKnown, storyIntent,
    });
  }, [open, title, scriptId, roleMode, pickedCard, newCardForm, birthpoint, identity, playerOrigin, identityKnown, storyIntent]);

  // 用户反馈闭环:选「本剧本 NPC」角色卡(key 前缀 npc:)= 你就是这个 NPC 本人 →
  // 出身自动强制锁「本世界人」(native),不再需要/允许手动选穿越类出身。
  // 切回普通卡时把被强制的 native 还原成默认 soul。必须放在 `if (!open) return null` 之前(Hooks 规则)。
  const isNpcPicked = typeof pickedCard === 'string' && pickedCard.startsWith('npc:');
  const prevNpcPickedRef = React.useRef(isNpcPicked);
  React.useEffect(() => {
    const prev = prevNpcPickedRef.current;
    prevNpcPickedRef.current = isNpcPicked;
    if (isNpcPicked) {
      if (playerOrigin !== 'native') setPlayerOrigin('native');
    } else if (prev && playerOrigin === 'native') {
      setPlayerOrigin('soul');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNpcPicked]);

  if (!open) return null;

  // 「使用现有」= 用户自己的卡库(persona + 用户创建/手动迁移的 user_card)。不含本剧本 NPC。
  const allRoleOptions = [
    ...personas.map(p => ({
      key: `persona:${p.id || p.slug}`, kind: "persona", id: p.id || null, slug: p.slug || "",
      name: p.name || t('platform.menu.unnamed'), subtitle: p.role || t('saves.new_game.card_kind_persona'), pinned: !!p.is_default,
    })),
    ...userCards.map(c => ({
      key: `user:${c.id || c.slug}`, kind: "user_card", id: c.id || null, slug: c.slug || "",
      name: c.name || t('platform.menu.unnamed'), subtitle: c.identity || t('saves.new_game.card_kind_user'), pinned: false,
    })),
  ];
  // 「本剧本 NPC」= 独立分类:直接扮演原著角色(character_kind='script_card');配合自动锁「本世界人」出身。
  const scriptNpcOptions = scriptNpcCards.map(c => ({
    key: `npc:${c.id}`, kind: "script_card", id: c.id || null, slug: "",
    name: c.name || t('platform.menu.unnamed'),
    subtitle: c.identity || c.role || t('saves.new_game.card_kind_npc', { defaultValue: '本剧本 NPC' }),
    pinned: false,
  }));
  // 解析 pickedCard 用的合集(渲染分两个 tab,但查找统一走这个)。
  const allSelectableRoles = [...allRoleOptions, ...scriptNpcOptions];

  // 各必填模块完成校验(单页:不再按步骤 gating,只用于概要 + 创建按钮)
  const selectedScript = scripts.find(sc => String(sc.id) === String(scriptId)) || null;
  const scriptBlockReason = newGameScriptBlockReason(selectedScript, t);
  const step1Valid = title.trim() && scriptId && !scriptBlockReason;
  const _pickedIsNpc = typeof pickedCard === 'string' && pickedCard.startsWith('npc:');
  const step2Valid = (roleMode === "existing" && pickedCard && !_pickedIsNpc)
    || (roleMode === "script_npc" && _pickedIsNpc)
    || (roleMode === "new" && newCardForm.name.trim());
  const step3Valid = !!birthpoint;
  // 身份卡是 overlay,和玩家出身正交。用户可以只选魂穿/肉穿/双魂/原住民定位,
  // 不挂本地身份卡时直接按角色卡开局。
  const step4Valid = true;

  const handleSubmit = async () => {
    setSubmitErr(""); setReviewGateBlocked(false); setSubmitting(true);
    try {
      const selected = scripts.find(sc => String(sc.id) === String(scriptId)) || null;
      const localBlock = newGameScriptBlockReason(selected, t);
      if (localBlock) throw new Error(localBlock);
      const active = scriptId ? await window.api.scripts.activeJob(parseInt(scriptId, 10)).catch(() => null) : null;
      const liveBlock = newGameActiveJobBlockReason(active, t);
      if (liveBlock) throw new Error(liveBlock);
      // 新建角色卡:走与「新建用户角色卡」完全相同的创建路径(myUpsert),
      // 落库后当作"现有卡"使用,确保所有字段一致持久化。
      // existing(我的卡库)与 script_npc(本剧本 NPC)都是「选已有卡」,只是来源分类不同;
      // 统一从 allSelectableRoles 解析,charKind 直接取卡的 kind(user_card/persona/script_card)。
      let picked = allSelectableRoles.find(o => o.key === pickedCard);
      let charId = roleMode !== "new" && picked ? (picked.id || picked.slug || null) : null;
      let charKind = roleMode !== "new" && picked ? picked.kind : null;
      if (roleMode === "new") {
        // 失败重试去重:首次创建后把卡存进 createdCardRef,重试直接复用已落库的 id,
        // 不再重复 myUpsert 产生重复角色卡。
        let created = createdCardRef.current;
        if (!created || !(created.id || created.slug)) {
          const r = await window.api.cards.myUpsert(cardFormPayload(newCardForm));
          created = r && r.card;
          if (!created || !(created.id || created.slug)) throw new Error(t('saves.new_game.card_create_fail'));
          createdCardRef.current = created;
        }
        charId = created.id || created.slug;
        charKind = "user_card";
      }
      const payload = {
        title: title.trim(),
        script_id: parseInt(scriptId, 10),
        character_id: charId,
        character_kind: charKind,
        new_card: null,
        // 后端只认 existing/new:新建卡已转成 user_card、本剧本 NPC 也是选已有卡 → 统一 existing
        role_mode: roleMode === "new" ? "existing" : "existing",
        birthpoint: birthpoint || null,
        // v29: 透传 source (custom|ai) 给后端落库 identity_cards.source;identity=null 表示不挂 overlay
        identity: identity ? {
          name: identity.name || "",
          role: identity.role || "",
          background: identity.background || "",
          source: identity.source || "custom",
        } : null,
        story_intent: storyIntent.trim() || null,
        // 独立字段,与 identity 解耦:即使没挂身份卡也要带,后端写到 state.player.player_origin
        player_origin: playerOrigin || 'soul',
        // 没挂身份卡时无需传 identity_known;该字段只描述"是否知道这张身份卡"。
        ...(identity && playerOrigin !== 'body' ? { identity_known: identityKnown } : {}),
      };
      const res = onConfirm?.(payload);
      if (res && typeof res.then === "function") await res;
      // 反馈#4:成功开始游戏后才清空本次草稿(关弹窗/切页不清,保证回来能续填)
      clearNewgameDraft();
    } catch (e) {
      const msg = (e && (e.message || (e.payload && (e.payload.error || e.payload.detail)))) || t('saves.new_game.create_fail');
      setSubmitErr(msg);
      // 自动检测 KB 复核 gate, 翻出 inline fast-path 按钮("一键标记并重试")
      if (msg && /KB 复核|review_status|尚未复核|尚未通过/.test(String(msg))) {
        setReviewGateBlocked(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const oneClickMarkAndRetry = async () => {
    if (!scriptId) return;
    setSubmitting(true); setSubmitErr("");
    try {
      const r = await fetch(`${window.__API_BASE || ""}/api/scripts/${parseInt(scriptId, 10)}/mark-reviewed`, {
        method: "POST", credentials: "include",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.ok === false) {
        throw new Error((data && (data.error || data.detail)) || t('saves.page.err_mark_reviewed_fail', { status: r.status }));
      }
      setReviewGateBlocked(false);
      // 立刻重试创建
      await handleSubmit();
    } catch (e) {
      setSubmitErr(String(e && (e.message || e)) || t('saves.page.err_mark_reviewed_generic'));
      setSubmitting(false);
    }
  };

  /* ── EC2 式单页:基本信息区块 ── */
  const scriptOpts = scripts.map(sc => {
    const reason = newGameScriptBlockReason(sc, t);
    return {
      value: String(sc.id),
      label: reason ? `${sc.title}（${t('saves.new_game.script_not_ready_short')}）` : sc.title,
      description: reason || undefined,
      disabled: !!reason,
    };
  });

  const sec_basic = (
    // Cloudscape Container 内部 SpaceBetween 包 [header, children],期望 children 顶层有 key
    <CSSpaceBetween key="sec_basic" size="m">
      <CSColumnLayout key="fields" columns={2}>
        <CSFormField label={t('saves.new_game.field_save_name')} constraintText={t('saves.new_game.field_save_name_req')}>
          <CSInput value={title} onChange={({ detail }) => setTitle(detail.value)} autoFocus />
        </CSFormField>
        <CSFormField label={t('saves.new_game.field_script')} constraintText={t('saves.new_game.field_script_req')}>
          <CSSelect
            selectedOption={scriptOpts.find(o => o.value === scriptId) || null}
            options={scriptOpts}
            disabled={!scripts.length}
            placeholder={scripts.length ? t('saves.new_game.field_script_placeholder') : t('saves.new_game.field_script_no_scripts')}
            onChange={({ detail }) => {
              const v = detail.selectedOption.value;
              setScriptId(v);
              setBirthpoint(null);
              if (v) lsSet('newgame.lastScriptId', v);
            }}
          />
        </CSFormField>
      </CSColumnLayout>
      {scriptBlockReason && (
        <CSAlert key="script-block" type="warning" header={t('saves.new_game.script_not_ready_title')}>
          {scriptBlockReason}
        </CSAlert>
      )}
    </CSSpaceBetween>
  );

  // 单卡渲染(「使用现有」与「本剧本 NPC」两个 tab 共用,避免标记发散)。
  const roleCardEl = (c) => (
    <label key={c.key} className={`pl-newgame-card ${pickedCard === c.key ? 'active' : ''}`}>
      <input type="radio" checked={pickedCard === c.key} onChange={() => setPickedCard(c.key)} />
      <div className="pl-newgame-card-avatar serif">{c.name.slice(0, 1)}</div>
      <div className="pl-newgame-card-body">
        <strong>{c.name}</strong>
        <span className="muted-2" style={{ fontSize: 11.5 }}>
          {c.subtitle} · {c.kind === 'persona'
            ? t('saves.new_game.card_kind_persona')
            : c.kind === 'script_card'
              ? t('saves.new_game.card_kind_npc', { defaultValue: '本剧本 NPC' })
              : t('saves.new_game.card_kind_user')}
        </span>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {c.pinned && <span className="pill accent" style={{ fontSize: 10.5 }}><Icon name="pin" size={9} /> {t('saves.new_game.card_default_pill')}</span>}
        <button type="button" className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px' }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPreview(c); }}>
          <Icon name="eye" size={11} /> {t('saves.new_game.card_preview_btn')}
        </button>
      </div>
    </label>
  );

  const step1Content = (
    // Cloudscape SpaceBetween 内部用 React.Children.map 加间距,条件渲染的 children 需要稳定 key
    <CSSpaceBetween key="step1" size="l">
      <CSFormField key="mode" label={t('saves.new_game.role_mode_label')}>
        <CSSegmentedControl
          selectedId={roleMode}
          options={[
            { id: 'existing', text: t('saves.new_game.role_mode_existing'), disabled: allRoleOptions.length === 0 },
            { id: 'script_npc', text: t('saves.new_game.role_mode_script_npc', { defaultValue: '本剧本 NPC' }), disabled: scriptNpcOptions.length === 0 },
            { id: 'new', text: t('saves.new_game.role_mode_new') },
          ]}
          onChange={({ detail }) => {
            const m = detail.selectedId;
            setRoleMode(m);
            // 切 tab 时把选中卡同步到该 tab 的来源,避免「选中卡在另一个 tab 里看不见」。
            if (m === 'script_npc') { if (!_pickedIsNpc && scriptNpcOptions[0]) setPickedCard(scriptNpcOptions[0].key); }
            else if (m === 'existing') { if (_pickedIsNpc && allRoleOptions[0]) setPickedCard(allRoleOptions[0].key); }
          }}
        />
      </CSFormField>
      {roleMode === 'existing' && allRoleOptions.length > 0 && (
        <div key="existing-cards" className="pl-newgame-cards">
          {allRoleOptions.map(roleCardEl)}
          <a className="pl-newgame-card pl-newgame-card-link" href="/cards" onClick={(e) => { e.preventDefault(); onClose && onClose(); plNavigate('cards'); }}>
            <Icon name="folder" size={14} /><span>{t('saves.new_game.card_library_link')}</span>
          </a>
        </div>
      )}
      {roleMode === 'script_npc' && (
        <div key="script-npc-cards">
          <CSBox color="text-body-secondary" fontSize="body-s" padding={{ bottom: 'xs' }}>
            {t('saves.new_game.script_npc_desc', { defaultValue: '直接扮演本剧本里的原著 NPC —— 选定后出身会自动锁为「本世界人」(你就是这个角色本人,GM 严格守世界观)。' })}
          </CSBox>
          {scriptNpcOptions.length > 0 ? (
            <div className="pl-newgame-cards">{scriptNpcOptions.map(roleCardEl)}</div>
          ) : (
            <CSBox color="text-status-inactive" fontSize="body-s">
              {scriptId
                ? t('saves.new_game.script_npc_empty', { defaultValue: '该剧本暂无 NPC 角色卡(可在剧本编辑器里生成 / 提取人物)。' })
                : t('saves.new_game.script_npc_pick_script', { defaultValue: '请先在上方选择剧本。' })}
            </CSBox>
          )}
        </div>
      )}
      {roleMode === 'new' && (
        <div key="new-card">
          <CSBox color="text-body-secondary" fontSize="body-s" padding={{ bottom: 's' }}>
            {t('saves.new_game.new_card_desc')}
          </CSBox>
          <CardEditFields form={newCardForm} u={uNewCard} kind="user" />
        </div>
      )}
    </CSSpaceBetween>
  );

  const step4Content = (
    // Cloudscape InternalSpaceBetween 用 flattenChildren+map(child=>createElement('div',{key},child)),
    // 子元素没 key 时 wrapper div 的 key 全是 undefined → React 报「Each child should have a unique key」
    <CSSpaceBetween key="step4" size="m">
      <CSBox key="intro" color="text-body-secondary" fontSize="body-s">
        {t('saves.new_game.intent_desc').split('\n').map((line, i) => (
          <div key={`l${i}`}>{line}</div>
        ))}
      </CSBox>
      <CSFormField key="textarea" label={t('saves.new_game.intent_label')}>
        <CSTextarea
          rows={6}
          value={storyIntent}
          onChange={({ detail }) => setStoryIntent(detail.value)}
          placeholder={t('saves.page.intent_placeholder')}
        />
      </CSFormField>
    </CSSpaceBetween>
  );

  // 区块标题:h2 + 说明,可选项加「· 可选」标
  const secHeader = (text, desc, optional) => (
    <CSHeader variant="h2" description={desc}>
      {text}{optional ? <CSBox variant="span" color="text-status-inactive" fontSize="body-s">{t('saves.new_game.sec_optional')}</CSBox> : null}
    </CSHeader>
  );

  // 右侧概要:必填项完成度 + 已选摘要 + 创建按钮
  const reqRows = [
    { label: t('saves.new_game.req_save_script'), ok: step1Valid },
    { label: t('saves.new_game.req_role'), ok: step2Valid },
    { label: t('saves.new_game.req_birthpoint'), ok: step3Valid },
    { label: t('saves.new_game.req_identity'), ok: step4Valid },
  ];
  const allValid = step1Valid && step2Valid && step3Valid && step4Valid;
  const pickedRoleName = roleMode === 'new'
    ? (newCardForm.name.trim() || t('saves.new_game.new_role_default'))
    : (allSelectableRoles.find(o => o.key === pickedCard)?.name || '—');

  // 角色卡预览:从原始 personas / userCards 取完整对象供 CardSheet 渲染
  const openPreview = (opt) => {
    const full = opt.kind === 'persona'
      ? personas.find(p => String(p.id || p.slug) === String(opt.id || opt.slug))
      : opt.kind === 'script_card'
        ? scriptNpcCards.find(c => String(c.id) === String(opt.id))
        : userCards.find(c => String(c.id || c.slug) === String(opt.id || opt.slug));
    const card = full || { name: opt.name, identity: opt.subtitle };
    setPreviewCard({ card: { ...card, identity: card.identity || card.role || opt.subtitle }, name: opt.name });
  };

  const node = (
    <div style={{ position: 'fixed', top: 'var(--nav-h, 53px)', left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'var(--bg, #1a1817)', overflow: 'auto' }}>
      {/* 顶部栏:标题 + 取消(位于平台顶栏下方,保留平台导航) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 3, background: '#131211', borderBottom: '1px solid #36322d' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '13px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 18, fontWeight: 600, color: '#ebe7df' }}>{t('saves.new_game.page_title')}</div>
          <CSButton iconName="close" variant="link" onClick={onClose}>{t('saves.new_game.btn_cancel')}</CSButton>
        </div>
      </div>

      {/* 响应式:窄屏两栏变单栏 */}
      <style>{'.ng-modal-cols{display:flex;gap:20px;align-items:flex-start}.ng-modal-summary{width:320px;flex-shrink:0;position:sticky;top:72px}@media(max-width:768px){.ng-modal-cols{flex-direction:column}.ng-modal-summary{width:100%;position:static;top:auto}}'}</style>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 24px 80px' }}>
        <div className="ng-modal-cols">
          {/* 左:各模块平铺 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <CSSpaceBetween size="l">
              {loading && (
                <CSBox key="loading" color="text-body-secondary"><Icon name="spinner" size={13} className="spin" /> {t('saves.new_game.loading')}</CSBox>
              )}
              {!loading && scripts.length === 0 && (
                <CSAlert key="no-scripts" type="warning" header={t('saves.new_game.no_scripts_title')}>
                  {t('saves.new_game.no_scripts_body')} <a href="/scripts-import" onClick={(e) => { e.preventDefault(); onClose && onClose(); plNavigate('scripts-import'); }}>{t('saves.new_game.no_scripts_link')}</a> {t('saves.new_game.no_scripts_suffix')}
                </CSAlert>
              )}
              {/* Cloudscape SpaceBetween 内部用 React.Children.map 加间距,需要 child 显式 key */}
              <CSContainer key="basic" header={secHeader(t('saves.new_game.sec_basic_title'), t('saves.new_game.sec_basic_desc'))}>{sec_basic}</CSContainer>
              <CSContainer key="role" header={secHeader(t('saves.new_game.sec_role_title'), t('saves.new_game.sec_role_desc'))}>{step1Content}</CSContainer>
              <CSContainer key="birthpoint" header={secHeader(t('saves.new_game.sec_birthpoint_title'), scriptId ? t('saves.new_game.sec_birthpoint_desc_ready') : t('saves.new_game.sec_birthpoint_desc_wait'))}>
                {scriptBlockReason
                  ? <CSAlert key="birthpoint-block" type="warning" header={t('saves.new_game.script_not_ready_title')}>{scriptBlockReason}</CSAlert>
                  : scriptId
                  ? <BirthpointStep key="birthpoint-step" scriptId={scriptId} birthpoint={birthpoint} setBirthpoint={setBirthpoint} />
                  : <CSBox key="birthpoint-empty" color="text-body-secondary" fontSize="body-s">{t('saves.new_game.sec_birthpoint_empty')}</CSBox>}
              </CSContainer>
              <CSContainer key="identity" header={secHeader(t('saves.new_game.sec_identity_title'), t('saves.new_game.sec_identity_desc'))}>
                <IdentityStep key="identity-step" scriptId={scriptId} birthpoint={birthpoint} pickedCard={pickedCard} allRoleOptions={allSelectableRoles} identity={identity} setIdentity={(id) => setIdentity(id)} playerOrigin={playerOrigin} setPlayerOrigin={(o) => { setPlayerOrigin(o); if (o === 'body') { /* body 无身份卡,identityKnown 设 null */ } else if (identityKnown === null || identityKnown === undefined) { setIdentityKnown(true); } }} identityKnown={identityKnown} setIdentityKnown={setIdentityKnown} />
              </CSContainer>
              <CSContainer key="intent" header={secHeader(t('saves.new_game.sec_intent_title'), t('saves.new_game.sec_intent_desc'), true)}>{step4Content}</CSContainer>
            </CSSpaceBetween>
          </div>

          {/* 右:概要 + 创建(sticky → 窄屏 static)
              CSSpaceBetween 内部 flattenChildren+map, 每个 child 需要 key 否则 wrapper key 为 undefined */}
          <div className="ng-modal-summary">
            <CSContainer header={<CSHeader variant="h2">{t('saves.new_game.summary_title')}</CSHeader>}>
              <CSSpaceBetween size="m">
                <CSSpaceBetween key="status" size="xs">
                  {reqRows.map(r => (
                    <CSStatusIndicator key={r.label} type={r.ok ? 'success' : 'pending'}>{r.label}</CSStatusIndicator>
                  ))}
                </CSSpaceBetween>
                <CSKeyValuePairs key="kv" columns={1} items={[
                  { label: t('saves.new_game.summary_save_name'), value: title.trim() || '—' },
                  { label: t('saves.new_game.summary_script'), value: scriptOpts.find(o => o.value === scriptId)?.label || '—' },
                  { label: t('saves.new_game.summary_role'), value: pickedRoleName },
                  { label: t('saves.new_game.summary_birthpoint'), value: birthpoint?.story_time_label || '—' },
                  { label: t('saves.new_game.summary_identity'), value: identity?.name || identity?.role || '—' },
                ]} />
                {submitErr && (
                  <CSAlert
                    key="err"
                    type={reviewGateBlocked ? 'warning' : 'error'}
                    action={reviewGateBlocked ? (
                      <CSButton onClick={oneClickMarkAndRetry} loading={submitting} disabled={submitting}>
                        {t('saves.new_game.mark_reviewed_and_retry')}
                      </CSButton>
                    ) : undefined}
                  >
                    {submitErr}
                  </CSAlert>
                )}
                <div key="btns" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CSButton variant="primary" disabled={!allValid || submitting} loading={submitting}
                    onClick={() => { if (allValid) handleSubmit(); }}>
                    {submitting ? t('saves.new_game.btn_creating') : t('saves.new_game.btn_create')}
                  </CSButton>
                  <CSButton variant="link" onClick={onClose}>{t('saves.new_game.btn_cancel_link')}</CSButton>
                </div>
              </CSSpaceBetween>
            </CSContainer>
          </div>
        </div>
      </div>

      {/* 角色卡预览(只读) */}
      <CSModal
        visible={!!previewCard}
        onDismiss={() => setPreviewCard(null)}
        header={t('saves.new_game.preview_title', { name: previewCard?.name || '' })}
        size="medium"
        footer={<div style={{ textAlign: 'right' }}><CSButton variant="primary" onClick={() => setPreviewCard(null)}>{t('saves.new_game.preview_close')}</CSButton></div>}
      >
        {previewCard && <CardSheet card={previewCard.card} kind="user" />}
      </CSModal>
    </div>
  );
  return createPortal(node, document.body);
}

export { NewGameModal };
