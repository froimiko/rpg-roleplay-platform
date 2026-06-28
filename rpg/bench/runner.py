"""RP harness 基准 — 运行器 + scorecard 聚合。

run_scorecard(cases, metrics): 对每个 case 跑全部指标,按字段方向聚合成 scorecard。
布尔(bad_rate)字段 → 命中率;连续(lower/higher/info)→ mean/median/p90。
另出 per-save 分桶 + worst offenders(命中坏指标的 case,供人工抽查)。
scorecard 是纯 JSON,可跨 run 比较 —— 这就是 harness 迭代的"涨跌表"。
"""
from __future__ import annotations

import statistics
from typing import Any

from bench.metrics import all_metrics, field_kind


def _agg(field: str, values: list) -> dict[str, Any]:
    kind = field_kind(field)
    # 任何布尔字段都出命中率;kind=bad_rate 表示"越低越好"(在报告里归坏指标),
    # 其余布尔(如 clarify)归"观测率"。
    if values and all(isinstance(v, bool) for v in values):
        n = len(values)
        hits = sum(1 for v in values if v)
        return {"kind": kind, "rate": round(hits / n, 4) if n else 0.0, "hits": hits, "n": n}
    nums = [float(v) for v in values if isinstance(v, (int, float)) and not isinstance(v, bool)]
    if not nums:
        return {"kind": kind, "n": 0}
    nums.sort()
    p90 = nums[min(len(nums) - 1, int(0.9 * len(nums)))]
    return {"kind": kind, "mean": round(statistics.fmean(nums), 3),
            "median": round(statistics.median(nums), 3), "p90": round(p90, 3), "n": len(nums)}


def run_scorecard(cases: list[dict], label: str = "current") -> dict[str, Any]:
    metrics = all_metrics()
    field_vals: dict[str, list] = {}
    per_save: dict[int, dict[str, list]] = {}
    offenders: list[dict] = []
    n_cases = 0

    for case in cases:
        n_cases += 1
        resp = case.get("gm_response", "")
        sid = case.get("save_id")
        row_bad: list[str] = []
        for mname, fn in metrics.items():
            try:
                out = fn(resp, case) or {}
            except Exception:
                continue
            for field, val in out.items():
                field_vals.setdefault(field, []).append(val)
                per_save.setdefault(sid, {}).setdefault(field, []).append(val)
                if field_kind(field) == "bad_rate" and val:
                    row_bad.append(field)
        if row_bad:
            offenders.append({"save_id": sid, "turn": case.get("turn_idx"),
                              "bad": row_bad, "excerpt": (resp or "")[:90]})

    fields = {f: _agg(f, v) for f, v in sorted(field_vals.items())}
    save_summ = {}
    for sid, fv in per_save.items():
        save_summ[sid] = {"turns": len(next(iter(fv.values()), [])),
                          "bad_rates": {f: _agg(f, v)["rate"] for f, v in fv.items()
                                        if field_kind(f) == "bad_rate"}}
    return {
        "label": label, "n_cases": n_cases, "n_saves": len(per_save),
        "fields": fields,
        "per_save": save_summ,
        "offenders": offenders[:50],
    }
