"""
test_api_models_envelope.py — /api/models 响应 shape 是 {ok, models: catalog, selected}。

FE 历史上写过 `data?.apis || data?.models` 这种"扁平 fallback"，把整个 catalog 对象
当作数组传给 setApis → 后续 apis.find 抛 TypeError → 整页 React 树崩溃，
就是用户截图里 Platform.html#settings 的 ExtractorSection 报的『apis.find is not a function』。

本测试既锁定后端 shape（防 backend 退回扁平），又锁定 FE 各引用点都正确解嵌套。
"""
from __future__ import annotations

import unittest
from pathlib import Path

from tests.helpers import make_client, register_user


class ModelsEndpointShape(unittest.TestCase):
    def test_api_models_returns_nested_envelope(self):
        client = make_client()
        u = register_user(client)
        r = client.get("/api/v1/models", cookies=u["cookies"])
        self.assertEqual(r.status_code, 200, r.text[:300])
        body = r.json()
        # 形态：{ok, models: catalog, selected}
        self.assertTrue(body.get("ok"))
        catalog = body.get("models") or {}
        self.assertIn("apis", catalog,
            "/api/v1/models 嵌套 models.apis 必须存在；FE ExtractorSection / ModelPopover 都从这里取。")
        self.assertIsInstance(catalog["apis"], list)


class FrontendUnwrapsModelsEnvelope(unittest.TestCase):
    """ExtractorSection / ApisSection / ModelPopover 必须先解 .models.apis 嵌套。

    2026-07 更新：ModelPopover(现住 components/game/GameComposerPopovers.jsx）自
    commit 716b4278e 起不再自己拉 /api/models 解嵌套 —— 整体委托给
    components/AgentModelPicker.jsx(variant="popover")，真正的 envelope 解析逻辑
    住在 AgentModelPicker 自己的数据拉取 effect 里。断言随之改指向这条真实缝。"""

    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[3] / "frontend" / "src"
        cls.platform = (root / "platform-app.jsx").read_text(encoding="utf-8")
        cls.composer = (root / "game-composer.jsx").read_text(encoding="utf-8")
        cls.popovers = (root / "components" / "game" / "GameComposerPopovers.jsx").read_text(encoding="utf-8")
        cls.picker = (root / "components" / "AgentModelPicker.jsx").read_text(encoding="utf-8")

    def test_extractor_section_unwraps_nested(self):
        # 找 ExtractorSection 函数体内的 setApis 调用上下文
        idx = self.platform.find("function ExtractorSection")
        self.assertGreater(idx, 0)
        # 找紧接着的下一个 function 边界
        end = self.platform.find("\nfunction ", idx + 1)
        if end < 0:
            end = len(self.platform)
        body = self.platform[idx:end]
        # 旧错误模式：`const list = models?.apis || models?.models || []`
        # —— models.apis 不存在时把整个 catalog 对象作为 list，进入 setApis 后炸。
        self.assertNotIn("models?.apis || models?.models", body,
            "ExtractorSection 不应再用扁平 fallback，先取 models?.models?.apis")
        self.assertIn("models?.models?.apis", body,
            "ExtractorSection 必须先尝试 models?.models?.apis 解嵌套")
        self.assertIn("Array.isArray", body,
            "ExtractorSection setApis 之前必须 Array.isArray 校验")

    def test_apis_section_unwraps_nested(self):
        # ApisSection 在 platform-app.jsx 另一处（line ~5060），同样的 fix
        # 用更精确 marker：data?.apis || data?.models 之前是这处。
        self.assertNotIn("data?.apis || data?.models", self.platform,
            "ApisSection 也不应再用扁平 fallback")
        self.assertIn("data?.models?.apis", self.platform,
            "ApisSection 必须解 data.models.apis")

    def test_model_popover_unwraps_response(self):
        # ModelPopover 本身早已不再拉 /api/models —— 它把整个数据源委托给
        # AgentModelPicker(variant="popover")。先确认委托接线没有被静默改回
        #「自己再实现一份 catalog 解析」，再验证真正的 envelope 解嵌套逻辑
        # （models?.models?.apis 优先、Array.isArray 校验）住在 AgentModelPicker 里。
        idx = self.popovers.find("function ModelPopover")
        self.assertGreater(idx, 0)
        end = self.popovers.find("\nfunction ", idx + 1)
        if end < 0:
            end = len(self.popovers)
        popover_body = self.popovers[idx:end]
        self.assertIn("<AgentModelPicker", popover_body,
            "ModelPopover 必须委托给 AgentModelPicker，不应自己再实现一份 catalog 解析")

        fetch_idx = self.picker.find("window.api.models.list()")
        self.assertGreater(fetch_idx, 0,
            "AgentModelPicker 应调用真后端 GET /api/models(models.list())")
        fetch_body = self.picker[fetch_idx: fetch_idx + 600]
        self.assertIn("models?.models?.apis", fetch_body,
            "AgentModelPicker 必须先尝试嵌套 models.models.apis（真 catalog envelope）")
        self.assertIn("Array.isArray(models?.apis) ? models.apis : []", fetch_body,
            "扁平 fallback 必须先经 Array.isArray 校验，不能把整个 catalog 对象当数组")
        self.assertIn("Array.isArray(list)", fetch_body,
            "setApis 前必须再次确认最终结果是 Array，防止 catalog.find 之类 TypeError")


if __name__ == "__main__":
    unittest.main(verbosity=2)
