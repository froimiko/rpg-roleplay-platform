"""core.text — 文本工具权威缝(单一真源)。

抽出前散落多处、行为一致的两个纯文本工具,统一到中立缝以便复用与寻根:

- ``slugify``:URL / 目录 / 文件名安全化(保留中文,其余非字母数字折叠成 ``-``)。
  蓝本 = ``tools_dsl.tool_registry._slugify`` / ``platform_app.knowledge._utils._slugify``
  (两者字符集等价:``\\u4e00-\\u9fff`` escape 与 ``一-鿿`` 字面量区间同集),``fallback`` 参数化。
- ``normalize_for_fp``:指纹归一化(去掉全部标点 / 空白,只留文字数字)。
  蓝本 = ``state.consequence_ledger._normalize_for_fp`` / ``agents.world_heartbeat._normalize_for_fp``。

本模块只依赖标准库 ``re``,不反向依赖任何业务模块——是中立缝而非柱子,
承诺账本(consequence_ledger)与世界心跳(world_heartbeat)共同依赖它并不破坏
「两柱互不读写」的架构隔离。行为逐字节保持。
"""
from __future__ import annotations

import re


def slugify(text: str, *, fallback: str = "item") -> str:
    slug = re.sub(r"[^0-9A-Za-z_\-一-鿿]+", "-", text.strip()).strip("-").lower()
    return slug or fallback


_FP_STRIP_RE = None  # 惰性编译


def normalize_for_fp(text: str) -> str:
    """指纹归一化:去掉全部标点/空白,只留文字数字。

    生产实测:重提取同一措辞会漂(全角/半角标点、破折号增删),精确匹配挡不住;
    归一化吃掉标点差异。
    """
    global _FP_STRIP_RE
    if _FP_STRIP_RE is None:
        _FP_STRIP_RE = re.compile(r"[\W_]+", re.UNICODE)
    return _FP_STRIP_RE.sub("", text or "")
