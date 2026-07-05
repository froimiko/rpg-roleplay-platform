"""extract/world_key_backfill.py — world_key 模型批次 3a:结构先验回填。

设计 docs/design/world_key_model_v1.md §2/§3/§4/§7(3a 行)。

只做「第一层·结构先验」(免费、确定性、零 LLM):
  · 以卷(volume_title)为段粒度,无卷则每 20 章一窗;
  · 逐段相对上一段判 {continuous | time_skip | new_world};
  · new_world 起新 world 标签,continuous/time_skip 沿用上段 world;
  · 过切回退:产出 world 数 ≥ 段数 × 0.8 → 整书退回单世界(null)。

纯函数层(classify_segments)零 DB、零 IO,可单测全覆盖。
IO 层(backfill_worldlines)只读 chapter_facts + script_chapters,
幂等 UPDATE 两列(worldline_key/in_world_time),不碰其它列。
"""
from __future__ import annotations

import re
from typing import Any

# 第一层结构先验词表(§3):卷/章标题命中即视为 new_world 候选。
# 宁漏勿误——词表故意窄,过切有 §3 第三层回退兜底。
_NEW_WORLD_KEYWORDS = (
    "副本", "世界", "位面", "穿越", "轮回",
    "序幕", "尾声", "梦境", "回忆篇", "if线", "平行", "异世界",
)
# 「第X世」(X 可以是中文数字或阿拉伯数字)
_NEW_WORLD_RE = re.compile(
    r"第[一二三四五六七八九十0-9]+世"
)
# 【】括号编号(如「【第一副本】」「【位面3】」)——编号变化也是候选信号,
# 但只要词表已命中同一标题就不用重复判定,这里只处理"仅括号编号、无其它关键词"的情况。
_BRACKET_RE = re.compile(r"【([^】]*)】")

_FALLBACK_WINDOW = 20  # 无卷信息时的章窗大小
_OVERCUT_RATIO = 0.8  # §3 第三层:world 数 / 段数 达到此比例即判过切


def _clean_norm_label(text: str) -> str:
    """归一化去标点，供 world_label 与过切判定使用。"""
    s = (text or "").strip()
    s = re.sub(r"[\s　]+", "", s)
    s = re.sub(r"[，。！？、；：,.!?;:\"'“”‘’()（）\[\]]+", "", s)
    return s


def _normalize_world_label(text: str) -> str:
    """world_label 归一化:去标点截断 24 字(§3)。"""
    s = _clean_norm_label(text)
    return s[:24]


def _hits_keyword(text: str) -> str:
    """返回命中的关键词/短语(用作 world_label 素材),未命中返回空串。"""
    if not text:
        return ""
    for kw in _NEW_WORLD_KEYWORDS:
        if kw in text:
            return kw
    m = _NEW_WORLD_RE.search(text)
    if m:
        return m.group(0)
    return ""


def _bracket_tag(text: str) -> str:
    """取标题里的【】括号编号(如「【第一副本】」→「第一副本」),无则空串。"""
    if not text:
        return ""
    m = _BRACKET_RE.search(text)
    return m.group(1).strip() if m else ""


def _is_new_world_candidate(seg: dict, prev_seg: dict | None) -> tuple[bool, str, str]:
    """第一层结构先验(§3):标题/卷名命中词表 或 【】括号编号变化 → new_world 候选。

    注意:分段本身已经是"以 volume_title 为粒度"切的(§3"对每个段…判定"——段边界
    即卷/部切换处),所以"volume_title 变化"这条结构先验在【段级分类】上不能再重复
    当独立候选信号——段与段之间 volume_title 恒不同(否则早已被 _split_raw_segments
    并入同段),若把"变了"本身也算候选,则任意多卷书都会 100% 段判 new_world,
    过切回退(§3 第三层,world 数 ≥ 段数×0.8)恒真触发,整条结构先验层失去区分度
    (无限流/线性书退化成同一结果:全 null)。只有当卷名/章标题本身带出「这是不同
    世界」的实证(词表命中、【】编号变化)才提升为候选;单纯换了卷名/部名(常见的
    "第一卷/第二卷"式线性分卷)默认沿用上段 world——留给 §3 第二层 LLM 窄确认兜底
    误判,而不是在零证据时就升级。

    返回 (是否候选, 用于 world_label 的原始短语, 信号种类 "keyword"|"bracket")。
    信号强度:bracket(【】编号变化)=结构性强信号,单命中可信;keyword(词表)=弱信号,
    无卷名书上需 ≥2 处佐证(见 classify_segments 稀疏护栏)。
    """
    vt = (seg.get("volume_title") or "").strip()
    title = (seg.get("title") or "").strip()
    prev_title = (prev_seg.get("title") or "").strip() if prev_seg else ""

    hit = _hits_keyword(vt) or _hits_keyword(title)
    if hit:
        # world_label 素材优先用命中所在的完整短语(卷名优先于章标题)
        source = vt if _hits_keyword(vt) else title
        return True, (source or hit), "keyword"

    bracket = _bracket_tag(title)
    prev_bracket = _bracket_tag(prev_title) if prev_seg else ""
    if bracket and bool(prev_seg) and bracket != prev_bracket:
        return True, bracket, "bracket"

    return False, "", ""


def _split_raw_segments(ordered: list[dict]) -> list[dict]:
    """分段:卷粒度优先(volume_title 连续相同即同段),无任何卷信息则回退 20 章窗。"""
    raw_segments: list[dict] = []
    has_any_volume = any((c.get("volume_title") or "").strip() for c in ordered)

    if has_any_volume:
        for c in ordered:
            vt = (c.get("volume_title") or "").strip()
            ci = int(c.get("chapter_index", 0))
            title = (c.get("title") or "").strip()
            if raw_segments and raw_segments[-1]["volume_title"] == vt:
                raw_segments[-1]["ch_max"] = ci
            else:
                raw_segments.append({
                    "volume_title": vt,
                    "title": title,  # 段首章标题
                    "ch_min": ci,
                    "ch_max": ci,
                })
    else:
        for c in ordered:
            ci = int(c.get("chapter_index", 0))
            title = (c.get("title") or "").strip()
            if raw_segments and ci - raw_segments[-1]["ch_min"] < _FALLBACK_WINDOW:
                raw_segments[-1]["ch_max"] = ci
            else:
                raw_segments.append({
                    "volume_title": "",
                    "title": title,  # 段首章标题
                    "ch_min": ci,
                    "ch_max": ci,
                })
    return raw_segments


def _classify_raw_segments(raw_segments: list[dict]) -> list[dict]:
    """逐段三分类(未做过切回退)。返回段列表,每段:
        {"world_label": str | None, "verdict": "continuous"|"new_world", "ch_min": int, "ch_max": int}
    """
    segments: list[dict] = []
    current_world: str | None = None
    prev_raw: dict | None = None
    for raw in raw_segments:
        is_candidate, label_source, signal_kind = _is_new_world_candidate(raw, prev_raw)
        if is_candidate:
            verdict = "new_world"
            current_world = _normalize_world_label(label_source) or current_world
        else:
            verdict = "continuous"
            # current_world 保持不变(沿用上段;time_skip 在结构先验层不产生候选,同样落此分支)
        segments.append({
            "world_label": current_world,
            "verdict": verdict,
            "signal": signal_kind,
            "ch_min": raw["ch_min"],
            "ch_max": raw["ch_max"],
        })
        prev_raw = raw
    return segments


def _is_overcut(segments: list[dict]) -> bool:
    """§3 第三层过切回退判定:distinct world 数 ≥ 段数 × 0.8。"""
    if not segments:
        return False
    distinct_worlds = {s["world_label"] for s in segments if s["world_label"]}
    return len(distinct_worlds) > 0 and len(distinct_worlds) >= len(segments) * _OVERCUT_RATIO


def classify_segments(chapters: list[dict]) -> list[dict]:
    """输入每章 {chapter_index, title, volume_title, summary}(乱序也可,内部会按 chapter_index
    排序),以卷(volume_title)为段粒度(无卷则每 20 章一窗)分段,逐段相对上一段三分类
    {continuous | time_skip | new_world}(结构先验层不单独产生 time_skip,恒落 continuous;
    time_skip 的检出留待 §3 第二层 LLM 确认,批次 3a 只做第一层)。

    返回段列表,每段:
        {"world_label": str | None, "verdict": str, "ch_min": int, "ch_max": int, "overcut": bool}
    world_label=None 表示主世界(未命中任何 new_world,或触发过切回退后全部退回主世界)。
    overcut 对列表中每段都相同(整书级判定),供调用方零额外调用即可读到全局回退状态。

    过切回退(§3 第三层,纯函数内):distinct world 数 ≥ 段数 × 0.8 → 全部退 null(单世界)。
    """
    if not chapters:
        return []

    ordered = sorted(chapters, key=lambda c: int(c.get("chapter_index", 0)))
    raw_segments = _split_raw_segments(ordered)
    segments = _classify_raw_segments(raw_segments)

    overcut = _is_overcut(segments)
    # 孤立单命中护栏(生产 dry-run 实证,script 133):**仅当书没有卷名结构、分段退化
    # 为 20 章合成窗时**,词表的孤立单命中(如某章标题带「轮回」)不可信——会产出横跨
    # 几百章的错误伪世界,比全 null 更糟 → 整书退单世界,留给批次 3b 的 LLM 确认层
    # 用 summary 证据做正确切分。有真实卷名结构的书不受此护栏影响:单次世界切换是
    # 合法场景(穿越书恰好一个边界),卷结构本身就是佐证。
    # 信号强度分级:bracket(【】编号变化)=结构性强信号,单命中可信(如两段式穿越书);
    # keyword(词表)=弱信号,无卷名合成窗上孤立单命中不可信。
    _has_volumes = any((c.get("volume_title") or "").strip() for c in ordered)
    _weak_hits = sum(1 for s in segments
                     if s.get("verdict") == "new_world" and s.get("signal") == "keyword")
    _strong_hits = sum(1 for s in segments
                       if s.get("verdict") == "new_world" and s.get("signal") == "bracket")
    _too_sparse = (not _has_volumes) and _strong_hits == 0 and 0 < _weak_hits < 2
    if overcut or _too_sparse:
        for s in segments:
            s["world_label"] = None
            s["verdict"] = "continuous"

    for s in segments:
        s["overcut"] = overcut
        s["sparse_signal"] = _too_sparse

    return segments


def clean_in_world_time(label: str) -> str:
    """v1:透传该章已存 story_time_label 清洗版。优先复用 extract.resolve._clean_timeline_label,
    导入失败时内联同款逻辑(占位 label 归一空串)。"""
    try:
        from extract.resolve import _clean_timeline_label
        return _clean_timeline_label(label)
    except Exception:
        pass
    s = (label or "").strip()
    if not s or len(s) > 40:
        return ""
    placeholder_re = re.compile(
        r'^\s*(?:ch\s*\d+\s*节点'
        r'|第\s*[零一二三四五六七八九十百千两\d]+\s*[章回话](?:\s*节点)?'
        r'|chapter\s*\d+)\s*$',
        re.IGNORECASE,
    )
    if placeholder_re.match(s):
        return ""
    return s


def _segments_to_chapter_map(segments: list[dict]) -> dict[int, str | None]:
    """段列表展开成 {chapter_index: world_label} 查表,供 IO 层逐章写入。"""
    out: dict[int, str | None] = {}
    for seg in segments:
        for ci in range(seg["ch_min"], seg["ch_max"] + 1):
            out[ci] = seg["world_label"]
    return out


def backfill_worldlines(script_id: int, *, dry_run: bool = True) -> dict[str, Any]:
    """回填 chapter_facts.worldline_key/in_world_time + script_timeline_anchors.worldline_key。

    dry_run=True(默认):只读不写,返回 {"segments": [...], "overcut": bool, "would_write": N}。
    dry_run=False:幂等 UPDATE(纯函数式覆盖两列,可重跑),返回同样的统计 + "written": N。

    真实列名(已核对 platform_app/db/init.py):
      chapter_facts(script_id, chapter, title, summary, story_time_label, worldline_key, in_world_time, ...)
      script_chapters(script_id, chapter_index, title, volume_title, ...)
    """
    from platform_app.db import connect

    with connect() as db:
        chapters = _load_chapters(db, script_id)

    segments = classify_segments(chapters)
    overcut = bool(segments and segments[0].get("overcut"))

    chapter_map = _segments_to_chapter_map(segments)
    would_write = len(chapter_map)

    result: dict[str, Any] = {
        "segments": [
            {
                "world_label": s["world_label"],
                "ch_min": s["ch_min"],
                "ch_max": s["ch_max"],
            }
            for s in segments
        ],
        "overcut": overcut,
        "would_write": would_write,
    }

    if dry_run:
        return result

    written = 0
    with connect() as db:
        fact_rows = db.execute(
            "select chapter, story_time_label from chapter_facts where script_id=%s",
            (script_id,),
        ).fetchall()
        for row in fact_rows:
            ch = int(row["chapter"])
            if ch not in chapter_map:
                continue
            world_label = chapter_map[ch]
            in_world_time = clean_in_world_time(row.get("story_time_label") or "")
            db.execute(
                "update chapter_facts set worldline_key=%s, in_world_time=%s "
                "where script_id=%s and chapter=%s",
                (world_label, in_world_time or None, script_id, ch),
            )
            written += 1

        # script_timeline_anchors:按 chapter_min 落在哪个段来标记 worldline_key(幂等覆盖)。
        anchor_rows = db.execute(
            "select id, chapter_min from script_timeline_anchors where script_id=%s",
            (script_id,),
        ).fetchall()
        for row in anchor_rows:
            ch_min = int(row["chapter_min"])
            world_label = chapter_map.get(ch_min)
            db.execute(
                "update script_timeline_anchors set worldline_key=%s where id=%s",
                (world_label, row["id"]),
            )

    result["written"] = written
    return result


def _load_chapters(db, script_id: int) -> list[dict]:
    """读 chapter_facts(title/chapter)+ script_chapters(volume_title),按 chapter_index 合并。

    chapter_facts.title 与 script_chapters.title 理论同源，优先用 script_chapters
    (提取产物层可能滞后于原始章节标题编辑)。summary 取 chapter_facts。
    """
    sc_rows = db.execute(
        "select chapter_index, title, volume_title from script_chapters where script_id=%s",
        (script_id,),
    ).fetchall()
    sc_by_index = {int(r["chapter_index"]): r for r in sc_rows}

    cf_rows = db.execute(
        "select chapter, title, summary from chapter_facts where script_id=%s",
        (script_id,),
    ).fetchall()

    chapters: list[dict] = []
    for r in cf_rows:
        ci = int(r["chapter"])
        sc = sc_by_index.get(ci, {})
        chapters.append({
            "chapter_index": ci,
            "title": (sc.get("title") or r.get("title") or ""),
            "volume_title": (sc.get("volume_title") or ""),
            "summary": r.get("summary") or "",
        })
    return chapters


def _print_dry_run(script_id: int, result: dict[str, Any]) -> None:
    print(f"script_id={script_id} dry_run 分段结果(overcut={result['overcut']}):")
    for seg in result["segments"]:
        label = seg["world_label"] or "(主世界)"
        print(f"  ch{seg['ch_min']}-{seg['ch_max']}: {label}")
    print(f"would_write={result['would_write']}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="world_key 结构先验回填(批次 3a)")
    parser.add_argument("script_id", type=int)
    parser.add_argument("--apply", action="store_true", help="默认 dry-run；传此参数才真正写库")
    args = parser.parse_args()

    out = backfill_worldlines(args.script_id, dry_run=not args.apply)
    if args.apply:
        print(f"script_id={args.script_id} 已写入 written={out.get('written')} overcut={out['overcut']}")
    else:
        _print_dry_run(args.script_id, out)
