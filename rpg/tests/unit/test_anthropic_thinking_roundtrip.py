"""Anthropic backend Extended Thinking(工具循环)回归。

三后端对齐补全:此前 anthropic 的 stream_with_tools_native(GM 工具循环热路径)刻意不启用
thinking——原因是 thinking+tool_use 时 Anthropic 硬性要求把每个含 thinking block 的 assistant
回合(连 signature)原样装回后续请求的 messages,否则 400。本批次补齐 round-trip 后启用。

本测试用「faked-stream」锁死:
  1. 两轮工具循环,轮1 的 thinking block(含 signature)在轮2 请求历史里**原样存在且置首**。
  2. thinking_delta → yield {"type":"reasoning","text":...} 事件(形态对齐 openai_compat/vertex),
     且 thinking_block 事件不外泄到消费侧、思考不混入正文。
  3. redacted_thinking 同样 round-trip 保留,但**绝不**作为 reasoning 展示。
  4. budget=0/None 时不带 thinking 参数(保持关闭语义)。

mock 风格对齐 test_backend_asymmetry_fixes.py(__new__ 跳过需 API key 的 __init__ + 脚本化 client)。
"""
from __future__ import annotations

import os

os.environ.setdefault("RPG_DEPLOYMENT_MODE", "local")


# ── 事件工厂(仿 Anthropic SDK 流式事件的鸭子类型:.type / .content_block / .delta) ──

def _ev(**kw):
    return type("Ev", (), kw)()


def _cbs_thinking():
    return _ev(type="content_block_start", content_block=_ev(type="thinking"))


def _cbs_redacted(data):
    return _ev(type="content_block_start", content_block=_ev(type="redacted_thinking", data=data))


def _cbs_tool(tid, name):
    return _ev(type="content_block_start", content_block=_ev(type="tool_use", id=tid, name=name))


def _cbs_text():
    return _ev(type="content_block_start", content_block=_ev(type="text"))


def _cbd_thinking(text):
    return _ev(type="content_block_delta", delta=_ev(type="thinking_delta", thinking=text))


def _cbd_signature(sig):
    return _ev(type="content_block_delta", delta=_ev(type="signature_delta", signature=sig))


def _cbd_json(pj):
    return _ev(type="content_block_delta", delta=_ev(type="input_json_delta", partial_json=pj))


def _cbd_text(t):
    return _ev(type="content_block_delta", delta=_ev(type="text_delta", text=t))


def _cb_stop():
    return _ev(type="content_block_stop")


def _msg_delta(stop_reason):
    return _ev(type="message_delta", delta=_ev(stop_reason=stop_reason))


# ── 假 Anthropic client(捕获每次 messages.stream 的 kwargs) ──────────────────

class _FakeStreamCtx:
    def __init__(self, events, final):
        self._events = events
        self._final = final

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def __iter__(self):
        return iter(self._events)

    def get_final_message(self):
        return self._final


class _FakeMessages:
    def __init__(self, scripts):
        self._scripts = list(scripts)
        self._i = 0
        self.calls: list[dict] = []  # 每次 stream() 的 kwargs

    def stream(self, **kwargs):
        self.calls.append(kwargs)
        events, final = self._scripts[self._i]
        self._i += 1
        return _FakeStreamCtx(events, final)


class _FakeClient:
    def __init__(self, scripts):
        self.messages = _FakeMessages(scripts)


def _make_anthropic(scripts, thinking):
    from agents.gm.backends.anthropic import _AnthropicBackend
    be = _AnthropicBackend.__new__(_AnthropicBackend)  # 跳过 __init__(无需 API key)
    be.model_name = "claude-sonnet-4-6"
    be.user_id = None
    be.last_usage = {}
    be.client = _FakeClient(scripts)
    # 确定化:直接固定 thinking 参数,不依赖 DB 里的 effort 偏好。
    be._thinking_param = lambda: thinking  # type: ignore[method-assign]
    return be


_MCP_TOOLS = [{
    "server_id": "srv", "name": "do_thing",
    "schema": {"type": "object", "properties": {}}, "description": "d",
}]
_TOOL_FULL = "srv__do_thing"


# ── 修1 核心:thinking block round-trip(两轮工具循环) ──────────────────────

def test_anthropic_thinking_roundtrip_two_iterations():
    scripts = [
        # 轮1:thinking block(带 signature) + tool_use(srv__do_thing)
        ([
            _cbs_thinking(),
            _cbd_thinking("我先想一下。"),
            _cbd_signature("SIG-ABC"),
            _cb_stop(),
            _cbs_tool("tu1", _TOOL_FULL),
            _cbd_json('{"x": 1}'),
            _cb_stop(),
            _msg_delta("tool_use"),
        ], _ev(usage=None, stop_reason="tool_use")),
        # 轮2:thinking block + 文本收尾,无 tool_use → 循环结束
        ([
            _cbs_thinking(),
            _cbd_thinking("好了。"),
            _cbd_signature("SIG-XYZ"),
            _cb_stop(),
            _cbs_text(),
            _cbd_text("完成。"),
            _cb_stop(),
            _msg_delta("end_turn"),
        ], _ev(usage=None, stop_reason="end_turn")),
    ]
    be = _make_anthropic(scripts, thinking={"type": "enabled", "budget_tokens": 8192})

    dispatched: list[tuple] = []

    def fake_mcp(sid, tname, args):
        dispatched.append((sid, tname, args))
        return {"ok": True, "result": "ok"}

    events = list(be.stream_with_mcp_loop(
        "sys", [{"role": "user", "content": "hi"}], _MCP_TOOLS, 4, 256, fake_mcp))

    calls = be.client.messages.calls
    assert len(calls) == 2, "应发出两轮请求"

    # 轮1 请求带 thinking 参数;max_tokens 抬到 budget+1024 以上(thinking 模型硬约束)
    assert calls[0].get("thinking") == {"type": "enabled", "budget_tokens": 8192}
    assert calls[0]["max_tokens"] >= 8192 + 1024

    # 轮2 请求历史里,轮1 的 thinking block 原样存在(含 signature)且置于 content 首位
    assistants = [m for m in calls[1]["messages"] if m["role"] == "assistant"]
    assert assistants, "轮2 应含轮1 的 assistant 回合"
    a_content = assistants[0]["content"]
    assert a_content[0] == {
        "type": "thinking", "thinking": "我先想一下。", "signature": "SIG-ABC",
    }, a_content
    # tool_use block 紧随其后(顺序:thinking → tool_use)
    assert any(b.get("type") == "tool_use" and b.get("name") == _TOOL_FULL for b in a_content)

    # 工具被真正 dispatch(load_tools 之外),参数解析正确
    assert ("srv", "do_thing", {"x": 1}) in dispatched

    # 修:reasoning 事件接通——两轮思考都产出 {"type":"reasoning","text":...}
    reasoning_texts = [e["text"] for e in events if e.get("type") == "reasoning"]
    assert "我先想一下。" in reasoning_texts
    assert "好了。" in reasoning_texts
    # thinking_block 事件不外泄到消费侧(仅内部 round-trip 用)
    assert all(e.get("type") != "thinking_block" for e in events)
    # 思考绝不混入正文:text 事件只含叙事
    text_out = "".join(e["text"] for e in events if e.get("type") == "text")
    assert text_out == "完成。"


# ── redacted_thinking:round-trip 保留,但不展示为 reasoning ──────────────────

def test_anthropic_redacted_thinking_roundtrip_not_shown():
    scripts = [
        # 轮1:redacted_thinking(加密块,data 在 start 即完整) + tool_use
        ([
            _cbs_redacted("ENCRYPTED_BLOB_XYZ"),
            _cb_stop(),
            _cbs_tool("tu1", _TOOL_FULL),
            _cbd_json("{}"),
            _cb_stop(),
            _msg_delta("tool_use"),
        ], _ev(usage=None, stop_reason="tool_use")),
        # 轮2:纯文本收尾
        ([
            _cbs_text(),
            _cbd_text("done"),
            _cb_stop(),
            _msg_delta("end_turn"),
        ], _ev(usage=None, stop_reason="end_turn")),
    ]
    be = _make_anthropic(scripts, thinking={"type": "enabled", "budget_tokens": 4096})

    events = list(be.stream_with_mcp_loop(
        "sys", [{"role": "user", "content": "hi"}], _MCP_TOOLS, 4, 256,
        lambda *a: {"ok": True, "result": "ok"}))

    calls = be.client.messages.calls
    # 轮2 历史里 redacted_thinking 原样保留(round-trip),置于 content 首位
    a_content = [m for m in calls[1]["messages"] if m["role"] == "assistant"][0]["content"]
    assert a_content[0] == {"type": "redacted_thinking", "data": "ENCRYPTED_BLOB_XYZ"}, a_content
    # redacted_thinking 绝不作为 reasoning 展示
    assert all(e.get("type") != "reasoning" for e in events)


# ── budget=0/None:不带 thinking 参数(保持关闭语义) ────────────────────────

def test_anthropic_tool_loop_no_thinking_when_budget_off():
    scripts = [
        ([
            _cbs_text(),
            _cbd_text("hi"),
            _cb_stop(),
            _msg_delta("end_turn"),
        ], _ev(usage=None, stop_reason="end_turn")),
    ]
    be = _make_anthropic(scripts, thinking=None)  # effort=off → _thinking_param 返 None

    list(be.stream_with_mcp_loop(
        "sys", [{"role": "user", "content": "hi"}], _MCP_TOOLS, 2, 256,
        lambda *a: {"ok": True, "result": "ok"}))

    call = be.client.messages.calls[0]
    assert "thinking" not in call, "budget=0/None 时不应带 thinking 参数"
