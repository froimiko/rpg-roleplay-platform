/* 新游戏向导 Step 3:出生点选择(进度信号病灶 UI 侧,逐字复制)。
   附带 mock 出生点数据 / 步骤进度条 / 内联错误条等展示件。
   从 components/saves/NewGame.jsx 二次拆出,JSX 逐字节不变。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../game-icons.jsx';

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

export { BirthpointStep };
