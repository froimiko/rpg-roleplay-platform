"""world_key 检索 scope(批次3b-2)单测。

核心不变量:worldline_key 全 null(现网所有书)→ resolve 返回 None → 不 clamp(零变化)。
只有书真有世界切分才把检索窗 clamp 到当前世界章节段(防跨副本串味)。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from kb.world_scope import clamp_window_to_world, resolve_world_bounds  # noqa: E402

_ROOT = Path(__file__).resolve().parents[2]


class _FakeDB:
    """最小假 db:按 (sql 关键字, params) 返回预设 rows。"""
    def __init__(self, single_row, all_rows):
        self._single = single_row
        self._all = all_rows

    def execute(self, sql, params):
        self._last_sql = sql
        self._last_params = params
        return self

    def fetchone(self):
        # 第一次 execute 是 "worldline_key ... limit 1"
        return self._single

    def fetchall(self):
        return self._all


# 无限流样例:ch1-40 主世界(null), ch41-80 木乃伊, ch81-120 生化危机
_SEQ = (
    [{"chapter": c, "worldline_key": None} for c in range(1, 41)] +
    [{"chapter": c, "worldline_key": "木乃伊世界"} for c in range(41, 81)] +
    [{"chapter": c, "worldline_key": "生化危机世界"} for c in range(81, 121)]
)


# ── resolve_world_bounds ─────────────────────────────────────────────

def test_null_worldline_returns_none():
    """主世界章(worldline_key=null)→ None(不 clamp,现网默认)。"""
    db = _FakeDB({"worldline_key": None}, _SEQ)
    assert resolve_world_bounds(db, 133, 20) is None


def test_segmented_world_returns_contiguous_bounds():
    """副本章 → 该副本的连续章节范围。"""
    db = _FakeDB({"worldline_key": "木乃伊世界"}, _SEQ)
    assert resolve_world_bounds(db, 133, 55) == (41, 80)
    db2 = _FakeDB({"worldline_key": "生化危机世界"}, _SEQ)
    assert resolve_world_bounds(db2, 133, 100) == (81, 120)


def test_boundary_chapters():
    db = _FakeDB({"worldline_key": "木乃伊世界"}, _SEQ)
    assert resolve_world_bounds(db, 133, 41) == (41, 80)  # 段首
    assert resolve_world_bounds(db, 133, 80) == (41, 80)  # 段尾


def test_missing_chapter_row_returns_none():
    db = _FakeDB(None, _SEQ)
    assert resolve_world_bounds(db, 133, 55) is None


def test_bad_args_return_none():
    db = _FakeDB({"worldline_key": "x"}, _SEQ)
    assert resolve_world_bounds(db, 0, 55) is None
    assert resolve_world_bounds(db, 133, 0) is None


def test_db_exception_returns_none():
    class _BoomDB:
        def execute(self, *a, **k):
            raise RuntimeError("db down")
    assert resolve_world_bounds(_BoomDB(), 133, 55) is None


# ── clamp_window_to_world ────────────────────────────────────────────

def test_clamp_none_is_noop():
    assert clamp_window_to_world(10, 60, None) == (10, 60)
    assert clamp_window_to_world(None, None, None) == (None, None)


def test_clamp_window_spanning_boundary():
    # 玩家在木乃伊世界(41-80),进度窗口 [70,120] 跨到生化危机 → clamp 到 [70,80]
    assert clamp_window_to_world(70, 120, (41, 80)) == (70, 80)


def test_clamp_window_within_world_untouched():
    assert clamp_window_to_world(45, 70, (41, 80)) == (45, 70)


def test_clamp_none_bounds_take_world():
    assert clamp_window_to_world(None, None, (41, 80)) == (41, 80)


def test_clamp_disjoint_falls_back_to_world():
    # 窗口与世界完全不相交(理论不该发生)→ 退世界边界,绝不返回空窗饿死 RAG
    assert clamp_window_to_world(100, 120, (41, 80)) == (41, 80)


# ── 源码守卫 ─────────────────────────────────────────────────────────

def test_retrieval_wires_world_scope():
    src = (_ROOT / "retrieval" / "assemble.py").read_text(encoding="utf-8")  # 拆包后 retrieve_context 住 retrieval/assemble.py
    assert "resolve_world_bounds" in src and "clamp_window_to_world" in src
    # clamp 必须在 anchor 原文注入之前(_load_anchor_chapter_text 之前)
    i_clamp = src.index("clamp_window_to_world")
    i_load = src.index("anchor_text = _load_anchor_chapter_text(")
    assert i_clamp < i_load, "world scope clamp 必须在原文注入前"
