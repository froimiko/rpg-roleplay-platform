"""
timeline_narrative_guard.py — 时间线跳跃后 GM 叙事的禁词过滤。

用户报告:用 `/set 设置时间为火星·薇瑟帝国扬陆城内` 切换时间线后,
GM 把它叙事成"穿越/醒来/拨回时钟/时间被拉回"等过渡剧情。

主防线是 context_engine._timeline_layer() 给 GM 明示禁止这类措辞。
这个模块是 belt-and-suspenders:
  · 在 user_set 时间跳跃**当回合**,扫 GM 输出,检测禁词
  · 如果命中,在 audit_log 写违规记录,前端可展示警告
  · 不强 strip(避免误删合法叙事),仅 surface 让玩家决定是否 /retry

判断条件:
  state.world.timeline.last_transition.source == "user_set"
  AND state.world.timeline.last_transition.turn == state.turn
"""
from __future__ import annotations

import re
from typing import Any

# 禁词模式 — 涵盖"穿越/重置/醒来发现/时间倒流"类过渡叙事的常见表达。
# 用 regex 而非纯字符串,捕获各种变体(『时间被一双看不见的手拨回』『时钟被拨回最初』...)。
_FORBIDDEN_PATTERNS: list[tuple[str, str]] = [
    # 穿越类
    (r"穿越(?:事件|到|回去|回|回到|过去|时空)", "穿越叙事"),
    (r"时空(?:错乱|穿梭|裂缝|乱流)", "时空错乱叙事"),
    (r"回到\s*过去", "回到过去叙事"),
    (r"时间(?:倒流|流逝|被改写)", "时间倒流叙事"),
    # 醒来/失忆开场
    (r"再次睁开(?:眼睛|眼眸|双眼)", "再次睁开眼叙事"),
    (r"(?:当你|玩家)?醒来(?:发现|时)", "醒来发现叙事"),
    (r"从(?:昏迷|沉睡|失神|意识)中(?:醒来|惊醒|苏醒)", "失神苏醒叙事"),
    # 时间被拨回 / 时钟被拨回 (覆盖各种插入描写,如"被一双看不见的手生生拨回")
    (r"时间被[^,，。!?]{0,30}?[拉拨][^,，。]{0,5}?回", "时间被拨回叙事"),
    (r"时钟被[^,，。!?]{0,20}?[拨拉][^,，。]{0,5}?回", "时钟被拨回叙事"),
    (r"[拨拉][^,，。]{0,5}?回(?:最初|原点|开始|起点)", "拨回原点叙事"),
    # 重启/重置世界
    (r"重启(?:世界|时间|场景|剧情)", "重启世界叙事"),
    (r"重置(?:世界|时间|场景|剧情)", "重置世界叙事"),
    (r"世界(?:被|又|忽然)?\s*重写", "世界被重写叙事"),
    # 惊厥/失忆/无意识开场 (这类模板化开头是 LLM 时间跳跃的典型表达)
    (r"^冷[,，]\s*刺骨的冷", "刺骨的冷开场"),
    (r"^冷得发[抖颤栗]", "发抖开场"),
    (r"当你再次[^,，。]{0,8}时", "当你再次X时模板"),
]


def detect_time_jump_violations(text: str, state: Any) -> list[dict[str, Any]]:
    """检测 GM 文本是否在 user_set 时间跳跃**当回合**写了禁止叙事。

    返回违规列表:[{"pattern_label": str, "match": str, "position": int}, ...]
    若不在 user_set 当回合,或没命中禁词,返回空列表。

    用法:chat 主流程 GM 文本完成后调一次,把结果记到 audit_log。

    判定优先级 (task 86 修):
      1. 优先看 timeline.user_set_jump_turn —— update_time(source="user_set")
         设过且不会被后续非 user_set 的 update_time 清掉。
      2. 回退看 last_transition.source == "user_set" —— 兼容旧存档(没有
         user_set_jump_turn 字段)或修复前已落地的状态。
    """
    if not text or not isinstance(text, str):
        return []
    data = getattr(state, "data", state) or {}
    timeline = (data.get("world") or {}).get("timeline") or {}
    try:
        cur_turn = int(data.get("turn") or 0)
    except (TypeError, ValueError):
        return []

    # 路径 1: 新字段 user_set_jump_turn (主路径,GM 改写 last_transition 也不影响)
    user_jump_turn = timeline.get("user_set_jump_turn")
    try:
        user_jump_turn_int = int(user_jump_turn) if user_jump_turn is not None else None
    except (TypeError, ValueError):
        user_jump_turn_int = None
    user_set_now = user_jump_turn_int == cur_turn

    # 路径 2: 兼容旧字段 last_transition.source (向后兼容,不依赖于其它修复)
    if not user_set_now:
        last_t = timeline.get("last_transition") or {}
        if not isinstance(last_t, dict):
            return []
        if last_t.get("source") != "user_set":
            return []
        try:
            last_turn = int(last_t.get("turn") or -1)
        except (TypeError, ValueError):
            return []
        if last_turn != cur_turn:
            return []

    violations: list[dict[str, Any]] = []
    for pattern, label in _FORBIDDEN_PATTERNS:
        for m in re.finditer(pattern, text, re.MULTILINE):
            violations.append({
                "pattern": pattern,
                "pattern_label": label,
                "match": m.group(0),
                "position": m.start(),
            })
    return violations


# ── 套路比喻 / 陈词滥调禁词 (反馈 #22) ──────────────────────────────
# 用户报告:Gemini 等模型爱用"投石"明喻套路。harness 思路 = 确定性检测 + surface,
# 不靠 prompt 求模型别写。关键:**只命中"比喻句式",不碰字面词** —— 否则 `投石机`
# (攻城器械)、战斗里"用投石砸"等正经用法会被误伤,反而影响体验(反馈追问点)。
# 命中后**只 surface 提示玩家可重生成,绝不 strip**(沿用本模块"不删合法叙事"哲学)。
# 清单可继续追加(每条 = (regex, label))。
_CLICHE_PATTERNS: list[tuple[str, str]] = [
    # 明喻标记 + 投石(负向前瞻排除 机/车/器/炮 等字面器械/动作)
    (r"(?:像|如同?|宛如|犹如|仿佛|好比|恰似|有如)[^。，,！？!?\n]{0,10}投石(?![机车器炮])", "投石明喻套路"),
    # 投石入水/问路/击水 + 般/一样/似的 (经典比喻构式)
    (r"投石(?![机车器炮])[^。，,！？!?\n]{0,8}(?:入水|问路|击水|落水)[^。，,！？!?\n]{0,6}(?:般|一般|一样|似的|那样)", "投石入水套路"),
]


def detect_cliche_violations(text: str) -> list[dict[str, Any]]:
    """检测 GM 文本里的套路比喻/陈词(反馈 #22)。与时间跳跃 guard 不同:**每回合都跑、
    不依赖 state 门控**,因为陈词是通用风格问题。

    返回 [{"pattern_label", "match", "position"}, ...];精准只命中比喻句式,
    字面词(投石机/投石车/用投石砸)不命中。仅 surface,调用方不应据此 strip。
    """
    if not text or not isinstance(text, str):
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for pattern, label in _CLICHE_PATTERNS:
        for m in re.finditer(pattern, text):
            key = f"{label}:{m.start()}"
            if key in seen:
                continue
            seen.add(key)
            out.append({"pattern_label": label, "match": m.group(0), "position": m.start()})
    return out


def record_violations_to_audit(state: Any, violations: list[dict[str, Any]]) -> None:
    """把检测到的违规写到 state.permissions.audit_log,方便前端展示警告。"""
    if not violations:
        return
    data = getattr(state, "data", state) or {}
    permissions = data.setdefault("permissions", {})
    audit = permissions.setdefault("audit_log", [])
    from datetime import datetime
    audit.append({
        "ts": datetime.now().isoformat(timespec="seconds"),
        "kind": "time_jump_narrative_violation",
        "source": "timeline_narrative_guard",
        "turn": int(data.get("turn") or 0),
        "violations": [
            {"label": v.get("pattern_label"), "match": v.get("match")}
            for v in violations
        ],
        "hint": (
            "GM 在 user_set 时间跳跃当回合写了"
            f"{len(violations)} 处过渡叙事禁词,"
            "可考虑 /retry 重新生成。"
        ),
    })
    if len(audit) > 200:
        permissions["audit_log"] = audit[-200:]


# ── 星期确定性验错(客户 abci 反馈:LLM 算不对星期,「今天周日→明天却写成周六」)───────
# 剧情正在推进确切日期时(有确切「今天=周X」+ 相对日「明天/后天/…」),用算法算出正确星期,
# 查出 LLM 写错的。**纯确定性检测,不注入、不改写、不搞状态机**。默认休眠:文本里没有确切
# 「今天=周X」基准就返回空 → 玄幻/修仙/无日历剧本零副作用。
_WD_IDX = {  # 星期字 → index(周一=0 .. 周日=6)
    "一": 0, "二": 1, "三": 2, "四": 3, "五": 4, "六": 5, "日": 6, "天": 6,
    "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6,
}
_WD_NAME = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
_REL_DAY_DELTA = {  # 相对日 → 相对「今天」的天数偏移
    "今天": 0, "今日": 0, "当天": 0, "本日": 0,
    "明天": 1, "明日": 1, "次日": 1, "翌日": 1, "第二天": 1, "隔天": 1,
    "后天": 2, "大后天": 3, "外后天": 3,
    "昨天": -1, "昨日": -1, "前天": -2, "大前天": -3,
}
_WD_TOKEN = r"(?:周|星期|礼拜)\s*([一二三四五六日天1-7])"
# 匹配「<相对日>(可选 那天/是/为/：)<周/星期/礼拜><X>」:明天周六 / 后天是星期日 / 今天礼拜天
_REL_WD_RE = re.compile(
    "(" + "|".join(sorted(_REL_DAY_DELTA, key=len, reverse=True)) + ")"
    r"(?:那天|这天|当天)?\s*(?:是|为|,|，|:|：)?\s*" + _WD_TOKEN
)
# 单独的「今天(是)周X」基准声明(即便没有相对日配对也用来定基准)
_TODAY_WD_RE = re.compile(r"(?:今天|今日|当天|本日)(?:那天|这天)?\s*(?:是|为|,|，|:|：)?\s*" + _WD_TOKEN)


def _wd_name(idx: int) -> str:
    return _WD_NAME[idx % 7]


def parse_today_weekday(text: str) -> int | None:
    """从文本里抓「今天=周X」的确切基准星期(0..6),没有返回 None。"""
    m = _TODAY_WD_RE.search(text or "")
    return _WD_IDX.get(m.group(1)) if m else None


def detect_weekday_violations(text: str, base_weekday: int | None = None) -> list[dict[str, Any]]:
    """确定性星期验错:给相对日(今天/明天/后天/…)配了错星期的地方查出来。

    base_weekday:文本外(玩家输入/近期剧情)已确立的「今天」星期;None 时退回文本内自洽
    (文本自己出现「今天=周X」就用它当基准)。**没有任何确切「今天」基准 → 返回空(休眠)**。
    返回 [{rel, match, claimed, expected, claimed_name, expected_name, base_name}]。
    """
    t = text or ""
    if not isinstance(t, str):
        return []
    pairs = []  # (delta, claimed_idx, rel_word, matched_str)
    for m in _REL_WD_RE.finditer(t):
        wd = _WD_IDX.get(m.group(2))
        if wd is not None:
            pairs.append((_REL_DAY_DELTA[m.group(1)], wd, m.group(1), m.group(0)))
    if not pairs:
        return []
    text_today = next((wd for delta, wd, _, _ in pairs if delta == 0), None)
    if text_today is None:
        text_today = parse_today_weekday(t)
    # 外部权威基准优先(玩家/剧情确立的今天);否则用文本自己的今天。
    base = base_weekday if base_weekday is not None else text_today
    if base is None:
        return []  # 无确切基准 → 不查
    out: list[dict[str, Any]] = []
    seen: set[tuple] = set()
    for delta, wd, rel, matched in pairs:
        # 基准来自文本内 today-claim 时,跳过 today 自身(自洽无意义);外部基准时连今天一起查。
        if base_weekday is None and delta == 0:
            continue
        expected = (base + delta) % 7
        if wd != expected:
            key = (rel, wd, delta)
            if key in seen:
                continue
            seen.add(key)
            out.append({
                "rel": rel, "match": matched,
                "claimed": wd, "expected": expected,
                "claimed_name": _wd_name(wd), "expected_name": _wd_name(expected),
                "base_name": _wd_name(base),
            })
    return out


__all__ = [
    "detect_time_jump_violations", "detect_cliche_violations", "record_violations_to_audit",
    "detect_weekday_violations", "parse_today_weekday",
]
