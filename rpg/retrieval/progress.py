"""retrieval.progress — 进度窗口族:active save / 剧情 phase 章节窗口解析。

拆包(纯机械搬家):自 rpg/retrieval.py 逐字搬来,函数体零改动。
DB 访问全为函数内局部 import(platform_app.db),无模块级外部依赖。
"""
from __future__ import annotations


# task 117: 算法层 phase 推导 — 不硬编码"第一章"/"火星"/"柏林"。
# 当 world.time 空 / state 干净时,从 save.active_phase_index + save_phase_digests
# 或 fallback 到 script 级 phase_digests 拿当前 phase 的 chapter_range,
# 让 BM25 / worldbook 检索被自动限制到正确的剧情阶段,而不是检索整本书。
# 通用于任意小说 — 只要剧本导入流程跑过 phase_digest 聚合 (task 85),就有数据。
def _resolve_active_phase_range(save_id: int | None, script_id: int | None) -> dict | None:
    """返回当前 phase 的 {chapter_min, chapter_max, phase_label, summary},
    或 None (DB 没数据时)。

    算法:
      1. 如果 save_id 给了 → 读 game_saves.active_phase_index
         - 如果该 index 在 save_phase_digests 有 row → 拿它的 phase_label 去
           script 级 phase_digests 查 chapter_min/max + summary
         - 否则继续到 step 2
      2. fallback: script 级 phase_digests 按 (chapter_min, chapter_max) ASC
         取第一个 → 这就是"剧本最早期的 phase"
    """
    if not script_id:
        return None
    try:
        from platform_app.db import connect as _conn
        from platform_app.db import init_db as _init
        _init()
        with _conn() as _db:
            active_phase_label = ""
            if save_id:
                _gs = _db.execute(
                    "select active_phase_index from game_saves where id = %s",
                    (save_id,),
                ).fetchone()
                if _gs and _gs.get("active_phase_index") is not None:
                    _spd = _db.execute(
                        "select phase_label from save_phase_digests "
                        "where save_id = %s and phase_index = %s limit 1",
                        (save_id, _gs["active_phase_index"]),
                    ).fetchone()
                    if _spd and _spd.get("phase_label"):
                        active_phase_label = _spd["phase_label"]
            # 优先精准匹配 active phase
            row = None
            if active_phase_label:
                row = _db.execute(
                    "select phase_label, chapter_min, chapter_max, summary "
                    "from phase_digests where script_id = %s and phase_label = %s "
                    "order by chapter_min asc limit 1",
                    (script_id, active_phase_label),
                ).fetchone()
            # fallback: 剧本最早期 phase (按 chapter_min asc, chapter_max asc)
            if not row:
                row = _db.execute(
                    "select phase_label, chapter_min, chapter_max, summary "
                    "from phase_digests where script_id = %s "
                    "and chapter_min is not null and chapter_max is not null "
                    "order by chapter_min asc, chapter_max asc limit 1",
                    (script_id,),
                ).fetchone()
            if row and row.get("chapter_min") and row.get("chapter_max"):
                return {
                    "chapter_min": int(row["chapter_min"]),
                    "chapter_max": int(row["chapter_max"]),
                    "phase_label": str(row.get("phase_label") or ""),
                    "summary": str(row.get("summary") or ""),
                }
    except Exception:
        pass
    return None


def _resolve_save_id_from_user(user_id: int | None) -> int | None:
    """从 user_id 拿 active save_id (runtime_checkouts)。"""
    if not user_id:
        return None
    try:
        from platform_app.db import connect as _conn
        from platform_app.db import init_db as _init
        _init()
        with _conn() as _db:
            r = _db.execute(
                "select save_id from runtime_checkouts where user_id = %s order by updated_at desc limit 1",
                (user_id,),
            ).fetchone()
            return int(r["save_id"]) if r and r.get("save_id") else None
    except Exception:
        return None
