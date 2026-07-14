"""拆库(zh-rp-bench)逐函数审计回灌的三处 bench 真 bug 回归。

① n-gram 窗口 off-by-one:range(len-n) 丢末 gram,恰好 n 长的串产出 0 gram
   → m_prior_echo 对恰 10 字的复读恒漏检、writing Jaccard 系统性偏低。
② run_replay 同名 harness 按名建桶 → 记分卡静默合并(一份 2x cases 一份消失)。
③ judge_dim_prompt 在 judge_pair 的 try/except 之外构造 prompt,None response
   直接 TypeError 炸整批。
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from bench.judge import judge_dim_prompt  # noqa: E402
from bench.metrics import m_degeneration, m_prior_echo  # noqa: E402
from bench.replay import _disambiguate, run_replay  # noqa: E402
from bench.writing import _ngrams  # noqa: E402


class NgramWindowOffByOne(unittest.TestCase):
    def test_exact_n_string_yields_one_gram(self):
        self.assertEqual(_ngrams("abcde", 5), {"abcde"})

    def test_prior_echo_detects_exact_10_char_repeat(self):
        # 恰好 10 字的上一轮回复被逐字复读:旧写法 prev_grams/resp_grams 双空 → 恒 0
        s = "一二三四五六七八九十"
        out = m_prior_echo(s, {"prior_assistant": [s]})
        self.assertEqual(out["echo_ratio"], 1.0)

    def test_degeneration_counts_last_window(self):
        # "abcdefgh"*2 = 16 字,窗口数应为 16-8+1=9(旧写法 8,丢掉末窗口)
        s = "abcdefgh" * 2
        out = m_degeneration(s, {})
        self.assertGreater(out["repeat_ratio"], 0.0)


class _StubHarness:
    def __init__(self, name: str, reply: str):
        self.name = name
        self._reply = reply

    def generate(self, case: dict) -> str:
        return self._reply


class ReplayNameCollision(unittest.TestCase):
    def test_disambiguate_suffixes_duplicates(self):
        names = [n for n, _ in _disambiguate(
            [_StubHarness("recorded(prod)", "a"), _StubHarness("recorded(prod)", "b")])]
        self.assertEqual(len(set(names)), 2)
        self.assertEqual(names[0], "recorded(prod)")

    def test_run_replay_keeps_both_scorecards(self):
        cases = [{"gm_response": "原始回复", "player_input": "你好"}]
        res = run_replay(cases, [_StubHarness("same", "回复甲"), _StubHarness("same", "回复乙")])
        self.assertEqual(len(res["scorecards"]), 2)
        for sc in res["scorecards"].values():
            self.assertEqual(sc.get("n_cases", sc.get("n", 1)), 1)


class JudgePromptNoneSafety(unittest.TestCase):
    def test_none_responses_do_not_raise(self):
        p = judge_dim_prompt("coherence", {}, None, None)
        self.assertIn("【回复 A】", p)


if __name__ == "__main__":
    unittest.main(verbosity=2)
