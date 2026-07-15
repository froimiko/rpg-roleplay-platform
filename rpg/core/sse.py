"""core.sse — SSE(Server-Sent Events)帧格式化单一真相源。

`event: <event>\ndata: <json>\n\n` 是 SSE 线格式;全仓所有手写 `_sse`/`_sse_event`
一律委托本函数,避免多份字节级相同实现漂移。
"""
from __future__ import annotations

import json
from typing import Any


def sse_frame(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
