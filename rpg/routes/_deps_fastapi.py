"""routes._deps_fastapi — FastAPI Depends() dependency functions for routes/."""
from __future__ import annotations

from typing import Any

from fastapi import Request


def get_current_user(request: Request) -> dict[str, Any] | None:
    """返回当前 api_user (本地模式可能返回 None)。"""
    from app import _require_api_user
    return _require_api_user(request)


def get_current_admin(request: Request) -> dict[str, Any] | None:
    """返回当前 api_user，要求 admin 权限。"""
    from app import _require_api_user
    return _require_api_user(request, admin=True)


def get_current_admin_strict(request: Request) -> dict[str, Any] | None:
    """SEC(C-1): 严格 admin —— self-hosted/local 模式也强制 admin,不走免登录短路。

    用于 MCP 注册/启动等「= 以服务进程身份执行代码」的高危端点,防本地端口被探测出 RCE。
    """
    from app import _require_api_user
    return _require_api_user(request, admin=True, strict_admin=True)


def get_payload_fn(request: Request):
    """返回 _payload 函数 (闭包了当前 user)。"""
    from app import _payload
    return _payload


def _uid_or_zero(api_user: dict[str, Any] | None) -> int:
    """从 api_user 取用户 id;缺用户 / 缺 id 一律回退 0(绝不抛异常）。

    这是 regex_scripts / worldbook_overlay 共用的「0 兜底」变体。**语义差异——别误抄**:
    - persona_skills.py 的 _uid → int | None:缺失时返回 None(用 None 作哨兵,后续显式判 None),
      与本函数的「0 兜底」不可互换(0 会被当成合法但越权的 uid=0)。
    - tavern.py 的 _uid → int:直接 int(api_user["id"]),不做兜底,缺失即 KeyError/TypeError
      (调用点已保证 api_user 非空且必带 id)。
    三者行为在「用户缺失」这一分叉上互不等价,合并前务必确认调用点契约一致。
    """
    return int(api_user.get("id")) if api_user and api_user.get("id") else 0
