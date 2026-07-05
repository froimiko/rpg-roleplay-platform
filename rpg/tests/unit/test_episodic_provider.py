"""EpisodicRecallProvider(酒馆/自由/模组的长程召回)单测。

用户实锤缺口:「修的是游戏模式,酒馆没得到修复?」→ 属实。novel 走 retrieve_context
注入;tavern/freeform/module 此前完全无长程召回。本 provider 补齐,语料=kb_events
优先、state 全量 history 兜底(酒馆跳过史官,75 档仅 4 档有事件=兜底是主路径)。
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from context_providers.base import Demand, ProviderServices  # noqa: E402
from context_providers.episodic_recall import EpisodicRecallProvider  # noqa: E402
from context_providers.registry import DEFAULT_FREEFORM_MANIFEST  # noqa: E402
from kb.episodic import _excerpt_around_match, score_history_messages  # noqa: E402


class _FakeState:
    def __init__(self, history):
        self.data = {"history": history}


def _mk_history():
    """构造 20 轮(40条)历史:第 3 轮埋一个独特事实(菲奥娜的银怀表),远超 6 轮窗口。"""
    h = []
    for i in range(1, 21):
        if i == 3:
            h.append({"role": "user", "content": "我把祖传的银怀表交给菲奥娜保管,叮嘱她别打开表盖"})
            h.append({"role": "assistant", "content": "菲奥娜接过银怀表,郑重放进围裙内袋,答应绝不打开表盖。"})
        else:
            h.append({"role": "user", "content": f"第{i}轮玩家闲聊内容,无关紧要的日常对话。"})
            h.append({"role": "assistant", "content": f"第{i}轮GM回应,继续推进眼前的场景。"})
    return h


def _collect(query, history, flag_on=True, monkeypatch=None):
    prov = EpisodicRecallProvider()
    if monkeypatch is not None:
        import core.feature_flags as ff
        monkeypatch.setattr(ff, "feature_enabled", lambda key, uid=None: flag_on)
        # provider 内部是 from core.feature_flags import feature_enabled(call时导入),patch 模块函数即可生效
    services = ProviderServices(user_id=None, save_id=None)  # save_id=None → 跳过 kb_events 直走 history
    demand = Demand(player_intent=query, retrieval_query=query)
    return prov.collect(_FakeState(history), DEFAULT_FREEFORM_MANIFEST, demand, services)


def test_recalls_out_of_window_fact(monkeypatch):
    """第 3 轮的银怀表(窗口外 17 轮)应被召回并带回合归属。"""
    c = _collect("我想起交给菲奥娜的银怀表", _mk_history(), monkeypatch=monkeypatch)
    assert c.applied and c.layers, c.warnings
    text = c.layers[0]["content"]
    assert "银怀表" in text and "第3回合" in text
    assert c.debug["source"] == "history"


def test_dormant_on_generic_input(monkeypatch):
    c = _collect("我们继续往前走吧", _mk_history(), monkeypatch=monkeypatch)
    assert not c.applied


def test_flag_off_skips(monkeypatch):
    c = _collect("我想起交给菲奥娜的银怀表", _mk_history(), flag_on=False, monkeypatch=monkeypatch)
    assert not c.applied


def test_recent_window_excluded():
    """独特事实只出现在最近 12 条内 → 不召回(近因窗口已原文注入,不重复)。"""
    h = [{"role": "user", "content": f"第{i}轮无关闲聊内容而已"} for i in range(30)]
    h.append({"role": "user", "content": "我把祖传的银怀表交给菲奥娜保管"})
    hits = score_history_messages("菲奥娜的银怀表", h, exclude_recent=12, k=3)
    assert hits == []


def test_excerpt_windows_long_message():
    long_text = "废话" * 200 + "菲奥娜收下了银怀表" + "废话" * 200
    ex = _excerpt_around_match(long_text, "菲奥娜的银怀表")
    assert "菲奥娜" in ex and len(ex) <= 250 and ex.startswith("…") and ex.endswith("…")


def test_registered_in_non_novel_packs():
    from context_providers.registry import (
        DEFAULT_FREEFORM_MANIFEST as F,
        DEFAULT_MODULE_MANIFEST as M,
        DEFAULT_TAVERN_MANIFEST as T,
    )
    for pack in (F, M, T):
        assert "episodic_recall" in pack["context_providers"], pack["id"]


def test_novel_pack_not_double_wired():
    """novel 走 retrieve_context 内的注入,pack 不挂本 provider(防双注入)。"""
    import context_providers.registry as reg
    novel = next(v for v in vars(reg).values()
                 if isinstance(v, dict) and v.get("kind") == "novel_adaptation")
    assert "episodic_recall" not in novel["context_providers"]
