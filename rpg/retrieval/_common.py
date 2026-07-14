"""retrieval._common — 拆包共享地基:日志通道 + 本地资源路径常量。

拆包说明(2026-07 纯机械搬家,零行为变化):原 rpg/retrieval.py 按职责分子包。
本文件比原 rpg/retrieval.py 深一层,故:
  · BASE 用 .parent.parent 让其仍指向 rpg/(原 Path(rpg/retrieval.py).parent==rpg/)。
  · log 通道名固定 "retrieval"(原 get_logger(__name__)==get_logger("retrieval")),
    保持所有日志行的 logger 名不变。
"""
from __future__ import annotations

from pathlib import Path

from core.logging import get_logger

log = get_logger("retrieval")

BASE     = Path(__file__).parent.parent
DB_PATH  = BASE.parent / ".webnovel" / "vectors.db"
FACT_DB  = BASE.parent / ".webnovel" / "chapter_facts.db"
CHAR_IDX = BASE / "indexes" / "characters.json"
WORLD_IDX= BASE / "indexes" / "world.json"
SUM_IDX  = BASE / "indexes" / "summaries.json"
