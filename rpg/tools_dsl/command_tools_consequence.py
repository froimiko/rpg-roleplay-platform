"""
command_tools_consequence.py — 后果账本 v1 dispatcher 工具。

设计文档: docs/design/consequence_ledger_v1.md

一个工具:
  schedule_consequence(text, due_turns=None, due_location=None)
    scope=save, destructive=false
    登记一条待兑现的后果到 state.data["consequence_ledger"]（纯内存/存档态,
    不落独立 DB 表 —— 随 save 一起持久化,复用既有 save 写入路径）。
    GM function-calling 与 recorder ops 都能调（结构化 JSON op 走
    apply_structured_updates 的 "consequence" 分支，二者殊途同归，都调
    GameState.register_consequence）。

设计原则: 触发/扫描/注入全部确定性（见 state/consequence_ledger.py +
context_providers/consequence_echo.py），本工具只负责"登记"这一步。
"""
from __future__ import annotations

from typing import Any

from tools_dsl.command_dispatcher import ToolSpec, get_registry

# non-destructive：仅追加登记，不修改/删除既有数据。允许 LLM 裸调（同 worldbook_add）。
_SCHEDULE_ORIGINS = frozenset({
    "ui_button", "api_direct", "llm_set", "llm_chat", "llm_chat_json_op", "console_assistant",
})


def _t_schedule_consequence(state: Any, args: dict) -> str:
    """登记一条待兑现的后果（GM function-calling 通道）。"""
    text = (args.get("text") or "").strip()
    if not text:
        return "失败: text 不能为空"

    due_turns = args.get("due_turns")
    if due_turns is not None:
        try:
            due_turns = int(due_turns)
        except (TypeError, ValueError):
            return "失败: due_turns 必须是整数"

    due_location = args.get("due_location")
    if due_location is not None:
        due_location = str(due_location).strip() or None

    # 权限闸门(孪生洞补齐):apply_structured_updates 的 JSON-op "consequence" 分支已并入
    # pending 闸,本工具面是同名 state 方法的孪生直写路径,同样须闸。GM 自主写后果账本
    # (consequence_echo provider 注入 GM 上下文,有真实叙事影响)在 read_only/default 下
    # 不直写、经 add_pending_narrative_op 入 pending(与 JSON-op 路径同构,同一 approve 路径
    # 回放);full_access/auto_review 直写不变。玩家主动 origin(ui_button/llm_set/api_direct
    # = UI 按钮 / /set 命令 / 直接 API)属玩家意志,豁免直写。_origin 由 dispatcher 无条件
    # 注入(env.args["_origin"]=env.origin),不可被 LLM 伪造;user_intent 判定对照本域
    # command_tools._set_player_profile_field 的现行读法。
    origin = str(args.get("_origin") or "")
    user_intent = origin in ("ui_button", "llm_set", "api_direct")
    if not user_intent and state._gm_narrative_needs_pending():
        return state.add_pending_narrative_op(
            "consequence",
            {"text": text, "due_turns": due_turns, "due_location": due_location},
            source="gm:tool",
            display=f"后果登记：{text[:40]}",
        )

    ok, msg = state.register_consequence(
        text=text,
        due_turns=due_turns,
        due_location=due_location,
        origin="gm",
    )
    if ok:
        return f"已登记后果: {msg}"
    return f"失败: {msg}"


def register_consequence_tools() -> None:
    """注册后果账本工具到全局 registry。幂等。"""
    registry = get_registry()

    if not registry.has("schedule_consequence"):
        registry.register(ToolSpec(
            name="schedule_consequence",
            description=(
                "登记一条待兑现的后果（承诺/欠债/约定），到期或抵达指定地点时会被"
                "系统自动提醒 GM 在剧情中让它自然兑现。\n"
                "due_turns 和 due_location 至少填一个：due_turns 是相对当前回合数的"
                "回合数（如 5 表示 5 回合后到期）；due_location 是地点名（玩家抵达"
                "含该地点子串的位置时触发）。\n"
                "pending 条目上限 20 条，超出会被拒绝；同文本+同期限重复登记会被忽略。"
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "后果描述（如：答应雷纳德查清林中兽伤,明天中午前带证据回村）",
                    },
                    "due_turns": {
                        "type": "integer",
                        "description": "相对当前回合数的到期回合数（正整数，可选，与 due_location 至少填一个）",
                    },
                    "due_location": {
                        "type": "string",
                        "description": "触发地点（玩家当前位置含此子串时触发，可选，与 due_turns 至少填一个）",
                    },
                },
                "required": ["text"],
            },
            executor=_t_schedule_consequence,
            scope="save",
            origins=_SCHEDULE_ORIGINS,
            destructive=False,
        ))


__all__ = ["register_consequence_tools"]
