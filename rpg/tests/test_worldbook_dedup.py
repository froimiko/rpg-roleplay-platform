"""世界书双注入去重叠(反馈)。两条激活模型都保留,只删重复:按唯一 id、缺 stash 不过滤(无回归)。"""
import inspect
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))


def test_load_worldbook_records_selected_ids():
    from retrieval import _load_worldbook_for_retrieval
    seen = set()
    _load_worldbook_for_retrieval(6, "素世 修炼 势力", top_k=3, seen_out=seen)
    assert seen, "seen_out 未被填充(script6 应有 worldbook)"
    assert all(str(x).startswith("db_") for x in seen), "id 应为 db_{id} 格式(与 provider 同键)"


def test_provider_dedups_by_id_not_title_regression_safe():
    from context_providers import novel
    src = inspect.getsource(novel.NovelWorldbookProvider.collect)
    assert "_rag_wb_ids" in src
    assert 'e.get("id"' in src, "必须按唯一 id 过滤(worldbook 常同名/空 title,不能按 title)"
    assert "getattr(state" in src, "缺 stash 时须 getattr 默认→不过滤(无回归)"


def test_retrieve_context_stashes_wb_ids_transient():
    import retrieval
    src = inspect.getsource(retrieval.retrieve_context)
    assert "_rag_wb_ids" in src and "seen_out=" in src
    assert "setattr(state" in src, "须挂瞬态属性(不进 state.data,避免落库 set)"
