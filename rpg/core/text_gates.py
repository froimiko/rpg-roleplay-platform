"""core/text_gates.py — 确定性文本验收闸(共享层)。

从 rath/npc_scene 升格(用户实锤:验收器族散落各处该抽公共层)。当前消费方:
RATH 仿真(调度裁决+呈现验收)。同族:black_swan validator/npc_extract L2(候选迁入)。
"""
from __future__ import annotations

import re

_NOUN_SUFFIX_RE = re.compile(
    r"[一-鿿]{1,6}(?:试验场|实验场|实验室|研究所|研究院|兵工厂|军工厂|司令部|指挥部|"
    r"办事处|委员会|结社|教团|骑士团|情报局|安全局|管理局|档案馆|收容所|基地|要塞|"
    # B10(RATH v4 sim 审计,P2):移除过泛后缀「计划/行动/工程/机关」——高频日常措辞
    # (还款计划/装修工程/秘密行动)被整体误伤;只保留强机构语义后缀,不放松真机构幻觉。
    r"协议|条约|装置|型号)"
)


def find_fabricated_nouns(text: str, known_text: str) -> list[str]:
    """机构/地点/计划/装置类后缀的词若不在已知材料里出现过 → 视为幻觉新造。纯函数。

    贪婪捕获会把句子前缀吞进 token(「他要去第七试验场」);判定用右对齐渐进:
    token 的任一右对齐子串(≥后缀+1字)在材料中出现 → 视为已知(宁漏勿误)。"""
    if not text:
        return []
    known = known_text or ""
    out: list[str] = []
    for m in _NOUN_SUFFIX_RE.finditer(text):
        tok = m.group(0)
        is_known = any(tok[i:] in known for i in range(len(tok) - 2))
        if not is_known and tok not in out:
            out.append(tok)
    return out
