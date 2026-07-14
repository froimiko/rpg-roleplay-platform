"""platform_app.api.scripts —— /api/scripts*、/api/uploads/* 路由(包化)。

原单文件(1728 行)按资源族拆为子包;本 __init__ 是薄门面:import 全部子模块触发
装配(各子模块 `from ._shared import router` 后用 `@router.<verb>` 注册,共享同一
APIRouter 实例),再逐名 re-export 原模块的全部公开名(含 router / 全部 api_* 端点 /
下划线辅助与常量),让 `from platform_app.api.scripts import router` 与既有引用零改动。

── 2026-07-14 拆包说明(纯机械搬家,零行为变化)────────────────────────────
_shared.py         — 共享的单一 router 实例
listing.py         — 列表 + 状态/元数据只读(scripts/modules-status/embed-status/
                     chapter-facts/timeline/birthpoints/recommend-identity)
chapters.py        — 章节 CRUD + 结构操作(列表/详情/编辑/blank/add/merge/delete/split/resplit)
cards.py           — NPC 角色卡族 + audit-cards
worldbook_canon.py — 世界书 + canon 实体只读(含 _CANON_LIST_COLS)
media.py           — 封面 + NPC 头像上传(含 _MAX_COVER_BYTES/_detect_cover_mime/_require_script_owner)
imports.py         — 导入触发 + 分片上传 + pack(含 _ALLOWED_SCRIPT_EXTS/_check_script_ext/_safe_zip_read)
library.py         — 生命周期(unsubscribe/delete/rename)+ 在线公开库(visibility/public/clone/fork)
overrides.py       — 剧本 overrides + 剧本级 GM 风格
review.py          — Phase E 可视化复核(graph/patch canon/mark-reviewed,含 _owned_script)
"""
from __future__ import annotations

# 原顶层 import 的名字(测试/调用方可能以 module.X 形式引用)——保持可见
import secrets
from typing import Any

from ... import knowledge, script_import
from ...db import connect
from ...perms import script_owned
from .._deps import json_response, require_user
from ._shared import router
from .cards import (
    api_audit_character_cards,
    api_script_card_enabled,
    api_script_card_protagonist,
    api_script_character_card,
    api_script_character_cards,
    api_script_delete_character_card,
    api_script_upsert_character_card,
)
from .chapters import (
    api_add_chapter,
    api_chapter_detail,
    api_chapter_merge,
    api_chapter_split,
    api_chapter_update,
    api_chapters_delete,
    api_create_blank_script,
    api_script_chapters,
    api_script_resplit,
)
from .imports import (
    _ALLOWED_SCRIPT_EXTS,
    _check_script_ext,
    _safe_zip_read,
    api_export_script_pack,
    api_import_script,
    api_import_script_pack,
    api_script_preview,
    api_scripts_batch_import,
    api_upload_cancel,
    api_upload_chunk,
    api_upload_finish,
    api_upload_init,
)
from .library import (
    api_clone_public_script,
    api_fork_public_script,
    api_public_script_detail,
    api_public_scripts,
    api_script_delete,
    api_script_rename,
    api_script_unsubscribe,
    api_script_visibility,
)
from .listing import (
    api_script_birthpoints,
    api_script_chapter_facts,
    api_script_embed_status,
    api_script_modules_status,
    api_script_recommend_identity,
    api_script_timeline,
    api_scripts,
)
from .media import (
    _MAX_COVER_BYTES,
    _detect_cover_mime,
    _require_script_owner,
    api_set_npc_card_avatar_url,
    api_set_script_cover_url,
    api_upload_npc_card_avatar,
    api_upload_script_cover,
)
from .overrides import (
    api_get_script_gm_style,
    api_get_script_overrides,
    api_set_script_gm_style,
    api_update_script_overrides,
)
from .review import (
    _owned_script,
    api_patch_canon,
    api_script_graph,
    api_script_mark_reviewed,
    api_script_unmark_reviewed,
)
from .worldbook_canon import (
    _CANON_LIST_COLS,
    api_script_canon_entities,
    api_script_canon_entity,
    api_script_worldbook,
)

__all__ = ["router"]
