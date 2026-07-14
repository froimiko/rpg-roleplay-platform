"""platform_app.frontend_routes._shared —— 拆包共享的单一 router 实例 + 通用轻辅助。

各域子模块 `from ._shared import router[, _bad]` 后用 `@router.<verb>(...)` 注册端点;
`__init__.py` import 全部子模块触发装配,再把这同一个 router 暴露给
`platform_app`(`from .frontend_routes import router`)。这样装配结果与拆分前的单文件
逐端点一致(共享同一 APIRouter 实例)。

_bad / _client_ip 为原单文件顶部的通用辅助,被多个域子模块共用,故与 router 同居本模块
(单一真相源)。_client_ip 在原文件即无内部调用(历史遗留),原样保留,经 __init__ 门面
re-export 不变。
"""
from __future__ import annotations

from fastapi import APIRouter, Request

from ..api import json_response

router = APIRouter()

# 历史 SMS stub 已删除 (上线前清理 — 接入真实 SMS 网关需重新设计 OTP 流程)


# ------------------------------------------------------------
#  Helpers
# ------------------------------------------------------------
def _bad(msg: str, status: int = 400):
    return json_response({"ok": False, "error": msg}, status_code=status)


def _client_ip(request: Request) -> str:
    return (request.client.host if request.client else "") or ""
