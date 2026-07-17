"""Fix 2 行为验证(live DB,无 DB 则跳过):acceptance 换稿后,该回合首稿抽取的 kb_events 被退役,
不再被情景召回(episodic 扁平语料)与 _newest_visible(recall / materialize)命中。

与 test_kb_live_repo.py 同风格。验退役=就地置 retired_at_commit,让两类查询双双排除。
"""
from __future__ import annotations

import pytest


def _db_or_skip():
    try:
        from platform_app.db import connect, init_db
        init_db()
        return connect
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"无 DB,跳过 acceptance retire 测试: {exc}")


def _seed_kb_save(db):
    """kb_native 存档 + 单链 commit(root→c1,turn_index=5),active=c1。返回 (save_id, c1)。"""
    uid = db.execute("select id from users order by id limit 1").fetchone()
    sid = db.execute("select id from scripts order by id limit 1").fetchone()
    if not uid or not sid:
        pytest.skip("DB 无 user/script 种子")
    save_id = db.execute(
        "insert into game_saves(user_id,script_id,title,state_path,kb_native) "
        "values (%s,%s,%s,%s,true) returning id",
        (uid["id"], sid["id"], "retire-pytest", "/tmp/retire_pytest.json"),
    ).fetchone()["id"]

    def mk(parent, tag, turn):
        return db.execute(
            "insert into branch_commits(save_id,parent_id,object_hash,tree_hash,turn_index,kind,title) "
            "values (%s,%s,%s,%s,%s,%s,%s) returning id",
            (save_id, parent, "h_" + tag, "t_" + tag, turn, "round", tag),
        ).fetchone()["id"]

    root = mk(None, "root", 0)
    c1 = mk(root, "c1", 5)  # 第 5 回合 commit(kb_events 挂这里)
    db.execute("update game_saves set active_commit_id=%s where id=%s", (c1, save_id))
    return int(save_id), int(c1)


def _flat_visible_event_count(db, save_id, born_commit, summary):
    """模拟 episodic 扁平语料谓词:同 born_commit + retired_at_commit is null + summary 匹配。"""
    return db.execute(
        "select count(*) as n from kb_events "
        "where save_id=%s and born_commit=%s and retired_at_commit is null and summary=%s",
        (save_id, born_commit, summary),
    ).fetchone()["n"]


def test_rewrite_retires_turn_kb_events():
    connect = _db_or_skip()
    from kb import live_repo as L
    from routes.game.saves import _retire_and_remaintain_after_rewrite

    with connect() as db:
        save_id, c1 = _seed_kb_save(db)
        uid = int(db.execute("select user_id from game_saves where id=%s", (save_id,)).fetchone()["user_id"])
        try:
            # 首稿抽取:该回合 commit 上落一条事件
            summ = "旧稿:村长被玩家杀死"
            L.record_event(db, save_id, c1, "kevt:0", summary=summ,
                           metadata={"source": "world.known_events"})

            # 退役前:_newest_visible 与扁平语料都能命中
            assert any(e["summary"] == summ for e in L.read_events(db, save_id, c1))
            assert _flat_visible_event_count(db, save_id, c1, summ) == 1

            # 换稿:退役该回合 kb_events + 重跑史官(canon 空 → 史官 no-op,不报错)
            _retire_and_remaintain_after_rewrite(db, save_id, turn=5, rewrite_text="新稿:村长安然无恙", uid=uid)

            # 退役后:两类查询都不再命中(就地 retired_at_commit 生效)
            assert all(e["summary"] != summ for e in L.read_events(db, save_id, c1)), \
                "_newest_visible 仍命中旧稿事件(退役失败)"
            assert _flat_visible_event_count(db, save_id, c1, summ) == 0, \
                "episodic 扁平语料仍命中旧稿事件(tombstone 遮蔽不了扁平查询,必须就地 UPDATE)"
        finally:
            db.execute("delete from game_saves where id=%s", (save_id,))


def test_non_kb_save_is_noop():
    """非 KB 档(kb_native=false 且无 kb_state)→ 退役助手直接跳过,不炸、不误伤。"""
    connect = _db_or_skip()
    from routes.game.saves import _retire_and_remaintain_after_rewrite

    with connect() as db:
        uid = db.execute("select id from users order by id limit 1").fetchone()
        sid = db.execute("select id from scripts order by id limit 1").fetchone()
        if not uid or not sid:
            pytest.skip("DB 无 user/script 种子")
        save_id = int(db.execute(
            "insert into game_saves(user_id,script_id,title,state_path,kb_native) "
            "values (%s,%s,%s,%s,false) returning id",
            (uid["id"], sid["id"], "retire-noop", "/tmp/retire_noop.json"),
        ).fetchone()["id"])
        try:
            # 不应抛异常(gate 提前返回)
            _retire_and_remaintain_after_rewrite(db, save_id, turn=1, rewrite_text="x", uid=int(uid["id"]))
        finally:
            db.execute("delete from game_saves where id=%s", (save_id,))


if __name__ == "__main__":
    import unittest
    unittest.main()
