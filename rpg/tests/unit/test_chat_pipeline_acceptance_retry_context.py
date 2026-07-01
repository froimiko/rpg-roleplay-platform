"""Acceptance retry 的 write-context helpers 必须在作用域内。

v1.32.9 后:acceptance verify+retry 抽成 _acceptance_gate 闭包(sync 内联 / async 走
to_thread,同源消除 sync/async fork)。retry 重 apply 仍需 ChatWriteContext + set/clear。
"""
from pathlib import Path

SRC = (Path(__file__).resolve().parents[2] / "chat_pipeline.py").read_text(encoding="utf-8")


def _gate_body() -> str:
    # 取 _acceptance_gate 闭包体(到下一个顶层注释块为止)
    after = SRC.split("def _acceptance_gate", 1)[1]
    return after.split("# ── W1 容量优化", 1)[0]


def test_acceptance_gate_imports_write_context_helpers():
    gate = _gate_body()
    assert "from state_write_context import" in gate
    assert "ChatWriteContext" in gate
    assert "set_context as" in gate
    assert "clear_context as" in gate
    assert "import secrets as" in gate


def test_acceptance_gate_reapplies_retry_draft():
    gate = _gate_body()
    # 第二稿必须重新 apply_structured_updates(否则 retry 白跑)
    assert "apply_structured_updates" in gate
