"""platform_app.frontend_routes.cards —— CHARACTER CARDS 补充路由。

原单文件「CHARACTER CARDS supplements」段逐端点搬运,零行为变化:
/api/me/character-cards/import-json —— 从 JSON 导入角色卡(容忍 SillyTavern v1/v2 等形态)。
"""
from __future__ import annotations

import json

from fastapi import Request

from ..api import json_response, require_user
from ._shared import _bad, router


# ------------------------------------------------------------
#  CHARACTER CARDS supplements
# ------------------------------------------------------------
@router.post("/api/me/character-cards/import-json")
async def api_card_import_json(request: Request):
    user = require_user(request)
    body = await request.json() or {}
    raw = body.get("json") or ""
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
    except Exception as e:
        return _bad(f"JSON 解析失败：{e}")
    # Accept a variety of shapes (SillyTavern v1/v2 etc.)
    # 解包常见的外层包装（如 {"ok":true,"card":{...}}）
    if isinstance(data, dict) and not data.get("name") and not data.get("char_name"):
        for key in ("card", "character", "chara_card"):
            inner = data.get(key)
            if isinstance(inner, dict) and (inner.get("name") or inner.get("data", {}).get("name")):
                data = inner
                break
    name = data.get("name") or data.get("char_name") or ""
    if not name and isinstance(data.get("data"), dict):
        name = data["data"].get("name") or ""
    if not name:
        return _bad("缺少 name 字段")
    from .. import user_cards as _uc
    card = _uc.upsert_user_card(user["id"], {
        "name": name,
        "description": data.get("description") or data.get("personality") or "",
        "first_message": data.get("first_mes") or data.get("first_message") or "",
        "tags": data.get("tags") or [],
        "source": "import-json",
    })
    return json_response({"ok": True, "card": card})
