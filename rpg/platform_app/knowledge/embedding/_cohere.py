"""platform_app.knowledge.embedding._cohere — Cohere embed API v2 通道。

拆包前住在单文件 embedding.py。纯机械搬家,行为零变化。
"""
from __future__ import annotations

from ._base import log


def _embed_via_cohere(model: str, api_key: str, texts: list[str]) -> list[list[float]] | None:
    """Cohere embed API v2。"""
    try:
        import cohere  # type: ignore
        co = cohere.Client(api_key)
        resp = co.embed(texts=texts, model=model, input_type="search_document")
        return [list(e) for e in resp.embeddings]
    except ImportError:
        log.warning("[embedding] cohere SDK not installed; pip install cohere")
        return None
    except Exception as e:
        log.warning("[embedding] cohere embed failed: %s", e)
        return None
