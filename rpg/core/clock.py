"""core.clock — 时间戳权威缝(单一真源)。

散落各处的内联 ``datetime.now().isoformat(timespec="seconds")`` 统一走 ``now_iso()``。
本地时间(非 UTC)、秒级 ISO 8601,行为逐字节保持。
"""
from __future__ import annotations

from datetime import datetime


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")
