"""时间跳跃误判族第三案(群反馈·行者无疆 2026-07-05)回归测试。

「进入后先用真气感知四周环境」被判成时间线请求:「进入」触发+「后/四周」单字命中。
根修=looks_like_time_value 从单字符判定升级为时间形状 token(_TIME_TOKEN)。
族谱:v1.26.4 回忆从句(前) → 本案 动作叙述(后/周)。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from timeline_state import detect_time_directives, looks_like_time_value  # noqa: E402


# ── 本案 + 同族假阳性:动作叙述绝不能判成跳跃 ──────────────────────────

def test_reported_case_no_directive():
    """群反馈原话:进入+后+四周,三个旧命中点都不该触发。"""
    assert detect_time_directives("进入后先用真气感知四周环境") == []


def test_action_narration_family_no_directive():
    for text in [
        "进入洞穴查看四周",          # 进入+地点
        "进入战斗状态",              # 进入+状态
        "推开门进入大厅",            # 句中进入
        "来到桥边观察周围动静",      # 来到+周(周围)
        "切到防御姿态",              # 切到+非时间
        "等到他们全都睡着",          # 等到+人称(人称否决)
        "直接进入正题吧",            # 进入+抽象名词
    ]:
        assert detect_time_directives(text) == [], text


def test_single_char_values_rejected():
    """单字命中的旧假阳性源:周(四周)/次(第二次)/天(天空)/早(早知道)。"""
    for v in ["四周环境", "第二次尝试", "天空之城", "早知道这样", "后山小路"]:
        assert not looks_like_time_value(v), v


# ── 真跳跃指令回归:token 化后不能漏 ──────────────────────────────────

def test_legit_directives_still_detected():
    cases = {
        "时间跳到三天后": "三天后",
        "快进到第二天清晨": "第二天清晨",
        "跳转到第 3 章": "第 3 章",
        "时间线来到公元1024年": "公元1024年",
        "等到天亮": "天亮",
        "快进到傍晚": "傍晚",
        "进入夜晚": "夜晚",
        "跳到明天早上八点": "明天早上八点",
    }
    for text, expect_substr in cases.items():
        got = detect_time_directives(text)
        assert got, f"漏检: {text}"
        assert expect_substr in got[0].target, f"{text} → {got[0].target}"


def test_legit_time_values_accepted():
    for v in ["三天后", "翌日", "第二天", "深夜", "半个月后", "两年前", "八点半", "片刻之后"]:
        assert looks_like_time_value(v), v


def test_recall_framing_still_suppressed():
    """v1.26.4 既有行为:回忆框架不判跳跃。"""
    assert detect_time_directives("我继续回想:在进入主神空间前的日子") == []
