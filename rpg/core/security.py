"""core.security — 安全相关 re-export 入口 (实际实现在 platform_app.auth)。"""
import hashlib


def hash_token(token: str) -> str:
    """token → sha256 hex(session token / PAT / device code 等 token 哈希单一真相源)。

    注意:只用于 token 哈希;密码哈希走 platform_app.security.hash_password,
    内容指纹哈希(带 [:16] 截断的那些)不走这里。
    """
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()


from platform_app.auth import (
    RateLimited,
    admin_unlock,
    get_user,
    login,
    logout,
    register,
    update_profile,
    user_from_token,
)

__all__ = [
    "RateLimited",
    "admin_unlock",
    "register",
    "login",
    "logout",
    "user_from_token",
    "get_user",
    "update_profile",
    "hash_token",
]
