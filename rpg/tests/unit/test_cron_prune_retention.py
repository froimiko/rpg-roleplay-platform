"""cron.prune_retention — 补齐 tool_invocations / chat_postproc_tasks / email_verifications
三张此前从未被清理过的表(2026-07 债务台账 retention 系统性遗漏族)。

覆盖:
  - run_cron.COMMANDS 挂了新命令(`run_cron all` 才会跑到)
  - cmd_prune_retention 正确聚合三个子 prune 的结果并落一条审计
  - tool_invocations 分批删除:多批 rowcount 求和正确、每批单独 commit(缩短持锁
    时间)、触及批数上限时 truncated=True 且不无限循环
  - chat_postproc_tasks / email_verifications 简单透传 rowcount
"""
from __future__ import annotations

import importlib.util
import unittest
from contextlib import ExitStack
from unittest import mock

from cron import prune_retention
from scripts import run_cron


def _patch_prune_retention_symbol(stack: ExitStack, symbol: str, **kwargs):
    """在 `cron.prune_retention` 与 `rpg.cron.prune_retention` 两个候选模块路径上都
    打 patch(存在几个打几个)。cmd_prune_retention 到底 import 到哪个模块对象,取决于
    当前进程 `rpg` 顶层包是否可导(cwd 敏感,同 test_cron_phase_digest_backfill.py 的
    _patch_phase_digest_symbol)——测试不应该依赖"pytest 恰好从哪个目录启动"这种环境
    细节,所以两条路径能 patch 的都 patch。"""
    targets = ["cron.prune_retention"]
    if importlib.util.find_spec("rpg") is not None:
        targets.append("rpg.cron.prune_retention")
    for target in targets:
        stack.enter_context(mock.patch(f"{target}.{symbol}", **kwargs))


class FakeCursor:
    def __init__(self, rowcount: int):
        self.rowcount = rowcount


class FakeDB:
    """极简 fake:按顺序回放预设的 rowcount 序列,记录每次 SQL + commit 调用。"""

    def __init__(self, rowcounts: list[int]):
        self._rowcounts = list(rowcounts)
        self.executed: list[str] = []
        self.commit_count = 0

    def execute(self, sql, *args, **kwargs):
        self.executed.append(sql)
        n = self._rowcounts.pop(0) if self._rowcounts else 0
        return FakeCursor(n)

    def commit(self):
        self.commit_count += 1


class CronPruneRetentionWiring(unittest.TestCase):
    def test_registered_in_commands(self):
        self.assertIn("prune_retention", run_cron.COMMANDS,
                       "prune_retention 未注册进 COMMANDS,`run_cron all` 不会跑它")
        self.assertIs(run_cron.COMMANDS["prune_retention"], run_cron.cmd_prune_retention)

    def test_cmd_aggregates_three_sub_prunes(self):
        fake_db = mock.MagicMock()
        with ExitStack() as stack:
            _patch_prune_retention_symbol(
                stack, "run_prune_tool_invocations",
                return_value={"pruned": 3, "truncated": False},
            )
            _patch_prune_retention_symbol(
                stack, "run_prune_postproc_tasks", return_value={"pruned": 5},
            )
            _patch_prune_retention_symbol(
                stack, "run_prune_email_verifications", return_value={"pruned": 7},
            )
            result = run_cron.cmd_prune_retention(fake_db)
        self.assertEqual(result, {
            "tool_invocations_pruned": 3,
            "postproc_tasks_pruned": 5,
            "email_verifications_pruned": 7,
        })


class PruneToolInvocationsBatching(unittest.TestCase):
    def test_sums_across_batches_and_commits_each_batch(self):
        # 3 批:满批、满批、不足批(触发停止条件 n < batch_size)
        db = FakeDB(rowcounts=[10, 10, 4])
        result = prune_retention.run_prune_tool_invocations(db, days=90, batch_size=10)
        self.assertEqual(result, {"pruned": 24, "truncated": False})
        self.assertEqual(db.commit_count, 3, "每批必须单独 commit,否则批不能真正缩短持锁时间")

    def test_zero_rows_single_batch_no_loop(self):
        db = FakeDB(rowcounts=[0])
        result = prune_retention.run_prune_tool_invocations(db, days=90, batch_size=5000)
        self.assertEqual(result, {"pruned": 0, "truncated": False})
        self.assertEqual(len(db.executed), 1)

    def test_hits_max_batches_sets_truncated_without_infinite_loop(self):
        # 每批都是满批(永远不小于 batch_size)→ 必须在 _TOOL_INVOCATIONS_MAX_BATCHES
        # 批后主动收尾,而不是死循环。
        max_batches = 3
        db = FakeDB(rowcounts=[10] * (max_batches + 5))  # 供给远多于上限的满批
        with mock.patch.object(prune_retention, "_TOOL_INVOCATIONS_MAX_BATCHES", max_batches):
            result = prune_retention.run_prune_tool_invocations(db, days=90, batch_size=10)
        self.assertEqual(result, {"pruned": 10 * max_batches, "truncated": True})
        self.assertEqual(len(db.executed), max_batches)


class PruneChatPostprocTasks(unittest.TestCase):
    def test_deletes_terminal_rows_only_by_sql_shape(self):
        db = FakeDB(rowcounts=[6])
        result = prune_retention.run_prune_postproc_tasks(db, days=30)
        self.assertEqual(result, {"pruned": 6})
        sql = db.executed[0].lower()
        self.assertIn("chat_postproc_tasks", sql)
        self.assertIn("status in ('done', 'failed')", sql)
        self.assertIn("completed_at <", sql)
        # 绝不能碰 pending/running(还可能被 worker 认领)
        self.assertNotIn("'pending'", sql)
        self.assertNotIn("'running'", sql)


class PruneEmailVerifications(unittest.TestCase):
    def test_deletes_by_created_at_threshold(self):
        db = FakeDB(rowcounts=[9])
        result = prune_retention.run_prune_email_verifications(db, days=7)
        self.assertEqual(result, {"pruned": 9})
        sql = db.executed[0].lower()
        self.assertIn("email_verifications", sql)
        self.assertIn("created_at <", sql)
        self.assertIn("interval '7 days'", sql)


if __name__ == "__main__":
    unittest.main()
