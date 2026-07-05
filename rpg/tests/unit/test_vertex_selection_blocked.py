"""core.vertex_sa.vertex_selection_blocked 单测。

背景:新用户默认模型是 vertex_ai(Agent Platform),没上传 SA 时选模型/建存档全程
零校验,玩家写完整套人设、发第一条消息才报「未找到 Vertex AI Service Account」。
本函数把这个校验前置到 POST /api/models/select 和 POST /api/saves,三例覆盖:
  1. 本地/匿名模式(require_auth=False)→ 永远放行,不受 has_user_sa 影响。
  2. 生产鉴权模式 + 用户已上传 SA(has_user_sa=True)→ 放行。
  3. 生产鉴权模式 + 用户未上传 SA(has_user_sa=False)→ 拒绝,返回文案。
"""
from __future__ import annotations

import core.vertex_sa as vertex_sa


def test_local_mode_always_allows(monkeypatch):
    """require_auth() 为假(本地/匿名开发模式)→ 无论有没有 SA 都放行,不能挡死本地模式。"""
    monkeypatch.setattr("core.config.require_auth", lambda: False)
    monkeypatch.setattr(vertex_sa, "has_user_sa", lambda *a, **k: (_ for _ in ()).throw(
        AssertionError("本地模式不该查 has_user_sa")
    ))
    assert vertex_sa.vertex_selection_blocked(123) is None


def test_production_mode_with_sa_allows(monkeypatch):
    """生产鉴权模式 + 用户已上传 SA → 放行。"""
    monkeypatch.setattr("core.config.require_auth", lambda: True)
    monkeypatch.setattr(vertex_sa, "has_user_sa", lambda user_id, api_id="AgentPlatform": True)
    assert vertex_sa.vertex_selection_blocked(42) is None


def test_production_mode_without_sa_rejects(monkeypatch):
    """生产鉴权模式 + 用户未上传 SA → 拒绝,返回引导文案。"""
    monkeypatch.setattr("core.config.require_auth", lambda: True)
    monkeypatch.setattr(vertex_sa, "has_user_sa", lambda user_id, api_id="AgentPlatform": False)
    reason = vertex_sa.vertex_selection_blocked(7)
    assert reason is not None
    assert "Service Account" in reason
    assert "Agent Platform" in reason
