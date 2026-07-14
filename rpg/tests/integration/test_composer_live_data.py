"""
test_composer_live_data.py — Composer 的 ContextUsage 与 Model 下拉
必须接真后端，不能再是 hardcoded mock。
"""
from __future__ import annotations

import unittest
from pathlib import Path

from tests.helpers import make_client, register_user


class StatePayloadIncludesContextWindow(unittest.TestCase):
    """/api/v1/state.app.context_window 必须存在，给 FE ContextUsage 圆环做分母。"""

    def test_app_context_window_is_present_and_int(self):
        client = make_client()
        u = register_user(client)
        state = client.get("/api/v1/state", cookies=u["cookies"]).json()
        app_block = state.get("app") or {}
        self.assertIn("context_window", app_block,
            "/api/v1/state.app 必须含 context_window；否则 Composer 圆环只能用 mock 1M")
        ctx = app_block["context_window"]
        self.assertIsInstance(ctx, int)
        self.assertGreater(ctx, 0,
            "context_window 应 > 0；后端 platform_app.usage.context_window_for 应识别当前 model")


class StatePayloadIncludesModelCatalog(unittest.TestCase):
    """/api/v1/state.models.apis 必须存在 + .selected 指向当前模型。"""

    def test_models_catalog_present(self):
        client = make_client()
        u = register_user(client)
        state = client.get("/api/v1/state", cookies=u["cookies"]).json()
        models = state.get("models") or {}
        self.assertIsInstance(models.get("apis"), list)
        self.assertGreater(len(models["apis"]), 0,
            "至少应有一个 API/模型，否则 Composer 模型下拉为空")
        # selected 必须能映射回真实 model
        sel = models.get("selected") or {}
        self.assertIn("api_id", sel)
        self.assertIn("model_id", sel)

    def test_at_least_one_model_in_first_enabled_api(self):
        client = make_client()
        u = register_user(client)
        state = client.get("/api/v1/state", cookies=u["cookies"]).json()
        apis = (state.get("models") or {}).get("apis") or []
        enabled_apis = [a for a in apis if a.get("enabled") is not False]
        self.assertGreater(len(enabled_apis), 0, "需要至少一个 enabled API")
        first = enabled_apis[0]
        self.assertIn("models", first)
        self.assertGreater(len(first.get("models") or []), 0)


class FrontendComposerWiresLiveData(unittest.TestCase):
    """game-composer.jsx 不再使用 hardcoded ContextUsage 数值；ModelPopover 接真目录 + 真 select API。

    2026-07 更新：game-composer.jsx 经批次12模块化拆分(commit 20aaba39e)，ModelPopover /
    ContextUsage 的实体分别搬到 components/game/GameComposerPopovers.jsx /
    GameContextUsage.jsx；同一轮(commit 716b4278e "模型选择器统一到 AgentModelPicker")起，
    ModelPopover 不再自己拉目录/自己调 /api/models/select，而是整体委托
    components/AgentModelPicker.jsx(variant="popover")。断言随之改指向这些真实缝，
    守护意图（模型/上下文用量必须读真数据，不是 mock）不变。"""

    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[3] / "frontend" / "src"
        cls.composer = (root / "game-composer.jsx").read_text(encoding="utf-8")
        cls.popovers = (root / "components" / "game" / "GameComposerPopovers.jsx").read_text(encoding="utf-8")
        cls.context_usage = (root / "components" / "game" / "GameContextUsage.jsx").read_text(encoding="utf-8")
        cls.picker = (root / "components" / "AgentModelPicker.jsx").read_text(encoding="utf-8")
        cls.entry = (root / "entries" / "game-console.jsx").read_text(encoding="utf-8")

    def test_context_usage_no_longer_hardcoded(self):
        # 旧 mock：<ContextUsage used={624300} cap={1_048_576} plan={28} />
        self.assertNotIn("used={624300}", self.composer,
            "ContextUsage 不应再 hardcoded used=624300")
        self.assertNotIn("cap={1_048_576}", self.composer,
            "ContextUsage 不应再 hardcoded cap=1_048_576")
        self.assertNotIn("plan={28}", self.composer,
            "ContextUsage 不应再 hardcoded plan=28")

    def test_context_usage_reads_gameState(self):
        self.assertIn("<ContextUsage gameState={gameState}", self.composer,
            "ContextUsage 应从 gameState 拿数据")
        # ContextUsage 本体已搬到 GameContextUsage.jsx（纯机械拆分，DOM/行为零变化）。
        self.assertIn("memory.last_context.estimated_tokens", self.context_usage,
            "ContextUsage used 应读 gameState.memory.last_context.estimated_tokens")
        self.assertIn("app.context_window", self.context_usage,
            "ContextUsage cap 应读 gameState.app.context_window")
        # 旧 /api/me/usage 月度用量占位早在 commit d9f58fe25("token meter 默认只显示
        # 圆环")就被替换成点开圆环才拉的 ContextBreakdownPanel，读真实的按轮次上下文
        # 明细端点，而不是 mock 或月度汇总。
        self.assertIn("window.api.game.contextBreakdown", self.context_usage,
            "ContextBreakdownPanel 应拉真后端 /api/chat/context-breakdown，而非硬编码")

    def test_model_popover_uses_catalog_not_hardcoded(self):
        # ModelPopover 现在住 GameComposerPopovers.jsx，且早已重构为整体委托
        # AgentModelPicker(variant="popover") —— 模型列表/选中态不再自己实现，
        # 断言改为验证「委托接线正确」+「真正的数据源(AgentModelPicker)没有 mock」。
        idx = self.popovers.find("function ModelPopover")
        self.assertGreater(idx, 0)
        end = self.popovers.find("function ", idx + 1)
        if end < 0:
            end = len(self.popovers)
        popover_body = self.popovers[idx:end]
        self.assertNotIn("MODEL_OPTIONS.map", popover_body,
            "ModelPopover 不应再迭代 hardcoded MODEL_OPTIONS")
        self.assertIn("<AgentModelPicker", popover_body,
            "ModelPopover 应委托给全站唯一规范组件 AgentModelPicker 渲染真实模型列表")
        self.assertIn('persistShape={persist?.persistShape || "models_select"}', popover_body,
            "ModelPopover 传给 AgentModelPicker 的 persistShape 默认应是 models_select"
            "（选中即调真后端 /api/models/select，见 AgentModelPicker.persist()）")
        # 真正调用 /api/models/select 的落点在委托目标 AgentModelPicker 里。
        self.assertIn("window.api.models.select", self.picker,
            "ModelPopover 的委托目标 AgentModelPicker 选中后必须调真后端 /api/models/select")

    def test_game_console_picks_app_and_models_into_state(self):
        # PICK_STATE_KEYS 早已从 Game Console.html 内联脚本搬进 Vite 入口
        # frontend/src/entries/game-console.jsx（html 现在只是静态壳 + <script type="module">，
        # 不再含任何 JS state 声明）。
        idx = self.entry.find("PICK_STATE_KEYS = [")
        self.assertGreater(idx, 0, "entries/game-console.jsx 应定义 PICK_STATE_KEYS")
        end = self.entry.find("]", idx)
        keys_block = self.entry[idx:end]
        self.assertIn("'app'", keys_block,
            "PICK_STATE_KEYS 应含 app，否则 ContextUsage 拿不到 context_window")
        self.assertIn("'models'", keys_block,
            "PICK_STATE_KEYS 应含 models，否则 ModelPopover 拿不到 catalog")

    def test_composer_label_reads_live_app_model(self):
        # 当前模型标签应优先用 gameState.app.model，而不是 MODEL_OPTIONS 的 mock label
        self.assertIn("_currentModelLabel", self.composer)
        self.assertIn("gameState.app.model", self.composer,
            "_currentModelLabel 必须读 gameState.app.model 才反映真实切换结果")

    def test_no_mock_model_options_constant(self):
        # task 39 收尾：完全删掉 MODEL_OPTIONS 常量，不让任何 fallback 路径还能命中 mock 标签。
        # 现场 bug：用户截图显示 "GPT-4o · RPG / 主流 · 较快" 5 项 — 那是 MODEL_OPTIONS literal。
        # 注释里出现 MODEL_OPTIONS 这个词没事（写解释/历史），只要不再有真正的 const 声明 + 业务读它。
        import re
        # 找 `const MODEL_OPTIONS` / `let MODEL_OPTIONS` / `var MODEL_OPTIONS` —— 任何形式的真正声明
        decl = re.search(r"^\s*(?:const|let|var)\s+MODEL_OPTIONS\b", self.composer, re.MULTILINE)
        self.assertIsNone(decl,
            "MODEL_OPTIONS 常量应已删除；仍存在会作为 mock fallback 把用户带回 mock 列表")
        # 业务代码不应再读取这个标识符（注释/字符串里出现没问题，避免误判）
        # 思路：把所有单行注释和块注释剥掉后再 grep。
        nocmt = re.sub(r"/\*[\s\S]*?\*/", "", self.composer)
        nocmt = re.sub(r"^\s*//.*$", "", nocmt, flags=re.MULTILINE)
        # 字串里 MODEL_OPTIONS 仍可能出现（不影响），但既然没声明，任何"读 MODEL_OPTIONS.find/.map"
        # 都会让 JS runtime 直接 ReferenceError。grep 所有这类访问。
        for pat in (r"\bMODEL_OPTIONS\.find\b", r"\bMODEL_OPTIONS\.map\b",
                    r"\bMODEL_OPTIONS\.forEach\b", r"\bMODEL_OPTIONS\.filter\b",
                    r"\bMODEL_OPTIONS\s*\["):
            self.assertIsNone(re.search(pat, nocmt),
                f"代码（剥注释后）不应再访问 {pat}，会 ReferenceError")

    def test_no_hardcoded_mock_model_labels_in_composer(self):
        # 截图取证里出现的 5 个 mock 字串绝不应作为代码常量留在 jsx 里
        # （注释里写一次说明历史可以；这里只查"真正还在被渲染的 5 项 literal 整块"）。
        mock_strings = [
            '"GPT-4o · RPG"',
            '"Claude Opus 4.1"',
            '"Gemini 3 Flash"',
            '"通义千问 Max"',
            '"DeepSeek R1"',
        ]
        # 用 dict 文字面声明特征 — `id: "...", label: "..."` 这种 — 来定位 literal 数据。
        for s in mock_strings:
            # 业务代码不应出现这种 `label: "GPT-4o · RPG"` 的对象 literal 写法。
            # 注释里出现整个字串没事；只要不是 `label: "..."` 这种 prop 赋值。
            import re
            pat = r'label\s*:\s*' + re.escape(s)
            m = re.search(pat, self.composer)
            self.assertIsNone(m,
                f"composer 还有 `label: {s}` 对象字面量 — 这就是 MODEL_OPTIONS mock 残留")

    def test_game_console_initial_model_not_mock_id(self):
        # 原来 Game Console.html 内联脚本里 useState("gpt-4o-mini-rpg") — 用户截图底部
        # "+ GPT-4o · RPG" 标签就是这个 id 走 MODEL_OPTIONS.find 得到的。
        # 该初始化早已随 html 瘦身搬进 entries/game-console.jsx；断言必须对准真正持有
        # state 的文件 —— html 现在是静态壳，永远不会含这段 JS，检查 html 就是假阳性。
        self.assertNotIn('useState("gpt-4o-mini-rpg")', self.entry,
            "Game Console 初始 model state 不应再用 mock id 'gpt-4o-mini-rpg'")
        self.assertIn("const [model, setModel] = useState(null)", self.entry,
            "Game Console 初始 model state 应是 null，完全由 gameState.app.model 决定，"
            "不能回退到任何写死 id")


if __name__ == "__main__":
    unittest.main(verbosity=2)
