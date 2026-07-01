"""流水线去 fork · 批次3:确定性 P2 簇(层预算/缓存/污染/竞态/工具集)。"""
from __future__ import annotations

import inspect
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))


def test_tavern_module_layers_have_budget():
    from context_engine._constants import MAX_LAYER_CHARS
    for k in ("tavern_character", "tavern_card_system", "tavern_persona",
              "module_scene", "module_encounter", "rules_state"):
        assert (MAX_LAYER_CHARS.get(k) or 0) >= 1800, f"{k} 仍走默认 1800 截断"


def test_novel_provider_neutralizes_state_tags():
    from context_providers import novel
    src = inspect.getsource(novel.NovelRetrievalProvider.collect)
    assert "_neutralize_state_write_tags" in src or "_neu(" in src, \
        "novel RAG body 未中和【】状态标签 → GM 复述可能误触发写入"


def test_rules_provider_dynamic_layer_not_a_tier():
    from context_providers import rules
    src = inspect.getsource(rules.RulesProvider.collect)
    # 动态 HP/骰子层必须显式 C 级缓存 + 独立 id(不与静态 rules A 级撞)
    assert 'cache_tier="C"' in src or "cache_tier='C'" in src
    assert '"rules_state"' in src or "'rules_state'" in src


def test_saves_rewind_uses_atomic_jsonb_set():
    saves = (REPO / "platform_app" / "api" / "saves.py").read_text(encoding="utf-8")
    # 进度回退端点必须原子 jsonb_set,不再整列读-改-写(workers=2 竞态)
    assert "jsonb_set" in saves and "'{progress_chapter}'" in saves


def test_acceptance_retry_uses_same_toolset_as_first_pass():
    cp = (REPO / "chat_pipeline.py").read_text(encoding="utf-8")
    # retry 第二稿工具集必须 = 首稿(_gm_tools),不能写死 unified_tools(slim 档不一致)
    # 定位 retry 块内的 respond_stream_with_tools 调用
    idx = cp.find("_retry_state_iter = gm.respond_stream_with_tools")
    assert idx > 0
    window = cp[idx:idx + 400]
    assert "tools=_gm_tools" in window, "retry 仍用 unified_tools → slim 档工具集不一致"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-q"]))
