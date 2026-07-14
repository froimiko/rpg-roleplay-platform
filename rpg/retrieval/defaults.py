"""retrieval.defaults — 默认剧本判定 + 默认小说泄漏行过滤。

拆包(纯机械搬家):自 rpg/retrieval.py 逐字搬来,函数体零改动。
"""
from __future__ import annotations

from config.glossary import get_leak_filter_tokens


def _is_default_mumu_script(script_id: int | None) -> bool:
    """task 80: 通用底座 — 不再区分"默认 MuMu 剧本"。

    历史: 早期 .webnovel/*.db + indexes/*.json 是为单一柏林剧本预生成的本地数据,
    现在所有剧本数据都该在 postgres (chapter_facts + document_chunks +
    worldbook_entries + character_cards),按 script_id scope 严格隔离。
    特殊化"默认剧本"会让任何巧合命中 title 的脚本走到本地 sqlite 路径,
    引入污染。统一返 False = 永远走 postgres 路径。

    保留函数签名是为了下游 callers 兼容。
    """
    return False


# task 42：postgres chapter_facts.story_time_label 在过去的索引器跑里被错误地
# 复制了默认柏林剧情的 label（如"图卢兹失守后次日，柏林内城"）到导入剧本的行上。
# 数据迁移修不掉所有历史脏数据，retrieve 时再防一道——非默认 script 读到的 fact
# 如果 story_time_label 含柏林 token，就抹掉这个字段，避免泄漏到 GM 上下文。
# IP terms loaded from config/novel_glossary.json (gitignored) or .example.json.
# Do NOT hardcode novel-specific names here; edit novel_glossary.json instead.
_DEFAULT_NOVEL_LEAK_TOKENS = get_leak_filter_tokens()


def _strip_default_novel_leakage(text: str) -> str:
    """对一段已生成的检索文本做后处理：把含『默认柏林剧情』token 的行删掉。
    用于 retrieve_runtime_context 返回的 postgres 检索（如果 chapter_facts 行
    的 story_time_label 或 chunk content 残留默认柏林内容）。"""
    if not text:
        return text
    lines = text.splitlines()
    cleaned: list[str] = []
    for line in lines:
        if any(tok in line for tok in _DEFAULT_NOVEL_LEAK_TOKENS):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)
