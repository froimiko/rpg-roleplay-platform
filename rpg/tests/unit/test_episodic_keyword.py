"""永恒记忆·确定性关键词召回(无 embedder 兜底路径)纯函数单测。

背景:全库 kb_events 嵌入覆盖 0.65%(平台 embed 地区受限+BYOK embedder 几乎无人配),
语义路径对绝大多数用户是死的 → 稀有 gram 打分是生产主路径。宁漏勿误:
单二字 gram 永不召回、语料高频 gram(df>25%)不计分、无命中返空(不注入)。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from kb.episodic import _query_grams, _score_events  # noqa: E402


def _ev(i, summary, location="", participants=None):
    return {"id": i, "summary": summary, "location": location,
            "participants": participants or []}


# 注意 df 语义:5 条语料 df_cap=max(2, 25%)=2,gram 出现 >2 条即被当高频过滤。
# 这符合真实语义(满地都是的主线人名不携带区分信息),测试语料里人名保持稀有(≤2条)。
_EVENTS = [
    _ev(1, "玩家在破晓村向斗篷商人打听纹章的来历,对方提到石桥渡的老渡口守", "破晓村", ["斗篷商人"]),
    _ev(2, "玩家帮亨丽埃特搬运木柴,不小心露出了超出常人的力气", "破晓村", ["亨丽埃特"]),
    _ev(3, "玩家在沼泽中央的歪脖子柳树根部拔出黑色金属造物", "沼泽", []),
    _ev(4, "玩家与康拉德结为搭档,他提出三个合作条件", "石桥渡", ["康拉德"]),
    _ev(5, "夜探沼泽时惊动了水下的大体量存在,它与玩家对峙后沉回黑暗", "沼泽", []),
]


# ── _query_grams ─────────────────────────────────────────────────────

def test_grams_extracts_names_and_skips_stopwords():
    g = _query_grams("我想起草药贩之前说过什么")
    assert "草药贩" in g and "草药" in g
    assert "什么" not in g and "之前" not in g and "想起" not in g


def test_grams_empty_for_non_cjk_or_short():
    assert _query_grams("ok go!") == set()
    assert _query_grams("好") == set()


# ── _score_events ────────────────────────────────────────────────────

def test_rare_name_recalls_right_events():
    scored = _score_events("亨丽埃特会不会记得我?", _EVENTS)
    assert scored, "人名三字 gram 应召回"
    assert all("亨丽埃特" in e["summary"] for _, e in scored)


def test_single_bigram_never_recalls():
    """单个二字 gram(弱信号)不足以召回:「木柴」只在事件2出现,但 score=2<3。"""
    assert _score_events("木柴", _EVENTS) == []


def test_common_gram_df_filtered():
    """「玩家」在全部事件出现(df=100%)→ 被 df 过滤,不产生任何召回。
    真实语义:满地都是的词(该档全程在沼泽时的「沼泽」、主线人名)不携带区分信息,
    GM 从 state/digest 已知;召回瞄准的是【稀有的被遗忘细节】,宁漏勿误。"""
    assert _score_events("玩家", _EVENTS) == []


def test_nested_grams_not_double_counted():
    """「康拉德」命中时内嵌的「康拉」「拉德」不重复计分:score 恰=3(不是 3+2+2)。"""
    scored = _score_events("康拉德", _EVENTS)
    assert scored and scored[0][0] == 3


def test_location_and_participants_searchable():
    scored = _score_events("回石桥渡找人", _EVENTS)
    assert scored, "location 字段应参与匹配"
    assert any(e["location"] == "石桥渡" for _, e in scored)


def test_score_ordering_high_first():
    scored = _score_events("康拉德和沼泽里的黑色金属造物", _EVENTS)
    assert len(scored) >= 2
    assert scored[0][0] >= scored[-1][0]


def test_no_events_or_no_grams_empty():
    assert _score_events("康拉德", []) == []
    assert _score_events("", _EVENTS) == []
