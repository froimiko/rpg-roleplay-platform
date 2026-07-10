"""RATH 离线活世界两处 flash 结构化产出接入空正文护栏 + 禁深思回归测试(2026-07-10)。

RATH tick 内两处产出均为 schema 验收的有界结构化 JSON(调度 rath_scheduler / 呈现
rath_director,不是长文),正属 268 实锤族「思考模型跑结构化微任务无界思考吃光
max_tokens 正文恒空」的靶心:必须走 call_agent_json_guarded(no_think=True 第一跳就禁
深思 + 空正文扩预算重试一次并留痕),绝不裸调 call_agent_json 让空正文被验收器静默
当「输出不可解析」丢弃(那样等于每拍白烧一次 flash 还无声退化)。

本文件两层:
1. 行为烟测:按 engine 真实调用形状直调 call_agent_json_guarded,断言底层捕获
   no_think is True——只烟测 harness 链路对 rath 这组 kwargs 可用。护栏编排全谱
   (透传/扩预算/重试/异常)已由 test_harness_empty_guard.py 覆盖,此处不复刻。
2. 接线锁:engine.tick 依赖 DB/认领等重夹具,整只 tick 起不起来不经济,故用
   inspect.getsource 断言两处调用已换名并各自带 no_think=True 与对应 log_tag、
   且零裸调残留(invocation 级测试不经济,以接线锁替代)。
"""
import inspect

from agents import _harness


def test_rath_scheduler_shape_carries_no_think(monkeypatch):
    """按 engine 调度(LLM-A)真实调用形状直调护栏 → 底层收到 no_think is True。
    只烟测 harness 链路对 rath_scheduler 这组 kwargs 可用(护栏全谱见 empty_guard)。"""
    captured = {}

    def fake(api_id, model, system_prompt, user_prompt, user_id, **kw):
        captured.update(kw)
        return ("PAYLOAD", {"output_tokens": 1})

    monkeypatch.setattr(_harness, "call_agent_json", fake)
    text, _ = _harness.call_agent_json_guarded(
        "relay", "m", "s", "u", 1,
        tool_schema=None, max_tokens=1600, timeout_sec=60,
        no_think=True, agent_kind="rath_scheduler", log_tag="rath_scheduler",
    )
    assert text == "PAYLOAD"
    assert captured["no_think"] is True
    assert captured["agent_kind"] == "rath_scheduler"
    # 护栏专属 kwargs 不得泄漏进底层
    assert "log_tag" not in captured


def test_engine_wires_guarded_no_think_both_calls():
    """接线锁:rath.engine 两处 flash 产出必须已接护栏。

    读 engine 模块源码断言:① 裸 call_agent_json( 出现 0 次(全部换名);
    ② call_agent_json_guarded( 恰好 2 次;③ 两处调用文本各含 no_think=True 与
    对应 log_tag。tick 需真 DB/认领,invocation 级测试不经济,以源码接线锁兜回归。"""
    import rath.engine as engine_mod
    src = inspect.getsource(engine_mod)

    # call_agent_json( 不是 call_agent_json_guarded( 的子串('json(' 后紧跟 '(',
    # guarded 变体 'json_guarded(' 处 'json' 后是 '_',故此计数只数裸调。
    assert src.count("call_agent_json(") == 0, "engine 不得残留裸 call_agent_json( 调用"
    assert src.count("call_agent_json_guarded(") == 2, "两处 flash 产出各接一次护栏"

    # 每处护栏调用都要禁深思
    assert src.count("no_think=True") >= 2
    # 两个业务标签各出现(用于告警定位到具体 flash 段)
    assert 'log_tag="rath_scheduler"' in src
    assert 'log_tag="rath_director"' in src
