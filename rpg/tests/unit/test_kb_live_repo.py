"""Phase C — kb.live_repo 行级 COW 世界树语义(live DB,无 DB 则跳过)。

验证: COW / newest-in-ancestry / tombstone 删除 / fork 分支隔离 / 检查点。
"""
from __future__ import annotations

import pytest


def _db_or_skip():
    try:
        from platform_app.db import connect, init_db
        init_db()
        return connect
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"无 DB,跳过 live KB 测试: {exc}")


def _seed_save_and_commits(db):
    uid = db.execute("select id from users order by id limit 1").fetchone()
    sid = db.execute("select id from scripts order by id limit 1").fetchone()
    if not uid or not sid:
        pytest.skip("DB 无 user/script 种子")
    save_id = db.execute(
        "insert into game_saves(user_id,script_id,title,state_path) values (%s,%s,%s,%s) returning id",
        (uid["id"], sid["id"], "BC-pytest", "/tmp/bc_pytest.json"),
    ).fetchone()["id"]

    def mk(parent, tag):
        return db.execute(
            "insert into branch_commits(save_id,parent_id,object_hash,tree_hash,turn_index,kind,title) "
            "values (%s,%s,%s,%s,%s,%s,%s) returning id",
            (save_id, parent, "h_" + tag, "t_" + tag, 0, "round", tag),
        ).fetchone()["id"]

    root = mk(None, "root")
    c1 = mk(root, "c1")
    c2 = mk(c1, "c2")
    c3 = mk(c1, "c3")  # fork of c1
    return save_id, c1, c2, c3


def test_cow_fork_isolation_and_tombstone():
    connect = _db_or_skip()
    from kb import live_repo as L

    with connect() as db:
        save_id, c1, c2, c3 = _seed_save_and_commits(db)
        try:
            L.upsert_entity(db, save_id, c1, "alice", name="Alice", type="character", summary="v1")
            L.upsert_entity(db, save_id, c1, "bob", name="Bob", type="character", summary="bob")
            L.upsert_entity(db, save_id, c2, "alice", name="Alice", type="character", summary="v2")
            L.retire_entity(db, save_id, c2, "bob")
            L.upsert_entity(db, save_id, c3, "carol", name="Carol", type="character", summary="c3only")

            def names(c):
                return {e["logical_key"]: e["summary"] for e in L.read_entities(db, save_id, c)}

            assert names(c1) == {"alice": "v1", "bob": "bob"}
            # newest-in-ancestry 升级 + tombstone 删除
            assert names(c2) == {"alice": "v2"}
            # fork 隔离:c3 看不到 c2 的升级/删除,只有自己的 carol
            assert names(c3) == {"alice": "v1", "bob": "bob", "carol": "c3only"}

            # 事件/关系/变量 + fork 隔离
            L.record_event(db, save_id, c2, "ev1", summary="柏林会战", participants=["alice"])
            assert [e["summary"] for e in L.read_events(db, save_id, c2)] == ["柏林会战"]
            assert L.read_events(db, save_id, c3) == []
            L.set_relationship(db, save_id, c2, "r1", from_key="alice", to_key="bob", kind="盟友")
            assert L.read_relationships(db, save_id, c2)[0]["kind"] == "盟友"
            L.set_worldline_var(db, save_id, c2, "war", value=True)
            assert L.read_worldline_vars(db, save_id, c2)[0]["value"] is True

            # 检查点
            cp = L.write_checkpoint(db, save_id, c2)
            assert any(e["logical_key"] == "alice" for e in cp["snapshot"]["entities"])
        finally:
            db.execute("delete from game_saves where id=%s", (save_id,))


def test_relationships_materialize_in_update_recency_order():
    """materialize 还原的 relationships dict 键序 = born_commit(最后更新)升序。

    state 落库是 jsonb(不保 dict 键序)、旧实现按名字序重建 → 下游「最近 N 条」
    窗口(short_summary[-20:]/史官快照[-8:])变成按名字字节序的任意子集。
    现按 born_commit 升序插入:最近更新的关系恒在尾部、恒落进窗口。
    """
    connect = _db_or_skip()
    from kb import live_repo as L
    from kb import save_kb

    with connect() as db:
        save_id, c1, c2, c3 = _seed_save_and_commits(db)
        try:
            # c1 登记 张三、李四(名字序会把「李四」排前);c2 更新 张三 → 张三 最新
            L.set_relationship(db, save_id, c1, "_player->张三", from_key="_player", to_key="张三", kind="警惕")
            L.set_relationship(db, save_id, c1, "_player->李四", from_key="_player", to_key="李四", kind="盟友")
            L.set_relationship(db, save_id, c2, "_player->张三", from_key="_player", to_key="张三", kind="信任")
            st = save_kb.materialize(db, save_id, c2)
            keys = list(st["relationships"].keys())
            assert keys[-1] == "张三", f"最近更新的关系应在尾部,实际 {keys}"
            assert st["relationships"]["张三"] == "信任"
        finally:
            db.execute("delete from game_saves where id=%s", (save_id,))
