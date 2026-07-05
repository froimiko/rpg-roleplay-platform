"""tests/unit/test_world_key_llm_confirm.py — world_key 模型 §3 第二层 LLM 窄确认单测。

设计 docs/design/world_key_model_v1.md §3(第二层)/§4。
纯函数层(confirm_segments_llm)全覆盖,call_fn 全部用假闭包,零外网。
"""
from __future__ import annotations

import json
import unittest

from extract.world_key_backfill import classify_segments, confirm_segments_llm


def _seg(ch_min: int, ch_max: int, world_label: str | None, verdict: str = "continuous") -> dict:
    return {"world_label": world_label, "verdict": verdict, "ch_min": ch_min, "ch_max": ch_max}


def _make_call_fn(responses: list[str]):
    """按调用顺序依次返回 responses 里的原始文本(字符串)。用完抛 IndexError。"""
    it = iter(responses)

    def _call(system_prompt: str, user_prompt: str) -> str:
        return next(it)

    return _call


class ConfirmSegmentsLlmNewWorldWithEvidence(unittest.TestCase):
    """LLM 判 new_world 且给出 evidence → 采用判定,起新 world。"""

    def test_new_world_with_evidence_starts_new_world(self):
        segments = [
            _seg(1, 10, None, "continuous"),
            _seg(11, 20, None, "continuous"),  # 结构先验未命中,但 LLM 复核发现是新世界
        ]
        summaries = {i: f"第{i}章:主角在地球上班。" for i in range(1, 11)}
        summaries.update({i: f"第{i}章:主角发现自己穿越到了异世界大陆。" for i in range(11, 21)})
        call_fn = _make_call_fn([
            json.dumps({
                "verdict": "new_world",
                "world_label": "异世界大陆",
                "evidence": "主角发现自己穿越到了异世界大陆",
            }, ensure_ascii=False),
        ])
        out = confirm_segments_llm(segments, summaries, call_fn=call_fn)
        self.assertEqual(len(out), 2)
        self.assertIsNone(out[0]["world_label"])  # 首段无 prev,原样保留
        self.assertEqual(out[1]["verdict"], "new_world")
        self.assertEqual(out[1]["world_label"], "异世界大陆")
        self.assertEqual(out[1]["llm_evidence"], "主角发现自己穿越到了异世界大陆")
        self.assertFalse(out[0]["overcut"])
        self.assertFalse(out[1]["overcut"])


class ConfirmSegmentsLlmNewWorldWithoutEvidence(unittest.TestCase):
    """LLM 判 new_world 但 evidence 为空 → 降级 continuous,不切。"""

    def test_new_world_without_evidence_degrades_to_continuous(self):
        segments = [
            _seg(1, 10, "主世界", "continuous"),
            _seg(11, 20, None, "continuous"),
        ]
        summaries = {i: f"第{i}章摘要" for i in range(1, 21)}
        call_fn = _make_call_fn([
            json.dumps({"verdict": "new_world", "world_label": "某世界", "evidence": ""}),
        ])
        out = confirm_segments_llm(segments, summaries, call_fn=call_fn)
        self.assertEqual(out[1]["verdict"], "continuous")
        self.assertEqual(out[1]["world_label"], "主世界")  # 沿用上段
        self.assertIsNone(out[1]["llm_evidence"])

    def test_new_world_with_whitespace_only_evidence_degrades(self):
        segments = [
            _seg(1, 10, "主世界", "continuous"),
            _seg(11, 20, None, "continuous"),
        ]
        summaries = {i: "" for i in range(1, 21)}
        call_fn = _make_call_fn([
            json.dumps({"verdict": "new_world", "world_label": "某世界", "evidence": "   "}),
        ])
        out = confirm_segments_llm(segments, summaries, call_fn=call_fn)
        self.assertEqual(out[1]["verdict"], "continuous")
        self.assertEqual(out[1]["world_label"], "主世界")


class ConfirmSegmentsLlmTimeSkip(unittest.TestCase):
    """LLM 判 time_skip → 不起新 world,沿用上段 world。"""

    def test_time_skip_does_not_start_new_world(self):
        segments = [
            _seg(1, 10, "副本一", "new_world"),
            _seg(11, 20, None, "continuous"),
        ]
        summaries = {i: f"第{i}章:三年后,主角回到了副本一。" for i in range(1, 21)}
        call_fn = _make_call_fn([
            json.dumps({"verdict": "time_skip", "world_label": "", "evidence": "三年后"}),
        ])
        out = confirm_segments_llm(segments, summaries, call_fn=call_fn)
        self.assertEqual(out[1]["verdict"], "time_skip")
        self.assertEqual(out[1]["world_label"], "副本一")  # 沿用上段 world,不新起
        self.assertEqual(out[1]["llm_evidence"], "三年后")


class ConfirmSegmentsLlmContinuous(unittest.TestCase):
    """LLM 判 continuous → 沿用上段 world。"""

    def test_continuous_carries_forward_world_label(self):
        segments = [
            _seg(1, 10, "副本一", "new_world"),
            _seg(11, 20, None, "continuous"),
        ]
        summaries = {i: f"第{i}章摘要" for i in range(1, 21)}
        call_fn = _make_call_fn([
            json.dumps({"verdict": "continuous", "world_label": "", "evidence": ""}),
        ])
        out = confirm_segments_llm(segments, summaries, call_fn=call_fn)
        self.assertEqual(out[1]["verdict"], "continuous")
        self.assertEqual(out[1]["world_label"], "副本一")


class ConfirmSegmentsLlmCallFnFailure(unittest.TestCase):
    """call_fn 抛异常 / 返回非法 JSON → 该边界降级 continuous,不崩,不中断其它边界。"""

    def test_call_fn_raises_degrades_to_continuous(self):
        segments = [
            _seg(1, 10, "副本一", "new_world"),
            _seg(11, 20, None, "continuous"),
        ]
        summaries = {i: "" for i in range(1, 21)}

        def _boom(system_prompt: str, user_prompt: str) -> str:
            raise RuntimeError("network down")

        out = confirm_segments_llm(segments, summaries, call_fn=_boom)
        self.assertEqual(out[1]["verdict"], "continuous")
        self.assertEqual(out[1]["world_label"], "副本一")
        self.assertIsNone(out[1]["llm_evidence"])

    def test_call_fn_returns_malformed_json_degrades(self):
        segments = [
            _seg(1, 10, "副本一", "new_world"),
            _seg(11, 20, None, "continuous"),
        ]
        summaries = {i: "" for i in range(1, 21)}
        call_fn = _make_call_fn(["不是JSON的自然语言回复"])
        out = confirm_segments_llm(segments, summaries, call_fn=call_fn)
        self.assertEqual(out[1]["verdict"], "continuous")
        self.assertEqual(out[1]["world_label"], "副本一")

    def test_call_fn_returns_invalid_verdict_degrades(self):
        segments = [
            _seg(1, 10, "副本一", "new_world"),
            _seg(11, 20, None, "continuous"),
        ]
        summaries = {i: "" for i in range(1, 21)}
        call_fn = _make_call_fn([
            json.dumps({"verdict": "maybe", "world_label": "", "evidence": "不知道"}),
        ])
        out = confirm_segments_llm(segments, summaries, call_fn=call_fn)
        self.assertEqual(out[1]["verdict"], "continuous")
        self.assertEqual(out[1]["world_label"], "副本一")

    def test_call_fn_returns_non_dict_json_degrades(self):
        segments = [
            _seg(1, 10, "副本一", "new_world"),
            _seg(11, 20, None, "continuous"),
        ]
        summaries = {i: "" for i in range(1, 21)}
        call_fn = _make_call_fn([json.dumps(["not", "a", "dict"])])
        out = confirm_segments_llm(segments, summaries, call_fn=call_fn)
        self.assertEqual(out[1]["verdict"], "continuous")

    def test_multiple_boundaries_one_failure_does_not_stop_others(self):
        """3 段(2 个边界):第一个边界 call_fn 抛异常,第二个边界正常返回 new_world —
        验证异常只影响该边界,不中断整体流程。"""
        segments = [
            _seg(1, 10, None, "continuous"),
            _seg(11, 20, None, "continuous"),
            _seg(21, 30, None, "continuous"),
        ]
        summaries = {i: f"第{i}章摘要,提到了异世界的传送门。" for i in range(1, 31)}
        call_count = {"n": 0}

        def _call(system_prompt: str, user_prompt: str) -> str:
            call_count["n"] += 1
            if call_count["n"] == 1:
                raise RuntimeError("boom")
            return json.dumps({
                "verdict": "new_world",
                "world_label": "异世界",
                "evidence": "提到了异世界的传送门",
            }, ensure_ascii=False)

        out = confirm_segments_llm(segments, summaries, call_fn=_call)
        self.assertEqual(len(out), 3)
        self.assertEqual(out[1]["verdict"], "continuous")  # 第一个边界失败降级
        self.assertIsNone(out[1]["world_label"])
        self.assertEqual(out[2]["verdict"], "new_world")  # 第二个边界成功
        self.assertEqual(out[2]["world_label"], "异世界")


class ConfirmSegmentsLlmOvercutRollback(unittest.TestCase):
    """过切回退:合并后 distinct world 数 ≥ 段数 × 0.8 → 整书退单世界。"""

    def test_overcut_triggers_rollback_to_single_world(self):
        segments = [
            _seg(1, 5, None, "continuous"),
            _seg(6, 10, None, "continuous"),
            _seg(11, 15, None, "continuous"),
            _seg(16, 20, None, "continuous"),
            _seg(21, 25, None, "continuous"),
        ]
        summaries = {i: f"第{i}章:进入了全新的世界" for i in range(1, 26)}
        # 每个边界都判 new_world 且举证,4 个边界 -> 4 个不同 world / 5 段 = 0.8 触发过切
        responses = [
            json.dumps({"verdict": "new_world", "world_label": f"世界{i}", "evidence": "进入了全新的世界"})
            for i in range(1, 5)
        ]
        call_fn = _make_call_fn(responses)
        out = confirm_segments_llm(segments, summaries, call_fn=call_fn)
        self.assertTrue(out[0]["overcut"])
        for s in out:
            self.assertIsNone(s["world_label"])
            self.assertEqual(s["verdict"], "continuous")
            self.assertIsNone(s["llm_evidence"])

    def test_below_overcut_threshold_not_rolled_back(self):
        # 5 段,只 1 个边界判 new_world(1/5=0.2 << 0.8),不触发过切。
        segments = [
            _seg(1, 5, None, "continuous"),
            _seg(6, 10, None, "continuous"),
            _seg(11, 15, None, "continuous"),
            _seg(16, 20, None, "continuous"),
            _seg(21, 25, None, "continuous"),
        ]
        summaries = {i: "" for i in range(1, 26)}
        responses = [
            json.dumps({"verdict": "continuous", "world_label": "", "evidence": ""}),
            json.dumps({"verdict": "new_world", "world_label": "副本X", "evidence": "进入了副本X"}),
            json.dumps({"verdict": "continuous", "world_label": "", "evidence": ""}),
            json.dumps({"verdict": "continuous", "world_label": "", "evidence": ""}),
        ]
        call_fn = _make_call_fn(responses)
        out = confirm_segments_llm(segments, summaries, call_fn=call_fn)
        self.assertFalse(out[0]["overcut"])
        distinct = {s["world_label"] for s in out if s["world_label"]}
        self.assertEqual(distinct, {"副本X"})


class ConfirmSegmentsLlmEmptyAndSingleSegment(unittest.TestCase):
    def test_empty_segments_returns_empty(self):
        call_fn = _make_call_fn([])
        self.assertEqual(confirm_segments_llm([], {}, call_fn=call_fn), [])

    def test_single_segment_no_boundary_no_call(self):
        """只有一段(无边界可问)→ 不调用 call_fn,原样返回。"""
        segments = [_seg(1, 10, None, "continuous")]

        def _should_not_be_called(system_prompt: str, user_prompt: str) -> str:
            raise AssertionError("call_fn 不应被调用——单段无边界")

        out = confirm_segments_llm(segments, {}, call_fn=_should_not_be_called)
        self.assertEqual(len(out), 1)
        self.assertIsNone(out[0]["world_label"])
        self.assertEqual(out[0]["verdict"], "continuous")


class ConfirmSegmentsLlmZeroNetworkFakeCallFn(unittest.TestCase):
    """整合:结构先验(classify_segments)产出的真实段列表接入 confirm_segments_llm,
    call_fn 全假闭包,验证零外网、纯函数端到端可用。"""

    def test_structural_prior_output_feeds_llm_confirm_zero_network(self):
        """复现生产 dry-run 实证(script 133 类)的真实缺口:无卷名(volume_title 空)、
        章标题不命中任何结构先验词表 → 结构先验全 null(§3 第一层力所不及的场景)。
        LLM 窄确认层读 summary 语义(非关键词匹配)补上正确切分。"""
        chapters = []
        for i in range(1, 16):
            chapters.append({
                "chapter_index": i, "title": f"第{i}章",
                "volume_title": "",
                "summary": "主角在公司加班,准备明天的会议。",
            })
        for i in range(16, 24):
            chapters.append({
                "chapter_index": i, "title": f"第{i}章",
                "volume_title": "",
                "summary": "主角睁开眼发现自己躺在陌生的草原上,身边是会说话的狼。",
            })
        structural_segments = classify_segments(chapters)
        # 结构先验层:无卷名 + 章标题/摘要都不含词表关键词,全部退 continuous/null。
        self.assertTrue(all(s["world_label"] is None for s in structural_segments))

        summaries = {c["chapter_index"]: c["summary"] for c in chapters}
        call_fn = _make_call_fn([
            json.dumps({
                "verdict": "new_world",
                "world_label": "会说话的狼的草原",
                "evidence": "主角睁开眼发现自己躺在陌生的草原上,身边是会说话的狼",
            }, ensure_ascii=False),
        ])
        out = confirm_segments_llm(structural_segments, summaries, call_fn=call_fn)
        self.assertEqual(len(out), 2)
        self.assertIsNone(out[0]["world_label"])
        self.assertEqual(out[1]["verdict"], "new_world")
        self.assertEqual(out[1]["world_label"], "会说话的狼的草原")
        self.assertFalse(out[0]["overcut"])


if __name__ == "__main__":
    unittest.main()
