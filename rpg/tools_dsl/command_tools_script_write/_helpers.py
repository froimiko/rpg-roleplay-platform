"""command_tools_script_write 子包共享层(拆包 2026-07-14,纯机械搬家零行为变化)。

各职责子模块共用的 origin 常量 + sid 解析 + 读权限 + strlist。子模块循环依赖统一走本模块。
两个 origin 是 frozenset 常量(无 mutable 全局)。
"""
from __future__ import annotations

from typing import Any

# 读工具的 origin:照搬现有 script 读工具(get_script_chapters 等)的 _READ_ANY_ORIGIN。
# console_assistant(MD 编辑器右栏 agent)是 user-driven,所有读工具都对它开放。
_SCRIPT_READ_ORIGINS = frozenset({
    "ui_button", "api_direct", "llm_set", "llm_chat", "mcp_call", "console_assistant",
})

# 写工具的 origin:UI 按钮 / 直连 API / 侧栏控制台助手(MD 编辑器右栏 agent)。
# 不含 llm_chat / llm_chat_json_op / autonomous_agent —— 剧情流式输出和黑天鹅代理不该直写剧本库。
_SCRIPT_WRITE_ORIGINS = frozenset({"ui_button", "api_direct", "console_assistant"})


def _resolve_sid(script_id: int | None, args: dict) -> int | None:
    """sid = script_id(服务端绑定,首选) or args.get("script_id")。返回 int 或 None。"""
    sid = script_id if script_id is not None else args.get("script_id")
    if sid is None:
        return None
    try:
        return int(sid)
    except (TypeError, ValueError):
        return None


def _user_can_read_script(db, sid: int, user_id: int) -> bool:
    """剧本读权限:owner 或订阅者(照搬 command_tools_queries._user_can_read_script)。
    读工具用这个,**不是** script_owned 写闸 —— 订阅者本就有读权。"""
    return db.execute(
        "select 1 from scripts s where s.id = %s and ("
        "  s.owner_id = %s or s.id in (select script_id from user_script_subscriptions where user_id = %s))",
        (int(sid), user_id, user_id),
    ).fetchone() is not None


def _strlist(v: Any) -> list[str]:
    return [str(x) for x in v] if isinstance(v, list) else []


