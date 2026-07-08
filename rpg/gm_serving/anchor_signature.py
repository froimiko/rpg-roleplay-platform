"""gm_serving/anchor_signature.py — 锚点到达的【确定性签名匹配】层(零 LLM,纯函数)。

行者 268 实锤(2026-07-08):GM 几乎逐句重演了锚点内容(#1255/#1345 相隔 90 回合两次
「创造人物…不限种族、年龄、性别」),验收器却 1300+ 回合零标记——判定是纯 LLM 单层
(廉价模型+极度保守 prompt+任何失败静默空返回),没有确定性地板;历史反查/GM 自觉
两道防线又共享同一个识别断点。结果=锚点滞留 pending 反复注入反复重演。

本层原则(守 feedback_harness_determinism):
- 从锚点 summary 提取「签名短语」(引号内台词/长专名段,5-24 字,去常用词);
- 回合正文【逐字】命中 ≥MIN_HITS 个不同签名 且命中率≥MIN_RATIO → 判定到达;
- 宁漏勿误:阈值保守,漏了还有 LLM 判定器(它在本层之后跑);误标代价高(跳过原著)。
"""
from __future__ import annotations

import re

# 签名短语长度界(CJK):太短撞车率高,太长 GM 改写后命不中。
_SIG_MIN, _SIG_MAX = 5, 24
# 判定阈值:≥2 个不同签名逐字命中,且命中数占签名总数 ≥35%。
MIN_HITS = 2
MIN_RATIO = 0.35
# 单回合确定性层最多标几个(保守,防一段正文吞多锚)。
MAX_DET_MARKS_PER_TURN = 2

# 高频虚词/叙事套话开头,签名不允许以这些开头(降撞车)。
_STOP_PREFIX = ("这个", "那个", "他们", "我们", "你们", "但是", "所以", "因为",
                "然后", "接着", "此时", "这时", "突然", "已经", "自己", "没有")


def extract_signatures(summary: str) -> list[str]:
    """从锚点 summary 提取签名短语(确定性)。优先引号台词,其次逗号/句号切出的长片段。"""
    s = str(summary or "").strip()
    if not s:
        return []
    sigs: list[str] = []
    # 1) 引号内台词(“…”/「…」/ASCII "…"):原著台词=最强签名。
    for m in re.findall(r"[“「\"]([^”」\"]{%d,%d})[”」\"]" % (_SIG_MIN, _SIG_MAX), s):
        sigs.append(m)
    # 2) 台词内再按标点切子句(长台词 GM 常只复述半句)。
    expanded: list[str] = []
    for sig in sigs:
        expanded.append(sig)
        # 顿号不切:「不限种族、年龄、性别」这类并列串是整体强签名,切碎全变短词。
        for part in re.split(r"[,，;；!!??]", sig):
            part = part.strip()
            if _SIG_MIN <= len(part) <= _SIG_MAX:
                expanded.append(part)
    # 3) 叙述句片段:按标点切,取长度合规且不以虚词开头的。
    for part in re.split(r"[,，。;；:\s!!??…]+", re.sub(r"[“”「」\"]", "", s)):
        part = part.strip()
        if _SIG_MIN <= len(part) <= _SIG_MAX and not part.startswith(_STOP_PREFIX):
            expanded.append(part)
    # 去重保序,截断(控成本)。
    seen: set[str] = set()
    out: list[str] = []
    for x in expanded:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out[:24]


def match_anchor_in_text(summary: str, turn_text: str) -> dict:
    """签名逐字命中判定。返回 {hit: bool, hits: int, total: int, matched: [...]}。纯函数。"""
    text = str(turn_text or "")
    sigs = extract_signatures(summary)
    if not sigs or not text:
        return {"hit": False, "hits": 0, "total": len(sigs), "matched": []}
    matched = [g for g in sigs if g in text]
    hits = len(matched)
    ratio = hits / max(1, len(sigs))
    return {
        "hit": hits >= MIN_HITS and ratio >= MIN_RATIO,
        "hits": hits, "total": len(sigs), "ratio": round(ratio, 3),
        "matched": matched[:6],
    }


def deterministic_hits(pending: list[dict], turn_text: str) -> list[dict]:
    """对候选 pending 锚点跑签名匹配,返回命中列表(形状对齐 _apply_hits 的输入:
    [{anchor_key, drift_score}]),按命中率降序,截 MAX_DET_MARKS_PER_TURN。"""
    scored: list[tuple[float, dict]] = []
    for a in pending or []:
        key = a.get("anchor_key")
        if not key:
            continue
        m = match_anchor_in_text(str(a.get("summary") or ""), turn_text)
        if m["hit"]:
            # 确定性命中统一按 variant 口径(drift 0.25):发生方式可能已被 GM 改写,
            # 但核心内容确凿出现——比「永远 pending 反复重演」诚实得多。
            scored.append((m["ratio"], {"anchor_key": key, "drift_score": 0.25,
                                        "_det_matched": m["matched"]}))
    scored.sort(key=lambda x: -x[0])
    return [h for _, h in scored[:MAX_DET_MARKS_PER_TURN]]
