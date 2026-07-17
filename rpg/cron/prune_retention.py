"""rpg.cron.prune_retention — retention 系统性遗漏族补齐(2026-07 债务台账)。

三张此前从未被清理过的表,对照 login_audit(90 天)/admin_audit_log(365 天)/
feedback(24 月)已有的 prune 口径补齐:

  - tool_invocations:    GM 工具调用遥测(migration 42 "telemetry"),增长最快的一张
                          表。跟 login_audit 同属"运维可观测性日志"(供 /api/admin/
                          tool-usage 聚合排障,非合规留痕),保留期同 login_audit = 90 天
                          (见 cron.prune_audit.run_prune_login_audit)。单表体积大,
                          delete 按 id 游标分批(LIMIT + 每批单独 commit),避免一次性
                          长事务长期持有行锁,阻塞并发的 fire-and-forget 遥测 insert。
  - chat_postproc_tasks: Phase 4 后处理任务队列。status in ('done','failed') 且
                          completed_at 已落地即为终态行 —— run_postproc_worker.py 的
                          认领查询固定 `WHERE status IN ('pending','failed') AND
                          attempts < MAX_ATTEMPTS`,而 status 只有在 attempts >=
                          MAX_ATTEMPTS 时才会被置为 'failed'(_process_one /
                          _reap_stuck_running),所以 status in ('done','failed') 的行
                          必然不会再被任何 worker 捞取,删除安全。pending/running 行
                          (还可能被处理)一律不碰。保留 30 天(队列记录只为近期排障,
                          不是审计留痕)。
  - email_verifications: 验证码 pending 行(10 分钟过期),此前无 TTL,旧行永久留存。
                          对应安全审计 [H-7](docs/security/security-audit-2026-06-08.md)
                          指出的"pending-but-never-confirmed 行无 user_id,不被
                          hard_delete 清理,长期留存"暴露面之一(该行的 ua 列可能含
                          Argon2 密码哈希,见 auth.py 注册 Phase 1)。按 created_at 删
                          7 天前的行 —— 远超验证码 10 分钟有效期与登录频控 60 秒回看
                          窗口(auth.py 里 `order by created_at desc limit 1` 只看最近
                          一条),不影响任何在用查询。

用法:
    from rpg.cron.prune_retention import (
        run_prune_tool_invocations,
        run_prune_postproc_tasks,
        run_prune_email_verifications,
    )
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# tool_invocations 单批删除行数上限。每批单独 commit,把一次性长事务拆成多段短事务。
_TOOL_INVOCATIONS_BATCH_SIZE = 5000
# 单次 cron 调用最多跑几批(≈500万行/次),防止首次补跑(历史存量巨大)时单次 cron
# 运行时间失控。跑不完留到下一次 cron(每批已 commit,已删的不会重删,天然可续跑)。
_TOOL_INVOCATIONS_MAX_BATCHES = 1000


def run_prune_tool_invocations(
    db,
    days: int = 90,
    batch_size: int = _TOOL_INVOCATIONS_BATCH_SIZE,
) -> dict:
    """删除 tool_invocations 中超过 `days` 天的行,分批删避免长事务锁表。

    Args:
        db:         psycopg Connection(dict_row),调用方负责最终连接生命周期
                    (本函数内部按批 commit,不依赖调用方在结束后再 commit 一次)
        days:       保留天数(默认 90,口径同 login_audit)
        batch_size: 单批删除行数上限(默认 5000)

    Returns:
        {"pruned": int, "truncated": bool}  truncated=True 表示触及批数上限提前收尾,
        仍有超期行未删完,会在下次 cron 运行时继续清。
    """
    days = max(1, int(days))
    batch_size = max(1, int(batch_size))
    total = 0
    truncated = False
    for _ in range(_TOOL_INVOCATIONS_MAX_BATCHES):
        cur = db.execute(
            f"""
            delete from tool_invocations
            where id in (
              select id from tool_invocations
              where ts < now() - interval '{days} days'
              order by id
              limit {batch_size}
            )
            """
        )
        n = cur.rowcount
        total += n
        db.commit()  # 每批单独提交,缩短单次持锁时间
        if n < batch_size:
            break
    else:
        truncated = True
        logger.warning(
            "prune_tool_invocations: 触及 %d 批上限提前收尾,可能仍有超期行未删完,"
            "下次 cron 会继续清", _TOOL_INVOCATIONS_MAX_BATCHES,
        )
    logger.info(
        "prune_tool_invocations: pruned=%d rows (threshold=%d days, batch=%d, truncated=%s)",
        total, days, batch_size, truncated,
    )
    return {"pruned": total, "truncated": truncated}


def run_prune_postproc_tasks(db, days: int = 30) -> dict:
    """删除 chat_postproc_tasks 中超过 `days` 天的终态行(status in done/failed)。

    Args:
        db:   psycopg Connection(dict_row)
        days: 保留天数(默认 30,队列记录只为近期排障,非审计留痕)

    Returns:
        {"pruned": int}
    """
    days = max(1, int(days))
    cur = db.execute(
        f"""
        delete from chat_postproc_tasks
        where status in ('done', 'failed')
          and completed_at < now() - interval '{days} days'
        """
    )
    n = cur.rowcount
    logger.info("prune_postproc_tasks: pruned=%d rows (threshold=%d days)", n, days)
    return {"pruned": n}


def run_prune_email_verifications(db, days: int = 7) -> dict:
    """删除 email_verifications 中超过 `days` 天的行(验证码 10 分钟即过期,早已无用)。

    Args:
        db:   psycopg Connection(dict_row)
        days: 保留天数(默认 7)

    Returns:
        {"pruned": int}
    """
    days = max(1, int(days))
    cur = db.execute(
        f"delete from email_verifications where created_at < now() - interval '{days} days'"
    )
    n = cur.rowcount
    logger.info("prune_email_verifications: pruned=%d rows (threshold=%d days)", n, days)
    return {"pruned": n}
