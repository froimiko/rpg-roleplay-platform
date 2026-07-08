"""存量回填:演过未验收的锚点清账(确定性签名匹配,零 LLM)。

268 实锤:验收器 1300+ 回合零标记,窗口内锚点滞留 pending 反复注入反复重演。
本脚本拿存档【全部 GM 历史正文】(权威源=活跃 commit state_snapshot blob 的 history,
kb_native/旧档皆有)重放签名匹配器,把「正文确凿演过」的 pending 结算为 variant。

纪律:
- 只动锚点 status(variant/占位描述),【绝不】调 advance_progress(进度信号族不碰);
- 窗口=[1, progress_chapter+12](只清玩家实际玩到过的地带,远章 pending 不看);
- 默认 dry-run 打印命中证据;--apply 才写库。

用法: python scripts/backfill_anchor_acceptance.py --save 268 [--apply]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from gm_serving.anchor_signature import match_anchor_in_text  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--save", type=int, required=True)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--lookahead", type=int, default=12)
    args = ap.parse_args()

    from platform_app.db import connect, init_db
    init_db()
    with connect() as db:
        prow = db.execute(
            "select worldline->>'progress_chapter' pc from game_sessions where save_id=%s",
            (args.save,)).fetchone()
        progress = max(1, int((prow or {}).get("pc") or 1))
        ch_max = progress + max(0, args.lookahead)

        # 权威历史源:活跃 commit 的 state_snapshot blob(经 hydrate,尊重裁剪档)。
        srow = db.execute("select active_commit_id from game_saves where id=%s",
                          (args.save,)).fetchone()
        cid = int((srow or {}).get("active_commit_id") or 0)
        crow = db.execute("select * from branch_commits where id=%s and save_id=%s",
                          (cid, args.save)).fetchone()
        if not crow:
            print(f"save {args.save}: 无活跃 commit,退出")
            return
        from platform_app.branches.history_elide import hydrate_commit_state
        snap = hydrate_commit_state(db, args.save, dict(crow))
        hist = (snap or {}).get("history") or []
        gm_text = "\n".join(str(h.get("content") or "") for h in hist
                            if (h.get("role") == "assistant"))
        print(f"save {args.save}: progress={progress} 窗口=[1,{ch_max}] "
              f"历史条数={len(hist)} GM正文={len(gm_text)}字")

        pend = db.execute(
            """select anchor_key, source_chapter, summary from save_anchor_states
               where save_id=%s and status='pending' and source_chapter between 1 and %s
               order by source_chapter""",
            (args.save, ch_max)).fetchall()
        print(f"窗口内 pending: {len(pend)}")

        hits = []
        for a in pend:
            m = match_anchor_in_text(str(a.get("summary") or ""), gm_text)
            if m["hit"]:
                hits.append((a, m))
        print(f"签名匹配命中: {len(hits)}")
        for a, m in hits:
            print(f"  [{a['anchor_key']}] ch{a['source_chapter']} "
                  f"hits={m['hits']}/{m['total']} 证据={m['matched'][:3]}")

        if not args.apply:
            print("\n(dry-run,未写库。加 --apply 执行)")
            return
        n = 0
        for a, m in hits:
            r = db.execute(
                """update save_anchor_states set status='variant',
                     variant_description=%s, drift_score=0.25, updated_at=now()
                   where save_id=%s and anchor_key=%s and status='pending'
                   returning id""",
                (f"存量回填:确定性签名匹配(演过未验收清账,证据 {m['hits']}/{m['total']})",
                 args.save, a["anchor_key"])).fetchone()
            if r:
                n += 1
        db.commit()
        print(f"已结算 {n} 个锚点为 variant(未动进度信号)")


if __name__ == "__main__":
    main()
