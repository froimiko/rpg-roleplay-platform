"""kb/world_scope.py — world_key 检索 scope(时间线战役批次3b-2)。

防跨副本串味:玩家在副本A(某段连续章节)时,语义 RAG 不应拉到副本B 的原著片段。
实现取向(最小风险):不新增 SQL 过滤子句,而是把玩家【当前世界】映射成一段连续
章节范围,与检索已有的 chapter_min/chapter_max 窗口【求交】—— 复用现成的章窗机制。

默认安全铁律:书没做世界切分(worldline_key 全 null,当前所有生产书)时,
resolve_world_bounds 返回 None → 调用方不 clamp → 检索行为逐字节不变(数学 no-op)。
只有书真有世界切分(3a 结构先验命中 或 3b-1 LLM 确认 --apply 后)才生效。
"""
from __future__ import annotations

from typing import Any


def resolve_world_bounds(db: Any, script_id: int, chapter: int) -> tuple[int, int] | None:
    """玩家当前进度章所属【世界】的连续章节范围 (ch_min, ch_max)。

    None 表示:书未做世界切分(该章 worldline_key 为 null),或查询失败 → 调用方不 clamp。

    连续段判定:取该章的 worldline_key,向前/向后扩展到 worldline_key 相同且连续的
    章节边界(以 chapter_facts.worldline_key 为准)。同一 worldline_key 的章节在
    回填时是连续段(3a/3b 都按段写),但为稳妥仍按「相同 key 的 min/max 连续块」算。
    """
    if not script_id or not chapter:
        return None
    try:
        row = db.execute(
            "select worldline_key from chapter_facts "
            "where script_id = %s and chapter = %s limit 1",
            (int(script_id), int(chapter)),
        ).fetchone()
    except Exception:
        return None
    if not row:
        return None
    wk = row.get("worldline_key") if isinstance(row, dict) else row[0]
    if wk is None or str(wk).strip() == "":
        return None  # 主世界/未切分 → 不 clamp
    try:
        # 向前:从 chapter 往小找,直到 worldline_key 变化或断裂。
        # 用一条查询取该 script 全部 (chapter, worldline_key),在内存里算含 chapter
        # 的连续同 key 块 —— chapter_facts 每书章数有限(百级),一次拉完最稳。
        rows = db.execute(
            "select chapter, worldline_key from chapter_facts "
            "where script_id = %s order by chapter asc",
            (int(script_id),),
        ).fetchall() or []
    except Exception:
        return None
    seq = []
    for r in rows:
        c = r.get("chapter") if isinstance(r, dict) else r[0]
        k = r.get("worldline_key") if isinstance(r, dict) else r[1]
        if c is not None:
            seq.append((int(c), (str(k) if k is not None else None)))
    if not seq:
        return None
    # 找含 chapter 的连续同-key 块
    target_key = None
    for c, k in seq:
        if c == int(chapter):
            target_key = k
            break
    if target_key is None:
        return None
    lo = hi = int(chapter)
    idx_by_ch = {c: i for i, (c, _) in enumerate(seq)}
    if int(chapter) not in idx_by_ch:
        return None
    i0 = idx_by_ch[int(chapter)]
    # 向前扩
    i = i0
    while i - 1 >= 0 and seq[i - 1][1] == target_key:
        i -= 1
    lo = seq[i][0]
    # 向后扩
    j = i0
    while j + 1 < len(seq) and seq[j + 1][1] == target_key:
        j += 1
    hi = seq[j][0]
    return (lo, hi)


def clamp_window_to_world(
    chapter_min: int | None,
    chapter_max: int | None,
    world_bounds: tuple[int, int] | None,
) -> tuple[int | None, int | None]:
    """把检索章窗 [chapter_min, chapter_max] 与世界边界求交(clamp)。

    world_bounds=None(未切分)→ 原样返回(no-op)。否则:
      new_min = max(chapter_min, world_lo)(chapter_min 为 None 时取 world_lo)
      new_max = min(chapter_max, world_hi)(chapter_max 为 None 时取 world_hi)
    若求交后 min > max(窗口与世界不相交,理论上不该发生因为 chapter 在世界内)→
    退回世界边界本身(保当前世界,绝不返回空窗口把 RAG 饿死)。
    """
    if world_bounds is None:
        return chapter_min, chapter_max
    wlo, whi = world_bounds
    new_min = wlo if chapter_min is None else max(int(chapter_min), wlo)
    new_max = whi if chapter_max is None else min(int(chapter_max), whi)
    if new_min > new_max:
        return wlo, whi
    return new_min, new_max
