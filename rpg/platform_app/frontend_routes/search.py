"""platform_app.frontend_routes.search —— 跨资源搜索 + 插件/技能便捷列表。

原单文件「SEARCH」段与相邻「Plugins / Skills lists」段逐端点搬运,零行为变化:
/api/search(scripts/saves/cards/worldbook/memories/npc_cards 分组)/
/api/plugins / /api/skills(复用 tool_payload 的前端便捷列表)。
"""
from __future__ import annotations

from fastapi import Request

from ..api import json_response, require_user
from ..db import connect, init_db
from ._shared import router

# ------------------------------------------------------------
#  SEARCH
# ------------------------------------------------------------
# 合法 scope 值。"all" 表示不过滤。
_SEARCH_SCOPES = frozenset({"all", "scripts", "saves", "cards", "worldbook", "memories", "npc_cards"})


@router.get("/api/search")
async def api_search(request: Request):
    """Cross-resource search. Returns grouped results per resource kind.

    Query params:
      q      — search term (required, min 1 char after strip)
      scope  — one of: all (default) | scripts | saves | cards |
               worldbook | memories | npc_cards
               Restricts the search to that group only.

    Response shape:
      {
        "ok": true,
        "query": "<q>",
        "scope": "<scope>",
        "groups": [
          {
            "kind": "scripts" | "saves" | "cards" | "worldbook" | "memories" | "npc_cards",
            "items": [
              {
                "id": <int>,
                "label": "<primary text>",
                "sub": "<secondary text, may be absent>",
                "href": "<deep-link, may be absent>"
              },
              ...
            ]
          },
          ...
        ]
      }

    Performance note (worldbook / memories):
      ILIKE '%q%' scans are used here because gin_trgm_ops indexes are not
      yet applied to worldbook_entries / memories.
      # TODO: 待 migrations.py 解锁后加 gin_trgm_ops 索引到
      #        worldbook_entries(title, content) 和 memories(content)
    """
    user = require_user(request)
    q = (request.query_params.get("q") or "").strip()
    if not q:
        return json_response({"ok": True, "query": "", "scope": "all", "groups": []})

    raw_scope = (request.query_params.get("scope") or "all").strip().lower()
    scope = raw_scope if raw_scope in _SEARCH_SCOPES else "all"

    pattern = f"%{q}%"
    init_db()
    groups = []

    def _want(kind: str) -> bool:
        return scope == "all" or scope == kind

    with connect() as db:
        # --- scripts ---
        if _want("scripts"):
            scripts = db.execute(
                "select id, title, description from scripts "
                "where owner_id = %s and title ilike %s limit 8",
                (user["id"], pattern),
            ).fetchall()
            if scripts:
                groups.append({"kind": "scripts", "items": [
                    {"id": r["id"], "label": r["title"], "sub": r["description"],
                     "href": "/scripts"}
                    for r in scripts
                ]})

        # --- saves ---
        if _want("saves"):
            saves = db.execute(
                "select id, title from game_saves where user_id = %s and title ilike %s limit 8",
                (user["id"], pattern),
            ).fetchall()
            if saves:
                groups.append({"kind": "saves", "items": [
                    {"id": r["id"], "label": r["title"], "href": "/saves"}
                    for r in saves
                ]})

        # --- cards (PC + persona, owned by user) ---
        if _want("cards"):
            try:
                # v28: character_cards 多态后 owner_user_id 列已不存在(改名 user_id);
                # 全局搜索仅搜自己的 PC 卡 + persona(NPC 卡按 script_id 隔离,不属于"我的"维度)。
                cards = db.execute(
                    "select id, name from character_cards "
                    "where user_id = %s and card_type in ('pc','persona') and name ilike %s limit 8",
                    (user["id"], pattern),
                ).fetchall()
                if cards:
                    groups.append({"kind": "cards", "items": [
                        {"id": r["id"], "label": r["name"], "href": "/cards"}
                        for r in cards
                    ]})
            except Exception:
                pass

        # --- worldbook (entries belonging to user's scripts) ---
        if _want("worldbook"):
            try:
                # Join via scripts to restrict to entries the user owns.
                # TODO: 待 migrations.py 解锁后加 gin_trgm_ops 索引到 worldbook_entries(title, content)
                wb_rows = db.execute(
                    """
                    select we.id, we.title, left(we.content, 120) as snippet, we.script_id
                    from worldbook_entries we
                    join scripts s on s.id = we.script_id
                    where s.owner_id = %s
                      and (we.title ilike %s or we.content ilike %s)
                    order by we.priority desc
                    limit 8
                    """,
                    (user["id"], pattern, pattern),
                ).fetchall()
                if wb_rows:
                    groups.append({"kind": "worldbook", "items": [
                        {
                            "id": r["id"],
                            "label": r["title"],
                            "sub": r["snippet"],
                            "href": f"/scripts?script={r['script_id']}",
                        }
                        for r in wb_rows
                    ]})
            except Exception:
                pass

        # --- memories (rows in `memories` table owned by user) ---
        if _want("memories"):
            try:
                # TODO: 待 migrations.py 解锁后加 gin_trgm_ops 索引到 memories(content)
                mem_rows = db.execute(
                    """
                    select id, bucket, left(content, 120) as snippet
                    from memories
                    where user_id = %s and content ilike %s
                    order by importance desc, updated_at desc
                    limit 8
                    """,
                    (user["id"], pattern),
                ).fetchall()
                if mem_rows:
                    groups.append({"kind": "memories", "items": [
                        {
                            "id": r["id"],
                            "label": r["bucket"],
                            "sub": r["snippet"],
                        }
                        for r in mem_rows
                    ]})
            except Exception:
                pass

        # --- npc_cards (NPC cards within user's scripts) ---
        if _want("npc_cards"):
            try:
                # character_cards has no 'bio' column; use identity + personality as searchable text.
                npc_rows = db.execute(
                    """
                    select cc.id, cc.name,
                           left(coalesce(nullif(cc.identity,''), cc.personality, ''), 120) as snippet,
                           cc.script_id
                    from character_cards cc
                    join scripts s on s.id = cc.script_id
                    where s.owner_id = %s
                      and cc.card_type = 'npc'
                      and (cc.name ilike %s or cc.identity ilike %s or cc.personality ilike %s)
                    limit 8
                    """,
                    (user["id"], pattern, pattern, pattern),
                ).fetchall()
                if npc_rows:
                    groups.append({"kind": "npc_cards", "items": [
                        {
                            "id": r["id"],
                            "label": r["name"],
                            "sub": r["snippet"],
                            "href": f"/cards?script={r['script_id']}",
                        }
                        for r in npc_rows
                    ]})
            except Exception:
                pass

    return json_response({"ok": True, "query": q, "scope": scope, "groups": groups})


# ------------------------------------------------------------
#  Plugins / Skills lists (frontend convenience)
# ------------------------------------------------------------
@router.get("/api/plugins")
async def api_plugins(request: Request):
    """Reuse /api/tools but slice the 'plugins' channel for the CapPage."""
    from tools_dsl.tool_registry import tool_payload
    payload = tool_payload()
    return json_response({"ok": True, "plugins": payload.get("plugins", [])})


@router.get("/api/skills")
async def api_skills_list(request: Request):
    require_user(request)
    from tools_dsl.tool_registry import tool_payload
    payload = tool_payload()
    return json_response({"ok": True, "skills": payload.get("skills", [])})
