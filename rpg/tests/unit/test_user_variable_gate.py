"""修1:GM 标签【用户变量：xx=yy】必须走权限闸门,不再直调 set_user_variable 绕过。

病灶:apply_structured_updates 的用户变量标签分支曾直调 self.set_user_variable(...),
完整绕过 _gm_write_via_gate(硬黑名单 / 权限模式 pending / audit_log 全跳过)——
read_only 模式也拦不住,破坏「任何 LLM 自动写入都入 pending」承诺。

对照:JSON-op 等价路径 worldline.user_variables.X 走 apply_state_write_typed
kind=="user_variable" 分支已正确闸控。此测试锁死标签路径与之对齐。

read_only 测试风格参照 test_inventory_grant_pickup.py 的 pending 审批路径。
"""
from __future__ import annotations

import unittest

from state import GameState


class UserVariableTagGoesThroughGate(unittest.TestCase):
    def _uv(self, g):
        return (g.data.get("worldline", {}) or {}).get("user_variables", {}) or {}

    def test_read_only_puts_user_variable_into_pending_not_direct_write(self):
        """read_only:GM【用户变量】必须入 pending,不得绕过闸门直写 worldline。"""
        g = GameState.new()
        g.data["permissions"]["mode"] = "read_only"
        g.apply_structured_updates("剧情推进。【用户变量：好感度=80】")

        # 未直写 worldline.user_variables
        self.assertNotIn("好感度", self._uv(g),
                         "read_only 下 GM 用户变量不得绕过闸门直写")
        # 入 pending,path 指向 worldline.user_variables.好感度
        pending = g.data["permissions"]["pending_writes"]
        self.assertTrue(
            any(pw.get("path") == "worldline.user_variables.好感度" for pw in pending),
            f"用户变量写入应入 pending;实际={pending}",
        )

    def test_full_access_writes_user_variable(self):
        """full_access:正常落地,语义与旧直写一致(value/locked/source)。"""
        g = GameState.new()
        g.data["permissions"]["mode"] = "full_access"
        g.apply_structured_updates("剧情推进。【用户变量：好感度=80】")

        uv = self._uv(g)
        self.assertIn("好感度", uv, "full_access 下用户变量应正常落地")
        self.assertEqual(uv["好感度"].get("value"), "80")
        # 无 pending 遗留(直接生效)
        self.assertFalse(g.data["permissions"]["pending_writes"],
                         "full_access 不应产生 pending")


if __name__ == "__main__":
    unittest.main(verbosity=2)
