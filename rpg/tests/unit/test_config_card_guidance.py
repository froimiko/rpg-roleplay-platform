"""test_config_card_guidance — 对话内「模型/Key 配置引导」后端单测。

覆盖:
  1. request_user_config 工具注册(scope=save, origins={llm_chat}, 非破坏)
  2. config_card pending_question 形状(契约,前端据此渲染)
  3. request_user_config 三态:已配置→不写卡 / 有凭证未设默认→ask_default / 无凭证→missing_key
  4. generate_image 入队前配置门控:
       (a) 指定模型不在 catalog → model_not_configured(hard)+不入队
       (b) 未指定模型+无默认+有凭证 → ask_default+不入队
       (c) 未指定模型+无默认+无凭证 → missing_key+不入队
       (d) 已配置(有默认)→ 正常入队(原行为不破坏)
       (e) ui_button origin → 不弹卡,直接走原逻辑(即使无默认)

全程不打真 DB:patch _resolve_user_id / llm_backend 解析函数 / enqueue。
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[2]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

os.environ.setdefault("RPG_REQUIRE_AUTH", "0")


class _MinimalState:
    """最小 state:只暴露 executor 用到的 state.data。"""

    def __init__(self, data: dict | None = None):
        self.data = data if data is not None else {}


def _pending_cards(state) -> list:
    return (state.data.get("permissions") or {}).get("pending_questions") or []


# ══════════════════════════════════════════════════════════════════════
# 1. 工具注册
# ══════════════════════════════════════════════════════════════════════

class TestToolRegistered(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from tools_dsl.command_tools_register import force_reset_for_tests
        force_reset_for_tests()

    def test_request_user_config_registered(self):
        from tools_dsl.command_dispatcher import get_registry
        reg = get_registry()
        self.assertTrue(reg.has("request_user_config"))
        spec = reg.get("request_user_config")
        self.assertEqual(spec.scope, "save")
        self.assertEqual(set(spec.origins), {"llm_chat"})
        self.assertFalse(spec.destructive)
        # schema: capability enum + required
        props = spec.input_schema["properties"]
        self.assertEqual(set(props["capability"]["enum"]), {"image", "embedding", "llm"})
        self.assertEqual(spec.input_schema["required"], ["capability"])


# ══════════════════════════════════════════════════════════════════════
# 2. config_card 形状契约
# ══════════════════════════════════════════════════════════════════════

class TestConfigCardShape(unittest.TestCase):
    def test_shape_exact(self):
        from tools_dsl.command_tools_image import append_config_card
        state = _MinimalState({"turn": 7, "permissions": {}})
        cid = append_config_card(
            state,
            capability="image",
            mode="ask_default",
            model="doubao-seedream-4-x",
            api_id="doubao",
            hard=False,
            question="测试问题",
            options=["A", "B"],
        )
        cards = _pending_cards(state)
        self.assertEqual(len(cards), 1)
        card = cards[0]
        self.assertEqual(card["id"], cid)
        self.assertTrue(card["id"].startswith("cfg_"))
        self.assertEqual(card["kind"], "config_card")
        self.assertEqual(card["capability"], "image")
        self.assertEqual(card["mode"], "ask_default")
        self.assertEqual(card["model"], "doubao-seedream-4-x")
        self.assertEqual(card["api_id"], "doubao")
        self.assertIs(card["hard"], False)
        self.assertEqual(card["question"], "测试问题")
        self.assertEqual(card["options"], ["A", "B"])
        self.assertEqual(card["source"], "agent:config_card")
        self.assertEqual(card["turn"], 7)
        # 完整键集合(冻结契约)
        self.assertEqual(
            set(card.keys()),
            {"id", "kind", "capability", "mode", "model", "api_id",
             "hard", "question", "options", "source", "turn"},
        )

    def test_defaults_empty_strings(self):
        from tools_dsl.command_tools_image import append_config_card
        state = _MinimalState({"permissions": {}})  # turn 缺省 → 0
        append_config_card(
            state, capability="llm", mode="missing_key", hard=False,
            question="缺 key",
        )
        card = _pending_cards(state)[0]
        self.assertEqual(card["model"], "")
        self.assertEqual(card["api_id"], "")
        self.assertEqual(card["options"], [])
        self.assertEqual(card["turn"], 0)


# ══════════════════════════════════════════════════════════════════════
# 3. request_user_config 三态
# ══════════════════════════════════════════════════════════════════════

class TestRequestUserConfig(unittest.TestCase):
    def _run(self, capability, *, pref_model, first_model):
        from tools_dsl.command_tools_config import _execute_request_user_config
        state = _MinimalState({"turn": 2, "permissions": {}})
        args = {"capability": capability, "save_id": 100}
        with patch("tools_dsl.command_tools_tavern._resolve_user_id", return_value=42), \
             patch("core.llm_backend.resolve_preferred_model", return_value=pref_model), \
             patch("core.llm_backend.first_user_model", return_value=first_model):
            result = _execute_request_user_config(state, args)
        return result, _pending_cards(state)

    def test_already_configured_no_card(self):
        result, cards = self._run(
            "image", pref_model="doubao-seedream-4-x", first_model=("doubao", "x"))
        self.assertIn("已配置", result)
        self.assertEqual(cards, [])

    def test_has_credential_ask_default(self):
        result, cards = self._run(
            "image", pref_model=None, first_model=("doubao", "doubao-seedream-4-x"))
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["mode"], "ask_default")
        self.assertEqual(cards[0]["model"], "doubao-seedream-4-x")
        self.assertEqual(cards[0]["api_id"], "doubao")
        self.assertEqual(cards[0]["capability"], "image")
        self.assertIs(cards[0]["hard"], False)

    def test_no_credential_missing_key(self):
        result, cards = self._run("embedding", pref_model=None, first_model=None)
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["mode"], "missing_key")
        self.assertEqual(cards[0]["capability"], "embedding")
        self.assertEqual(cards[0]["model"], "")
        self.assertIs(cards[0]["hard"], False)

    def test_bad_capability(self):
        from tools_dsl.command_tools_config import _execute_request_user_config
        state = _MinimalState({"permissions": {}})
        with patch("tools_dsl.command_tools_tavern._resolve_user_id", return_value=42):
            result = _execute_request_user_config(state, {"capability": "video", "save_id": 1})
        self.assertTrue(result.startswith("失败"))
        self.assertEqual(_pending_cards(state), [])


# ══════════════════════════════════════════════════════════════════════
# 4. generate_image 入队前配置门控
# ══════════════════════════════════════════════════════════════════════

class TestGenerateImageConfigGate(unittest.TestCase):
    def _state(self):
        return _MinimalState({"_turn_images_generated": 0, "permissions": {}, "turn": 1})

    def _patches(self, *, user_id=42, in_catalog=True, pref_model=None, first_model=None,
                 enqueue_ret=None):
        """统一 patch 集:user_id 反查(在 image 模块内的 DB 反查) + llm_backend + enqueue。

        _execute_generate_image 用自带的 save_id→user_id DB 反查,这里直接 patch
        platform_app.image_jobs.enqueue_image_generation + DB connect 链路太重,改为
        patch image 模块里实际调用的符号:user_id 通过 patch connect 不便,故 patch
        模块级的 `connect`/`init_db` 让反查命中我们的 fake user_id。
        """
        return patch.multiple(
            "core.llm_backend",
            _model_in_catalog=lambda uid, m: in_catalog,
            resolve_preferred_model=lambda uid, key=None: pref_model,
            first_user_model=lambda uid, api_id=None: first_model,
        )

    def _fake_uid_db(self, user_id=42):
        """patch image 模块里的 save_id→user_id 反查,返回固定 user_id,不打真 DB。"""
        class _Cur:
            def fetchone(self_inner):
                return {"user_id": user_id}

        class _DB:
            def execute(self_inner, *a, **k):
                return _Cur()

            def __enter__(self_inner):
                return self_inner

            def __exit__(self_inner, *a):
                return False

        import contextlib

        @contextlib.contextmanager
        def _connect():
            yield _DB()

        return patch("platform_app.db.connect", _connect), patch("platform_app.db.init_db", lambda: None)

    def test_a_model_not_in_catalog_hard(self):
        from tools_dsl.command_tools_image import _execute_generate_image
        state = self._state()
        c1, c2 = self._fake_uid_db()
        with c1, c2, self._patches(in_catalog=False):
            result = _execute_generate_image(state, {
                "prompt": "x", "model": "ghost-model", "api_id": "doubao",
                "__call_origin__": "llm_chat", "save_id": 100,
            })
        cards = _pending_cards(state)
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["mode"], "model_not_configured")
        self.assertEqual(cards[0]["capability"], "image")
        self.assertEqual(cards[0]["model"], "ghost-model")
        self.assertEqual(cards[0]["api_id"], "doubao")
        self.assertIs(cards[0]["hard"], True)
        self.assertIn("已暂停", result)
        # 不应改计数(没入队)
        self.assertEqual(state.data["_turn_images_generated"], 0)

    def test_b_no_model_no_default_has_credential_ask(self):
        from tools_dsl.command_tools_image import _execute_generate_image
        state = self._state()
        c1, c2 = self._fake_uid_db()
        with c1, c2, self._patches(pref_model=None, first_model=("doubao", "doubao-seedream-4-x")):
            result = _execute_generate_image(state, {
                "prompt": "x", "__call_origin__": "llm_chat", "save_id": 100,
            })
        cards = _pending_cards(state)
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["mode"], "ask_default")
        self.assertEqual(cards[0]["model"], "doubao-seedream-4-x")
        self.assertEqual(cards[0]["api_id"], "doubao")
        self.assertIs(cards[0]["hard"], False)
        self.assertIn("待确认", result)
        self.assertEqual(state.data["_turn_images_generated"], 0)

    def test_c_no_model_no_default_no_credential_missing_key(self):
        from tools_dsl.command_tools_image import _execute_generate_image
        state = self._state()
        c1, c2 = self._fake_uid_db()
        with c1, c2, self._patches(pref_model=None, first_model=None):
            result = _execute_generate_image(state, {
                "prompt": "x", "__call_origin__": "llm_chat", "save_id": 100,
            })
        cards = _pending_cards(state)
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["mode"], "missing_key")
        self.assertEqual(cards[0]["model"], "")
        self.assertIs(cards[0]["hard"], False)
        self.assertEqual(state.data["_turn_images_generated"], 0)

    def test_d_configured_enqueues(self):
        """已设默认模型 → 不弹卡,走原逻辑入队。"""
        from tools_dsl.command_tools_image import _execute_generate_image
        state = self._state()
        c1, c2 = self._fake_uid_db()
        enq_calls = []

        def _fake_enqueue(*a, **k):
            enq_calls.append((a, k))
            return {"image_id": 999, "status": "pending"}

        with c1, c2, self._patches(pref_model="doubao-seedream-4-x"), \
                patch("platform_app.image_jobs.enqueue_image_generation", _fake_enqueue):
            result = _execute_generate_image(state, {
                "prompt": "x", "__call_origin__": "llm_chat", "save_id": 100,
            })
        self.assertEqual(_pending_cards(state), [])
        self.assertEqual(len(enq_calls), 1)
        self.assertEqual(state.data["_turn_images_generated"], 1)
        self.assertIn("image_id=999", result)

    def test_e_ui_button_skips_gate(self):
        """ui_button origin 不弹配置卡,即使无默认 → 直接入队(原逻辑)。"""
        from tools_dsl.command_tools_image import _execute_generate_image
        state = self._state()
        c1, c2 = self._fake_uid_db()
        enq_calls = []

        def _fake_enqueue(*a, **k):
            enq_calls.append((a, k))
            return {"image_id": 1001, "status": "pending"}

        with c1, c2, self._patches(pref_model=None, first_model=None), \
                patch("platform_app.image_jobs.enqueue_image_generation", _fake_enqueue):
            result = _execute_generate_image(state, {
                "prompt": "x", "__call_origin__": "ui_button", "save_id": 100,
            })
        self.assertEqual(_pending_cards(state), [])  # 无卡
        self.assertEqual(len(enq_calls), 1)  # 直接入队
        self.assertIn("image_id=1001", result)


if __name__ == "__main__":
    unittest.main(verbosity=2)
