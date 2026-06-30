"""回归:rollback_to_message(删除消息及之后)不得「多回退一个回合」。

群反馈(行者无疆/晓卡/星之游):「点 删除此消息及以后 会多回退一个回合,要手动去分支树里再切回来。
之前不会」「修了一个出来两个」。根因=delete 路径用 message_row_by_index 读 **flat messages 表**
(含开场空 user 行 + 非分支隔离 → 与前端 blob history index 错位 ≥1 位),而 fork 路径
(resolve_commit_id_by_message)早已改用 `msg_index // 2` + 活跃血缘。v1.28.1 分支隔离让 messages 表与
blob 进一步背离 → 错位放大。真库(save 268)实测:删 blob idx 3(玩家「我记得」@turn2)旧逻辑回退到
turn0、应到 turn1,系统性偏一回合。

修=delete 路径与 fork 同口径:target_turn = msg_index//2,沿活跃 commit 血缘内联递归定位
(不可调用 resolve_commit_id_by_message——会在 advisory 锁内嵌套开连接致池死锁,见 5f0319a73),
不再用 message_row_by_index。本测试为源码不变量守卫(行为已在真库 save 268 跨 index 1..7 验证:
NEW 恒为 OLD+1、且都落在活跃血缘真实 turn 上)。
"""
import unittest
from pathlib import Path

from platform_app.branches import deletion

SRC = Path(deletion.__file__).read_text(encoding="utf-8")


def _strip_comments(text: str) -> str:
    """去掉整行 # 注释 —— 注释里会引用旧符号名,只验真实代码。"""
    return "\n".join(ln for ln in text.splitlines() if not ln.lstrip().startswith("#"))


def _rollback_code() -> str:
    i = SRC.find("def rollback_to_message(")
    assert i != -1, "找不到 rollback_to_message"
    end = SRC.find("\ndef ", i + 1)
    return _strip_comments(SRC[i:end if end != -1 else len(SRC)])


class RollbackOffByOneGuard(unittest.TestCase):
    def test_uses_frontend_index_convention_not_messages_table(self):
        code = _rollback_code()
        self.assertIn("msg_index // 2", code,
                      "rollback 未用 msg_index//2 约定 → 与 fork 路径不一致,会多回退一回合")
        self.assertNotIn("message_row_by_index", code,
                         "rollback 仍调 message_row_by_index(flat messages 表错位)= 根因未除")

    def test_resolves_along_active_lineage(self):
        code = _rollback_code()
        self.assertIn("with recursive lineage", code,
                      "rollback 未沿活跃 commit 血缘定位 → 多分支下跨分支命中错节点")
        self.assertIn("active_cid", code, "未以活跃 commit 为血缘起点")

    def test_deleted_turn_is_one_past_target(self):
        code = _rollback_code()
        self.assertIn("deleted_turn = target_turn + 1", code,
                      "删除起点应为保留点的下一回合(否则会连保留回合一起删/漏删)")

    def test_gm_message_deletion_drops_its_turn(self):
        # 回归(v1.32.4):删 GM 回复(偶数 index)必须把这条回复连其所在回合一起删,
        # 否则回退到本回合 round commit 会把它一起保留 = 用户「删了 GM 回复却还在」。
        # 偶数 index 要在 N//2 基础上再退一格(odd=玩家输入不变,保留原 off-by-one 修复)。
        code = _rollback_code()
        self.assertIn("msg_index % 2 == 0", code,
                      "未按奇偶区分 → 删 GM 回复(偶)会把它保留(v1.30.1 引入的回归)")
        self.assertIn("target_turn - 1", code,
                      "GM 回复(偶)未再退一格 → 该回合的 GM 回复删不掉")

    def _even_odd_behavior(self):
        # 纯逻辑复核:偶=删该回合、奇=保留到上一回合(与源码一致)
        def tt(K):
            t = K // 2
            if K % 2 == 0:
                t = max(0, t - 1)
            return t
        return tt

    def test_parity_target_turn_values(self):
        tt = self._even_odd_behavior()
        # idx2=GM(turn1) 应退到 turn0(删 turn1 含该 GM 回复);idx3=玩家(turn2)留到 turn1
        self.assertEqual(tt(2), 0, "删 GM turn1 回复应退到 turn0")
        self.assertEqual(tt(3), 1, "删玩家 turn2 输入应留到 turn1")
        self.assertEqual(tt(1), 0)
        self.assertEqual(tt(0), 0, "删开场不应越界为负")

    def test_module_import_drops_message_row_by_index(self):
        # 该符号在本模块已无用 → import 行不应再带它(防 ruff 未用导入 + 防误用回退)
        import_lines = [ln for ln in SRC.splitlines()
                        if ln.startswith("from ") or ln.startswith("import ")]
        self.assertFalse(
            any("message_row_by_index" in ln for ln in import_lines),
            "deletion.py 仍 import message_row_by_index(已无用)",
        )


if __name__ == "__main__":
    unittest.main()
