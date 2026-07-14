"""platform_app.api.admin._shared —— 拆包共享的单一 router 实例 + 跨资源族 admin 辅助。

各资源族子模块 `from ._shared import router[, _require_admin, _write_audit, ...]` 后用
`@router.<verb>(...)` 注册端点;`__init__.py` import 全部子模块触发装配,再把这同一个
router 暴露给 `platform_app.api`(`from .admin import router`)。这样装配结果与拆分前的单
文件逐端点一致(共享同一 APIRouter 实例)。

log / _require_admin / _get_app_config / _set_app_config / _write_audit 被多个资源族子模块
共用,故与 router 同居本模块(单一真相源,避免跨子模块循环 import)。admin 角色门控收敛到
_deps.require_admin(唯一来源);保留 _require_admin 本名供 Depends(_require_admin) 旧引用。
"""
from __future__ import annotations

import logging

from fastapi import APIRouter
from psycopg.types.json import Jsonb

from .._deps import require_admin

router = APIRouter()
log = logging.getLogger(__name__)


# admin 角色门控收敛到 _deps.require_admin(唯一来源);保留本名供 Depends(_require_admin) 旧引用。
_require_admin = require_admin


def _get_app_config(db, key: str) -> dict:
    row = db.execute("select value from app_config where key = %s", (key,)).fetchone()
    if row and row.get("value"):
        v = row["value"]
        return v if isinstance(v, dict) else {}
    return {}


def _set_app_config(db, key: str, data: dict):
    existing = _get_app_config(db, key)
    merged = {**existing, **data}
    db.execute(
        """insert into app_config(key, value) values(%s, %s)
           on conflict(key) do update set value = excluded.value, updated_at = now()""",
        (key, Jsonb(merged)),
    )


def _write_audit(
    db,
    actor: dict,
    action: str,
    target_type: str = "",
    target_id: str = "",
    details: dict = None,
    ip: str = "",
):
    db.execute(
        """insert into admin_audit_log(actor_id, actor_username, action, target_type, target_id, details, ip)
           values(%s, %s, %s, %s, %s, %s, %s)""",
        (
            actor.get("id"),
            actor.get("username", ""),
            action,
            target_type,
            str(target_id),
            Jsonb(details or {}),
            ip,
        ),
    )
