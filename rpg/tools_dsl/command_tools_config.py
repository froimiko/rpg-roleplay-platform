"""command_tools_config.py — 对话内「模型/Key 配置引导」工具。

让 GM(角色扮演引擎)在对话中**检测到用户缺某类模型配置**(生图 / 向量 RAG / 对话)
或缺 API Key 时,主动弹一张配置引导卡(config_card pending_question),引导用户去配置。

复用点(全部已验证):
  · 配置卡写入器  tools_dsl.command_tools_image.append_config_card —— 与 ask_player_choice
    同写 state.data["permissions"]["pending_questions"],随回合 done/status state 下发前端,
    无需任何额外传输改动。
  · user_id 解析  tools_dsl.command_tools_tavern._resolve_user_id —— save 级 executor 只拿
    (state, args),从 dispatcher 无条件注入的 args["save_id"] 反查 game_saves.user_id,
    数据隔离恒为当前已鉴权用户(LLM 改不了)。
  · 偏好/凭证检测  core.llm_backend.resolve_preferred_model / first_user_model。

铁律:**不要投机性调用**。只有真实缺配置、且确实挡住了用户当前意图(想生图却没生图模型、
想用 RAG 检索却没 embedding、想对话却没对话模型/Key)时才调。
若该类模型其实已配置 → executor 返回「已配置,无需引导」且**不写卡**(避免假卡)。
"""
from __future__ import annotations

from typing import Any

from core.logging import get_logger

log = get_logger(__name__)

# capability → (偏好键命名空间, 中文名)。与全平台偏好键对齐:
#   image     → image_gen.model_real_name / image_gen.api_id
#   embedding → embed.model_real_name      / embed.api_id
#   llm       → gm.model_real_name(对话/GM 模型,first_user_model 内部已优先它)
_CAP_LABEL = {
    "image": "生图",
    "embedding": "向量 RAG",
    "llm": "对话",
}


def _execute_request_user_config(state: Any, args: dict) -> str:
    """检测当前用户某类模型配置,真缺才弹配置卡。

    返回面向用户的简短确认文案;若其实已配置则返回说明字符串且不写卡。
    """
    from tools_dsl.command_tools_image import append_config_card
    from tools_dsl.command_tools_tavern import _resolve_user_id

    capability = str(args.get("capability") or "").strip()
    if capability not in _CAP_LABEL:
        return "失败: capability 必须是 image / embedding / llm 之一"

    user_id = _resolve_user_id(state, args)
    if user_id is None:
        return "失败: 无法解析当前用户(save_id 缺失)"

    from core.llm_backend import first_user_model, resolve_preferred_model

    label = _CAP_LABEL[capability]

    # capability → 偏好键(检测「是否已设默认模型」)
    pref_key = {
        "image": "image_gen.model_real_name",
        "embedding": "embed.model_real_name",
        "llm": "gm.model_real_name",
    }[capability]

    # 1) 已设默认模型 → 已配置,不写卡(避免假卡)
    if resolve_preferred_model(user_id, pref_key) is not None:
        return f"用户该类模型({label})其实已配置,无需引导"

    # 2) 未设默认,但有可用凭证 → 识别到默认模型,弹「询问用默认」卡
    default = first_user_model(user_id)
    if default:
        _api, _model = default
        append_config_card(
            state,
            capability=capability,
            mode="ask_default",
            model=_model,
            api_id=_api,
            hard=False,
            question=f"你还没设默认{label}模型,用识别到的「{_model}」吗?",
            options=[f"用 {_model}", "去模型设置"],
        )
        return f"已弹出{label}模型配置引导(识别到可用模型「{_model}」,询问是否设为默认)。"

    # 3) 完全没凭证 → 缺 Key 引导卡
    append_config_card(
        state,
        capability=capability,
        mode="missing_key",
        hard=False,
        question=f"你还没配置{label}模型的 API Key,去配置一下就能用了。",
    )
    return f"已弹出{label}模型配置引导(检测到缺少 API Key)。"


# ── ToolSpec 工厂 ─────────────────────────────────────────────────────────

def _make_request_user_config_spec():
    from tools_dsl.command_dispatcher import ToolSpec

    return ToolSpec(
        name="request_user_config",
        description=(
            "当你检测到用户缺少完成其当前意图所需的某类模型配置(生图 / 向量 RAG / 对话)"
            "或缺少对应 API Key 时,调用它在对话里弹一张配置引导卡,引导用户去配置。"
            "\ncapability: image=生图模型, embedding=向量检索(RAG)模型, llm=对话模型。"
            "\n**不要投机性调用**:只有真实缺配置、且确实挡住了用户当前需求时才调。"
            "若用户其实已配置,工具会返回「已配置,无需引导」且不弹卡。"
        ),
        input_schema={
            "type": "object",
            "properties": {
                "capability": {
                    "type": "string",
                    "enum": ["image", "embedding", "llm"],
                    "description": "缺配置的模型类型:image=生图, embedding=向量RAG, llm=对话",
                },
                "reason": {
                    "type": "string",
                    "description": "可选:为什么判断需要引导(便于审计,不影响行为)",
                },
            },
            "required": ["capability"],
        },
        executor=_execute_request_user_config,
        scope="save",
        # 只允许 LLM 在自由叙事流里检测到缺配置时调用。
        origins=frozenset({"llm_chat"}),
        destructive=False,
        intent_keywords=("配置模型", "缺Key", "没配生图", "配置引导"),
        side_effect_topics=(),
        input_examples=(
            {"capability": "image", "reason": "用户想生图但没配生图模型"},
            {"capability": "embedding", "reason": "需要 RAG 检索但未配 embedding"},
        ),
    )


# ── 注册入口 ──────────────────────────────────────────────────────────────

def register_config_tools() -> None:
    """注册 request_user_config 工具到全局 registry。幂等。"""
    from tools_dsl.command_dispatcher import get_registry
    registry = get_registry()
    spec = _make_request_user_config_spec()
    if not registry.has(spec.name):
        registry.register(spec)
        log.info("[command_tools_config] registered tool: %s", spec.name)
