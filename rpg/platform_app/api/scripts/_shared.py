"""platform_app.api.scripts._shared —— 拆包共享的单一 router 实例。

各资源族子模块 `from ._shared import router` 后用 `@router.<verb>(...)` 注册端点;
`__init__.py` import 全部子模块触发装配,再把这同一个 router 暴露给
`platform_app.api`(`from .scripts import router`)。这样装配结果与拆分前的单文件
逐端点一致(共享同一 APIRouter 实例)。
"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()
