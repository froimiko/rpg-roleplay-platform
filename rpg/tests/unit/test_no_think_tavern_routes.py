"""routes/tavern.py 结构化微任务禁深思 + 空正文护栏回归测试(268 实锤族,2026-07-10)。

酒馆两条有界 JSON 微产出端点会喂给用户 BYOK 的思考模型:
- api_tavern_autotitle:{"title": 4-14 字},max_tokens=64 —— 思考模型 64 预算必全被
  reasoning 吃光,正文恒空(最典型受害者);
- api_tavern_ai_reply:{"reply": 一到三句},max_tokens=400。

两处已从裸 call_agent_json 换成 call_agent_json_guarded(no_think=True):
1. 第一跳请求体禁深思(no_think 透传 → thinking.disabled);
2. 空正文不静默当「无结果」—— 扩预算 max(2x,1200) 重试一次(护栏在 _harness 内)。

本文件用 asyncio.run 直调 async handler(仓库既有惯例,无 pytest-asyncio),
monkeypatch:
- _harness.call_agent_json:guarded 内部引用的模块全局,捕获 kwargs(no_think/max_tokens);
- sys.modules["app"]:deferred `from app import _get_gm` 注入假 gm;
- platform_app.db.connect/init_db:假 DB 返回各 handler SQL 的最小行 + 记录 execute。
"""
from __future__ import annotations

import asyncio
import json
import sys
import types

from agents import _harness


# ── 假 DB / 假 gm 脚手架 ──────────────────────────────────────────────
class _FakeDB:
    """execute(sql, params) 记流水并返回 self;fetchone() 委派给注入的取行函数。"""

    def __init__(self, fetchone_fn):
        self._fetchone_fn = fetchone_fn
        self.executed: list[tuple[str, object]] = []
        self._last_sql = ""

    def execute(self, sql, params=None):
        self.executed.append((sql, params))
        self._last_sql = sql
        return self

    def fetchone(self):
        return self._fetchone_fn(self._last_sql)


def _connect_ctx(db):
    class _Ctx:
        def __enter__(self_inner):
            return db

        def __exit__(self_inner, *a):
            return False

    return _Ctx()


def _install_db(monkeypatch, db):
    import platform_app.db as _db
    # connect() 无参、每次返回包同一个 db 的新上下文(两次 connect 共享 executed 流水)
    monkeypatch.setattr(_db, "connect", lambda: _connect_ctx(db))
    monkeypatch.setattr(_db, "init_db", lambda: None)


def _install_gm(monkeypatch):
    fake_gm = types.SimpleNamespace(
        api_id="relay", _backend=types.SimpleNamespace(model_name="m")
    )
    monkeypatch.setitem(
        sys.modules, "app", types.SimpleNamespace(_get_gm=lambda u: fake_gm)
    )


def _install_agent(monkeypatch, results):
    """把 _harness.call_agent_json 换成捕获 kwargs 的 fake;results 为返回值序列(轮询)。

    guarded 内部对空正文会二次调用同一全局名,故 fake 需支持多跳。返回 calls 列表供断言。"""
    calls: list[dict] = []
    seq = iter(results)

    def fake(*_a, **kw):
        calls.append(kw)
        try:
            return next(seq)
        except StopIteration:  # 超出预期跳数时复用最后一个,避免测试因 iterator 耗尽误炸
            return results[-1]

    monkeypatch.setattr(_harness, "call_agent_json", fake)
    return calls


# ── autotitle ────────────────────────────────────────────────────────
def _autotitle_row():
    return {
        "title": "新对话",
        "state_snapshot": {
            "history": [
                {"role": "user", "content": "你好"},
                {"role": "assistant", "content": "嗯"},
            ]
        },
    }


def test_autotitle_no_think_and_persists(monkeypatch):
    """happy:no_think is True、max_tokens==64、UPDATE 落库、title 正确。"""
    from routes import tavern

    db = _FakeDB(lambda sql: _autotitle_row() if "select title, state_snapshot" in sql else None)
    _install_db(monkeypatch, db)
    _install_gm(monkeypatch)
    calls = _install_agent(monkeypatch, [('{"title":"雨夜同行"}', {})])

    resp = asyncio.run(tavern.api_tavern_autotitle(1, api_user={"id": 1}))
    payload = json.loads(resp.body)

    # log_tag 是 guarded 的 keyword-only 形参(仅用于告警日志),不透传进内层
    # call_agent_json,故不在此断言;no_think/max_tokens 是真正下发给 provider 的契约。
    assert calls[0]["no_think"] is True
    assert calls[0]["max_tokens"] == 64
    assert payload["title"] == "雨夜同行"
    assert any("update game_saves" in sql for sql, _ in db.executed), "标题必须写库"


def test_autotitle_empty_body_guardrail_expands_budget(monkeypatch):
    """空正文护栏:第一跳空(reasoning 吃光 64)→ 扩预算重试;两跳 max_tokens=[64,1200]。"""
    from routes import tavern

    db = _FakeDB(lambda sql: _autotitle_row() if "select title, state_snapshot" in sql else None)
    _install_db(monkeypatch, db)
    _install_gm(monkeypatch)
    calls = _install_agent(
        monkeypatch,
        [("", {"reasoning_tokens": 64}), ('{"title":"雨夜同行"}', {})],
    )

    resp = asyncio.run(tavern.api_tavern_autotitle(1, api_user={"id": 1}))
    payload = json.loads(resp.body)

    assert [c["max_tokens"] for c in calls] == [64, 1200], "扩预算=max(2x,1200)"
    assert payload["title"] == "雨夜同行", "重试拿到正文后应正常出标题"


# ── ai_reply ─────────────────────────────────────────────────────────
def _ai_reply_row():
    return {
        "state_snapshot": {
            "tavern": {"character": {"name": "苏语棠"}},
            "player": {"name": "我"},
            "history": [
                {"role": "user", "content": "你还好吗"},
                {"role": "assistant", "content": "……别管我。"},
            ],
        }
    }


def test_ai_reply_no_think_and_returns_reply(monkeypatch):
    """ai_reply:no_think is True、log_tag 正确、reply 正常解析返回。"""
    from routes import tavern

    db = _FakeDB(lambda sql: _ai_reply_row() if "save_kind = 'tavern'" in sql else None)
    _install_db(monkeypatch, db)
    _install_gm(monkeypatch)
    calls = _install_agent(monkeypatch, [('{"reply":"我没事,先走吧。"}', {})])

    resp = asyncio.run(tavern.api_tavern_ai_reply(1, api_user={"id": 1}))
    payload = json.loads(resp.body)

    assert calls[0]["no_think"] is True
    assert calls[0]["max_tokens"] == 400
    assert payload["reply"] == "我没事,先走吧。"
