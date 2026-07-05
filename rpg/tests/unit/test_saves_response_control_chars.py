"""Unit tests for platform_app.api._deps._strip_control_chars / json_response.

生产实证:GET /api/saves、POST /api/saves(建档/存档列表)响应体里,某个存档的自由文本
字段(title / player_name / world_time 等,来自玩家手填、LLM 生成、或 SillyTavern PNG
卡片导入)可能带着裸控制字符(\\x00-\\x1f、\\x7f)落库。标准 json.dumps 会正确转义这些
字符 —— 但那依赖【每一个】响应都严格走 jsonable_encoder → json.dumps 这条路径，属于隐式
契约。这里覆盖读出→响应这一层的显式兜底:_strip_control_chars 递归清洗，json_response
在编码后统一应用。

纯本地函数,无 DB / 无网络。
"""
from __future__ import annotations

import json
import unittest

from platform_app.api._deps import _strip_control_chars, json_response


class StripControlCharsBasic(unittest.TestCase):
    def test_clean_string_untouched(self):
        s = "clean string 无脏字符"
        self.assertEqual(_strip_control_chars(s), s)
        # 快路径:无脏字符时应返回同一个对象(不分配新字符串)
        self.assertIs(_strip_control_chars(s), s)

    def test_preserves_tab_newline_cr(self):
        s = "line1\nline2\tindented\r\n"
        self.assertEqual(_strip_control_chars(s), s)

    def test_strips_c0_control_chars(self):
        self.assertEqual(_strip_control_chars("dirty\x01\x02\x1f"), "dirty   ")

    def test_strips_del(self):
        self.assertEqual(_strip_control_chars("del\x7fchar"), "del char")

    def test_non_str_passthrough(self):
        self.assertIsNone(_strip_control_chars(None))
        self.assertEqual(_strip_control_chars(42), 42)
        self.assertEqual(_strip_control_chars(3.14), 3.14)
        self.assertEqual(_strip_control_chars(True), True)

    def test_empty_string(self):
        self.assertEqual(_strip_control_chars(""), "")


class StripControlCharsRecursive(unittest.TestCase):
    def test_recurses_into_dict(self):
        got = _strip_control_chars({"a": "x\x01y", "b": "clean"})
        self.assertEqual(got, {"a": "x y", "b": "clean"})

    def test_recurses_into_list(self):
        got = _strip_control_chars([1, "z\x1fw", None, "clean"])
        self.assertEqual(got, [1, "z w", None, "clean"])

    def test_recurses_into_nested_structure(self):
        payload = {
            "ok": True,
            "items": [
                {"id": 347, "title": "正常存档", "world_time": "第一天"},
                {"id": 350, "title": "损坏\x01标题", "world_time": "第一天\x02\x1f", "player_name": "张三\x7f"},
            ],
        }
        got = _strip_control_chars(payload)
        self.assertEqual(got["items"][0]["title"], "正常存档")
        self.assertEqual(got["items"][1]["title"], "损坏 标题")
        self.assertEqual(got["items"][1]["world_time"], "第一天  ")
        self.assertEqual(got["items"][1]["player_name"], "张三 ")

    def test_recurses_into_tuple(self):
        got = _strip_control_chars(("a\x01b", "clean"))
        self.assertEqual(got, ("a b", "clean"))


class JsonResponseEndToEnd(unittest.TestCase):
    """完整走 json_response():编码后的字节必须能被标准 json.loads 无异常解析,
    且裸控制字符(\\t\\n\\r 除外)不得出现在响应体里。"""

    def _assert_no_raw_control_bytes(self, body: bytes):
        legit = {0x09, 0x0A, 0x0D}  # \t \n \r 是合法的 JSON 转义之外的...实际上 JSON 规范
        # 要求字符串内的控制字符必须转义,连 \t\n\r 也不例外;json.dumps 总会转义它们。
        # 这里只断言 encoder 输出里不残留任何裸 0x00-0x1f 字节(不区分 legit 与否),
        # 因为标准 json.dumps 从不会把它们原样写出。
        raw_ctrl = [i for i, b in enumerate(body) if b < 0x20]
        self.assertEqual(raw_ctrl, [], f"响应体含裸控制字节 @ {raw_ctrl}")

    def test_dirty_save_row_list_response_parses(self):
        row_347 = {
            "id": 347, "title": "正常存档", "player_name": "李四",
            "world_time": "第三天", "history_count": 10,
        }
        row_350 = {
            "id": 350, "title": "我的存档\x01损坏标题", "player_name": "张三\x0b\x7f",
            "world_time": "第一天\x01\x02\x1f", "history_count": 3,
        }
        resp = json_response({"ok": True, "items": [row_347, row_350]})
        body = resp.body
        self._assert_no_raw_control_bytes(body)
        parsed = json.loads(body)  # 必须不抛 "Invalid control character"
        self.assertEqual(parsed["items"][0]["title"], "正常存档")
        self.assertEqual(parsed["items"][1]["title"], "我的存档 损坏标题")
        self.assertEqual(parsed["items"][1]["player_name"], "张三  ")
        self.assertEqual(parsed["items"][1]["world_time"], "第一天   ")

    def test_dirty_save_detail_response_parses(self):
        save = {
            "id": 350,
            "title": "标题\x1f带脏字符",
            "state_snapshot": {
                "player": {"name": "玩家\x01名", "background": "背景\x02故事"},
                "world": {"time": "世界时间\x1b"},
            },
        }
        resp = json_response({"ok": True, "save": save})
        body = resp.body
        self._assert_no_raw_control_bytes(body)
        parsed = json.loads(body)
        self.assertEqual(parsed["save"]["title"], "标题 带脏字符")
        self.assertEqual(parsed["save"]["state_snapshot"]["player"]["name"], "玩家 名")
        self.assertEqual(parsed["save"]["state_snapshot"]["player"]["background"], "背景 故事")
        self.assertEqual(parsed["save"]["state_snapshot"]["world"]["time"], "世界时间 ")

    def test_create_save_response_parses(self):
        # 模拟 POST /api/saves 的返回形状(create_save 直接回 expose(save) 整行)
        save = {
            "id": 351, "public_id": "uid-abc", "user_id": 1, "script_id": 7,
            "title": "新存档\x00带 NUL",
            "state_path": "save.json", "row_version": 1,
        }
        resp = json_response({"ok": True, "save": save})
        body = resp.body
        self._assert_no_raw_control_bytes(body)
        parsed = json.loads(body)
        self.assertEqual(parsed["save"]["title"], "新存档 带 NUL")

    def test_clean_response_unaffected(self):
        """回归:干净数据的响应形状/取值不受影响(零行为变化)。"""
        clean = {"ok": True, "items": [{"id": 1, "title": "正常标题", "count": 5, "flag": True, "extra": None}]}
        resp = json_response(clean)
        parsed = json.loads(resp.body)
        self.assertEqual(parsed["items"][0]["title"], "正常标题")
        self.assertEqual(parsed["items"][0]["count"], 5)
        self.assertTrue(parsed["items"][0]["flag"])
        self.assertIsNone(parsed["items"][0]["extra"])
        # meta 字段仍照常被 json_response 补齐
        self.assertEqual(parsed["meta"]["api_version"], "1")

    def test_preserves_legit_whitespace_in_multiline_text(self):
        """title/background 等自由文本里合法的换行/制表符不应被误伤。"""
        save = {"id": 1, "title": "标题", "background": "第一行\n第二行\t缩进"}
        resp = json_response({"ok": True, "save": save})
        parsed = json.loads(resp.body)
        self.assertEqual(parsed["save"]["background"], "第一行\n第二行\t缩进")


if __name__ == "__main__":
    unittest.main()
