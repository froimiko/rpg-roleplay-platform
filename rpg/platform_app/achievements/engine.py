"""成就判定引擎 — 声明式白名单规则 + 统计快照 + 解锁落库。

设计见 docs/design/I_achievements.md。核心不变量:
- rule 只能引用白名单 metric / 白名单 op / 数字 target → admin 改规则也无注入面。
- 进度不落库,只落解锁;解锁只增不减。
"""
from __future__ import annotations

import operator
from datetime import date, timedelta
from typing import Any

# ── 白名单:admin 写规则只能引用这些 ───────────────────────────────────
# Phase 1 全部来自 /api/me/stats 已有数据源;Phase 2 事件埋点后在此追加。
ALLOWED_METRICS = {
    "saves_count",
    "total_rounds",
    "branches",
    "branch_nodes",
    "max_branch_depth",
    "scripts",
    "words",
    "chapters",
    "login_streak",
    "longest_login_streak",
}
ALLOWED_OPS = {">=", ">", "=="}
_OPS = {">=": operator.ge, ">": operator.gt, "==": operator.eq}
_MAX_RULE_DEPTH = 3


# ── 统计快照(me.py 与 engine 共用,单一真相) ─────────────────────────
def build_stats_snapshot(db, user) -> dict[str, Any]:
    """汇总玩家真实统计,返回扁平 metric→数值 dict(外加 last_login_at)。

    供 /api/me/stats 与成就判定共用,避免两处查询漂移。
    """
    uid = user["id"]
    username = user.get("username")

    sc_row = db.execute(
        "select coalesce(count(*), 0) as n, "
        "coalesce(sum(word_count), 0) as words, "
        "coalesce(sum(chapter_count), 0) as chapters "
        "from scripts where owner_id = %s",
        (uid,),
    ).fetchone()
    sv_row = db.execute(
        "select count(*) as n from game_saves where user_id = %s", (uid,)
    ).fetchone()
    rounds_row = db.execute(
        """
        select coalesce(sum(per_save_max), 0) as n from (
          select max(b.turn_index) as per_save_max
          from branch_nodes b join game_saves s on s.id = b.save_id
          where s.user_id = %s
          group by b.save_id
        ) t
        """,
        (uid,),
    ).fetchone()
    nodes_row = db.execute(
        """
        select count(*) as n
        from branch_nodes b join game_saves s on s.id = b.save_id
        where s.user_id = %s
        """,
        (uid,),
    ).fetchone()
    branches_row = db.execute(
        """
        select coalesce(sum(extra), 0) as n from (
          select count(*) - 1 as extra
          from branch_nodes b join game_saves s on s.id = b.save_id
          where s.user_id = %s and b.parent_id is not null
          group by b.parent_id
          having count(*) > 1
        ) t
        """,
        (uid,),
    ).fetchone()
    depth_row = db.execute(
        """
        with recursive bn as (
          select b.id, b.save_id, b.parent_id, 1 as depth
          from branch_nodes b join game_saves s on s.id = b.save_id
          where s.user_id = %s and b.parent_id is null
          union all
          select c.id, c.save_id, c.parent_id, bn.depth + 1
          from branch_nodes c join bn on c.parent_id = bn.id
        )
        select coalesce(max(depth), 0) as n from bn
        """,
        (uid,),
    ).fetchone()
    last_login_row = db.execute(
        """
        select created_at from login_audit
        where username = %s and event = 'login_ok'
        order by created_at desc
        offset 1 limit 1
        """,
        (username,),
    ).fetchone()
    days_rows = db.execute(
        """
        select distinct date_trunc('day', created_at at time zone 'UTC')::date as d
        from login_audit
        where username = %s and event = 'login_ok'
          and created_at >= now() - interval '365 days'
        order by d desc
        """,
        (username,),
    ).fetchall()

    login_days = [r["d"] for r in days_rows]
    today = date.today()
    streak = 0
    if login_days and login_days[0] in (today, today - timedelta(days=1)):
        cur = login_days[0]
        for d in login_days:
            if d == cur:
                streak += 1
                cur = cur - timedelta(days=1)
            elif d < cur:
                break
    longest = 0
    if login_days:
        prev = None
        run = 0
        for d in login_days:  # desc
            if prev is None or (prev - d).days == 1:
                run += 1
            else:
                longest = max(longest, run)
                run = 1
            prev = d
        longest = max(longest, run)

    return {
        "saves_count": int(sv_row["n"] or 0),
        "total_rounds": int(rounds_row["n"] or 0),
        "branches": int(branches_row["n"] or 0),
        "branch_nodes": int(nodes_row["n"] or 0),
        "max_branch_depth": int(depth_row["n"] or 0),
        "scripts": int(sc_row["n"] or 0),
        "words": int(sc_row["words"] or 0),
        "chapters": int(sc_row["chapters"] or 0),
        "login_streak": int(streak),
        "longest_login_streak": int(longest),
        "last_login_at": (
            last_login_row["created_at"].isoformat()
            if last_login_row and last_login_row["created_at"]
            else None
        ),
    }


# ── 规则校验(admin 写入闸门) ─────────────────────────────────────────
def validate_rule(rule: Any, _depth: int = 0) -> None:
    """校验声明式规则;非法抛 ValueError。这是阻止越权/可执行规则的关键闸。"""
    if _depth > _MAX_RULE_DEPTH:
        raise ValueError("规则嵌套过深")
    if not isinstance(rule, dict):
        raise ValueError("规则必须是对象")
    if "all" in rule:
        parts = rule["all"]
        if not isinstance(parts, list) or not parts:
            raise ValueError("all 必须是非空数组")
        if set(rule.keys()) - {"all"}:
            raise ValueError("复合规则只能含 all")
        for r in parts:
            validate_rule(r, _depth + 1)
        return
    metric = rule.get("metric")
    op = rule.get("op")
    target = rule.get("target")
    if metric not in ALLOWED_METRICS:
        raise ValueError(f"未知 metric: {metric!r}(白名单:{sorted(ALLOWED_METRICS)})")
    if op not in ALLOWED_OPS:
        raise ValueError(f"未知 op: {op!r}(白名单:{sorted(ALLOWED_OPS)})")
    if isinstance(target, bool) or not isinstance(target, (int, float)):
        raise ValueError("target 必须是数字")


# ── 判定 ──────────────────────────────────────────────────────────────
def eval_rule(rule: dict, snap: dict) -> dict:
    """返回 {unlocked, pct(0-100), value, target}。复合规则 value/target 为 None,pct 取最小子项。"""
    if "all" in rule:
        parts = [eval_rule(r, snap) for r in rule["all"]]
        return {
            "unlocked": all(p["unlocked"] for p in parts),
            "pct": min((p["pct"] for p in parts), default=0),
            "value": None,
            "target": None,
        }
    metric = rule["metric"]
    op = rule["op"]
    target = rule["target"]
    value = snap.get(metric, 0) or 0
    unlocked = _OPS[op](value, target)
    if unlocked:
        pct = 100
    elif target:
        pct = int(min(100, max(0, value * 100 // target)))
    else:
        pct = 100
    return {"unlocked": unlocked, "pct": pct, "value": value, "target": target}


def _project(d: dict, unlocked: bool, res: dict, urow: dict | None) -> dict:
    hidden = bool(d["hidden"])
    mask = hidden and not unlocked
    return {
        "id": d["id"],
        "name": "？？？" if mask else d["name"],
        "desc": "隐藏成就" if mask else d["description"],
        "icon": None if mask else d.get("icon"),
        "category": d["category"],
        "tier": d.get("tier"),
        "hidden": hidden,
        "unlocked": unlocked,
        "unlocked_at": (
            urow["unlocked_at"].isoformat() if urow and urow.get("unlocked_at") else None
        ),
        "pct": 100 if unlocked else res["pct"],
        "value": res["value"],
        "target": res["target"],
    }


def evaluate(db, user) -> dict:
    """评估全部成就 + 落新解锁。返回 {items, newly_unlocked}。"""
    snap = build_stats_snapshot(db, user)
    defs = db.execute(
        "select * from achievement_defs where enabled order by category, sort_order, id"
    ).fetchall()
    have = {
        r["achievement_id"]: r
        for r in db.execute(
            "select * from user_achievements where user_id = %s", (user["id"],)
        ).fetchall()
    }
    items: list[dict] = []
    newly: list[str] = []
    for d in defs:
        try:
            res = eval_rule(d["rule"], snap)
        except Exception:
            # 损坏的规则不应炸整页:当作未解锁、进度 0
            res = {"unlocked": False, "pct": 0, "value": None, "target": None}
        urow = have.get(d["id"])
        already = urow is not None
        if res["unlocked"] and not already:
            db.execute(
                "insert into user_achievements (user_id, achievement_id, progress_at_unlock, seen) "
                "values (%s, %s, %s, false) on conflict do nothing",
                (user["id"], d["id"], res.get("value")),
            )
            newly.append(d["id"])
        unlocked = bool(res["unlocked"] or already)
        items.append(_project(d, unlocked, res, urow))
    return {"items": items, "newly_unlocked": newly}


def public_catalog(db) -> list[dict]:
    """匿名/公开目录:全锁态、进度 0、隐藏成就打码。无用户、无落库。"""
    defs = db.execute(
        "select * from achievement_defs where enabled order by category, sort_order, id"
    ).fetchall()
    out: list[dict] = []
    for d in defs:
        res = {"unlocked": False, "pct": 0, "value": None, "target": None}
        out.append(_project(d, False, res, None))
    return out
