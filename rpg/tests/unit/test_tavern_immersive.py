"""酒馆沉浸式拟人模式 —— 确定性开关 + system prompt 注入回归。

铁律(harness 确定性):开关持久存于 state.data['tavern'].immersive,每回合由
_build_system 读取后【确定性注入】覆盖块,不依赖模型自己记住;默认关 → 零行为变化。
"""
import types
import unittest


class ImmersiveTool(unittest.TestCase):
    def setUp(self):
        from tools_dsl.command_tools_tavern import register_tavern_tools
        register_tavern_tools()

    def test_registered_save_scope_llm_origin(self):
        from tools_dsl.command_dispatcher import get_registry
        reg = get_registry()
        self.assertTrue(reg.has("set_tavern_immersive"))
        spec = next(s for s in reg.list_for_origin("llm_chat") if s.name == "set_tavern_immersive")
        self.assertEqual(spec.scope, "save")
        self.assertFalse(spec.destructive)
        self.assertIn("llm_chat", spec.origins)

    def test_executor_mutates_state(self):
        from tools_dsl.command_tools_tavern import _t_set_tavern_immersive
        st = types.SimpleNamespace(data={})
        _t_set_tavern_immersive(st, {"enabled": True})
        self.assertIs(st.data["tavern"]["immersive"], True)
        _t_set_tavern_immersive(st, {"enabled": False})
        self.assertIs(st.data["tavern"]["immersive"], False)
        # 字符串容错
        _t_set_tavern_immersive(st, {"enabled": "false"})
        self.assertIs(st.data["tavern"]["immersive"], False)
        _t_set_tavern_immersive(st, {"enabled": "true"})
        self.assertIs(st.data["tavern"]["immersive"], True)

    def test_kept_in_tavern_dropped_in_game(self):
        # 命名 set_tavern_* → tavern 模式保留、非 tavern(游戏控制台)丢弃
        from tools_dsl.chat_tool_router import _tavern_drops_tool
        self.assertFalse(_tavern_drops_tool("set_tavern_immersive"))


class ImmersivePromptInjection(unittest.TestCase):
    def _build(self, immersive, char="莉莉"):
        import agents.gm.master as M
        import context_providers.registry as _reg
        gm = M.GameMaster.__new__(M.GameMaster)  # 跳过 __init__(无需凭证)
        gm.user_id = None
        gm._world_section_for_active_content = lambda: ""
        gm._active_script_id = lambda: None
        tav = {"immersive": immersive}
        if char:
            tav["character"] = {"name": char}
        gm._active_state = types.SimpleNamespace(data={"tavern": tav})
        orig = _reg.resolve_content_pack
        _reg.resolve_content_pack = lambda st: {"gm_policy": {"mode": "tavern_gm"}}
        try:
            return gm._build_system()
        finally:
            _reg.resolve_content_pack = orig

    def test_override_only_when_on(self):
        on = self._build(True)
        off = self._build(False)
        self.assertIn("沉浸式拟人模式", on)
        self.assertNotIn("沉浸式拟人模式", off)

    def test_char_name_filled_and_base_preserved(self):
        on = self._build(True, char="薇拉")
        self.assertIn("【薇拉】", on)
        self.assertIn("推进剧情", on)  # 酒馆基底仍在

    def test_no_character_uses_bootstrap_no_override(self):
        # 还没设角色 → 走 bootstrap 模板,不注入沉浸式覆盖
        out = self._build(True, char=None)
        self.assertNotIn("沉浸式拟人模式", out)


if __name__ == "__main__":
    unittest.main()
