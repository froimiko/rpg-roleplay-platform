"""core.channel_fallback — 跨渠道 fallback 候选解析(docs/design/channel_fallback_v0.md)。

严格 BYOK:候选只来自该用户自己已配的凭据渠道,绝不引入平台代付。
确定性:偏好优先(gm.fallback_api_id)→ 凭据顺序;跳过 degraded(v1.44.0 健康门控
信号)与解析不出可用模型的渠道。任何失败返回 None(调用方回落原错误路径)。
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def resolve_fallback_channel(user_id, exclude_api_id) -> tuple[str, str] | None:
    """返回 (api_id, model) 或 None。

    候选 = 用户已配凭据(enabled 且有 key)且 != exclude_api_id 的渠道;
    排序 = 用户偏好 gm.fallback_api_id 优先,其余按凭据列表顺序;
    逐个过滤 degraded(model_probe.is_channel_degraded)后用 first_user_model
    (与既有模型解析链同源:尊重用户 GM 偏好、避开 catalog 首位过期模型)解析模型。
    """
    if not user_id:
        return None
    try:
        from model_registry import normalize_api_id
        from platform_app.user_credentials import list_credentials

        exclude = normalize_api_id(str(exclude_api_id or ""))
        res = list_credentials(int(user_id)) or {}
        items = [
            i for i in (res.get("items") or [])
            if i.get("has_credential") and i.get("enabled")
        ]
        cand_ids = [
            i["api_id"] for i in items
            if i.get("api_id") and normalize_api_id(i["api_id"]) != exclude
        ]
        if not cand_ids:
            return None

        pref = ""
        try:
            from core.request_cache import get_user_prefs_cached
            pref = normalize_api_id(str(
                get_user_prefs_cached(int(user_id)).get("gm.fallback_api_id") or ""
            ))
        except Exception:
            pref = ""
        ordered = ([pref] if pref in cand_ids else []) + [c for c in cand_ids if c != pref]

        from core.llm_backend import first_user_model
        for api_id in ordered:
            try:
                import model_probe
                if model_probe.is_channel_degraded(api_id):
                    log.info("[channel_fallback] 跳过 degraded 渠道 %s", api_id)
                    continue
            except Exception:
                pass  # 健康信号不可用不挡路
            try:
                got = first_user_model(int(user_id), api_id=api_id)
            except Exception:
                got = None
            if got and got[1]:
                return (normalize_api_id(got[0]), str(got[1]))
        return None
    except Exception as exc:
        log.debug("[channel_fallback] 候选解析失败: %s", exc)
        return None
