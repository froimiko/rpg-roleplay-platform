"""world.known_events 必须有界:注入 GM prompt 只取最近 N 条(与其他 memory bucket 一致),
写入有硬上限(防 state_snapshot 无界膨胀)。原本两处都无上限,长局 token 爆炸 + DB 膨胀。"""
import copy
import re
import unittest
from pathlib import Path

from state import DEFAULT_STATE, GameState

CT_SRC = (Path(__file__).resolve().parents[2] / "tools_dsl" / "command_tools.py").read_text(encoding="utf-8")


class KnownEventsInjectionBounded(unittest.TestCase):
    def test_short_summary_injects_only_recent(self):
        st = GameState(copy.deepcopy(DEFAULT_STATE))
        st.data.setdefault("world", {})["known_events"] = [f"evt{i:03d}" for i in range(50)]
        summary = st.short_summary()
        # 最近 15 条 = evt035..evt049 应在;更早的 evt000..evt034 不应注入
        self.assertIn("evt049", summary)
        self.assertIn("evt035", summary)
        self.assertNotIn("evt034", summary, "注入了超过最近 15 条的旧事件(token 无界)")
        self.assertNotIn("evt000", summary)


class KnownEventsWriteCapped(unittest.TestCase):
    def test_set_world_known_event_has_hard_cap(self):
        # 源码断言:set_world_known_event 写入处有硬上限删旧
        # 执行体已抽取为模块级 _exec_set_world_known_event(细分抽取批次),守卫锚点跟随搬家:
        # ① 分发分支必须仍接线到抽取函数 ② 抽取函数体内必须保有硬上限删旧
        i = CT_SRC.find('name == "set_world_known_event"')
        self.assertNotEqual(i, -1)
        self.assertIn("_exec_set_world_known_event(state, args)", CT_SRC[i:i + 200],
                      "set_world_known_event 分支未接线到抽取的执行函数")
        j = CT_SRC.find("def _exec_set_world_known_event")
        self.assertNotEqual(j, -1)
        block = CT_SRC[j:j + 1400]
        self.assertTrue(re.search(r"len\(events\)\s*>\s*\d+", block),
                        "set_world_known_event 写入无硬上限 → state_snapshot 无界膨胀")
        self.assertIn("del events[:-", block, "未删除超限的旧事件")


if __name__ == "__main__":
    unittest.main()
