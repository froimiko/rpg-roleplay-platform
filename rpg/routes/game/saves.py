"""routes.game.saves —— 存档写操作族:保存(/api/save)+ 消息编辑(/api/message/edit)+
acceptance A/B 裁决(/api/acceptance/choice)。

_amend_history_message / _resolve_message_index_by_content 为本族共用的确定性写穿
helper(活跃 commit 快照 + 工作树 blob + snapshot_hash bump + messages 四存储一致);
chat_pipeline.gm `from routes.game import _resolve_message_index_by_content` 经 __init__
门面 re-export 不变。
"""
from __future__ import annotations

from typing import Any

from fastapi import Depends
from fastapi.responses import JSONResponse
from platform_app.api._deps import json_response

from routes._deps_fastapi import get_current_user
from schemas._common import COMMON_ERROR_RESPONSES, GenericOkResponse, StateResponse

from ._shared import router, _log, _sanitize_payload


@router.post("/api/save", response_model=StateResponse, responses=COMMON_ERROR_RESPONSES)
async def api_save(
    api_user: dict[str, Any] | None = Depends(get_current_user),
) -> JSONResponse:
    """task 87 Phase 6: 走 dispatcher save_runtime。"""
    from app import (
        _ensure_loaded,
        _payload,
        _persist_runtime_checkpoint,
        _resolve_persist_target,
    )
    state = _ensure_loaded(api_user)
    from tools_dsl.ui_dispatch_helper import dispatch_ui_tool
    result = dispatch_ui_tool(
        tool_name="save_runtime", args={},
        user_id=int(api_user.get("id")) if api_user else 0,
        save_id=_resolve_persist_target(api_user)[1] or 0,
        state=state,
    )
    if not result.ok:
        return json_response({"ok": False, "error": result.error}, status_code=400)
    _persist_runtime_checkpoint(state, api_user)
    return json_response({"ok": True, "state": _sanitize_payload(_payload(api_user))})


@router.post("/api/message/edit", response_model=GenericOkResponse, responses=COMMON_ERROR_RESPONSES)
async def api_message_edit(
    body: dict[str, Any],
    api_user: dict[str, Any] | None = Depends(get_current_user),
) -> JSONResponse:
    """编辑一条历史消息的内容(messages 表 + state blob history 同步更新)。

    body: {save_id: int, message_index: int, content: str}
    message_index: history 数组索引(0-based),与 /api/state 返回的 history 顺序一致。
    """
    if not api_user:
        return json_response({"ok": False, "error": "auth required"}, status_code=401)
    save_id = body.get("save_id")
    msg_index = body.get("message_index")
    new_content = body.get("content")
    if save_id is None or msg_index is None or new_content is None:
        return json_response({"ok": False, "error": "save_id, message_index, content required"}, status_code=400)
    try:
        msg_index = int(msg_index)
        save_id = int(save_id)
    except (TypeError, ValueError):
        return json_response({"ok": False, "error": "invalid save_id or message_index"}, status_code=400)

    from platform_app.db import connect
    from platform_app.perms import owns_save
    try:
        with connect() as db:
            # [安全] 存档归属校验:原 PR 直接用请求体 save_id 改 messages,无归属校验 = IDOR
            # (任何登录用户可改他人存档的消息)。与全平台 save 端点统一走 perms.owns_save。
            if not owns_save(db, int(save_id), int(api_user["id"])):
                return json_response({"ok": False, "error": "无权访问该存档"}, status_code=403)
            # 与 acceptance 选择同款持久化:写穿【活跃 commit 快照(kb_native materialize 权威源)+ 工作树
            # 快照 + snapshot_hash bump(跨 worker 失效)+ messages 表】。旧实现只改 messages + state.save()
            # blob,不改 commit 快照 → kb_native 存档编辑后刷新/换 worker 就回退(与 acceptance 同源 bug)。
            # message/edit 可编辑任意角色(玩家也能改自己输入),故不限 require_role。
            ok, _orig = _amend_history_message(db, int(save_id), msg_index, str(new_content))
            db.commit()
        if not ok:
            return json_response({"ok": False, "error": f"message_index {msg_index} 越界或无有效消息"}, status_code=400)
    except Exception as e:
        _log.exception("[message/edit] failed")
        return json_response({"ok": False, "error": str(e)}, status_code=500)
    return json_response({"ok": True})


def _amend_history_message(db, save_id: int, message_index: int, new_content: str,
                           *, require_role: str | None = None) -> tuple[bool, str | None]:
    """把 save 第 message_index 条(展示序 = materialize 的非空过滤视图)消息内容换成 new_content,
    确定性写穿【刷新/换 worker 后会重新读到的】所有权威存储,并 bump 跨 worker 缓存失效信号:
      ① 活跃 branch_commit 快照 —— kb_native 存档 materialize 读 history 的**权威源**(save_kb.materialize
         从 branch_commits[active].state_snapshot.history 读;messages 表只是空 history 时的兜底)。
         这正是「选了改写、刷新/切 worker 后又变回首稿」的根:旧实现只改 messages 表 + blob,没改这里。
      ② game_saves / runtime_checkouts 工作树快照 —— 非 kb 旧档刷新读它 + 工作树一致。
      ③ runtime_checkouts.snapshot_hash bump —— 其它 worker 下次请求 hash_drift → 重 materialize 读到新稿
         (同固定记忆 out-of-turn 编辑的跨 worker 失效范式;read_runtime 从 runtime_checkouts 读该 hash)。
      ④ messages 表 —— materialize 兜底源 + 不写 commit 快照的旧档。
    返回 (swapped, original_content)。全程用内容匹配跨存储替换(同 save 内该 assistant 全文唯一),
    避免各存储 index 基准(滤空/分支)不一致;完全自包含,不依赖 _ensure_loaded 的进程内缓存态。"""
    import json as _json

    from platform_app.branches.commits import _state_snapshot_hash
    from psycopg.types.json import Jsonb

    def _hist_at(snap, idx):
        """返回展示序(滤空)第 idx 条的 (content, role);越界/无效返回 (None, None)。"""
        if not (isinstance(snap, dict) and isinstance(snap.get("history"), list)):
            return None, None
        raw_idx = [i for i, m in enumerate(snap["history"])
                   if isinstance(m, dict) and str(m.get("content") or "").strip()]
        if 0 <= idx < len(raw_idx):
            m = snap["history"][raw_idx[idx]]
            return m.get("content"), m.get("role")
        return None, None

    srow = db.execute("select active_commit_id from game_saves where id = %s", (save_id,)).fetchone()
    commit_id = int((srow or {}).get("active_commit_id") or 0) if srow else 0
    original = None
    target_role = None
    # ① 活跃 commit 快照(权威展示源):按展示序定位 original,就地改写回写。
    if commit_id:
        crow = db.execute(
            "select state_snapshot from branch_commits where id = %s and save_id = %s",
            (commit_id, save_id),
        ).fetchone()
        snap = (crow or {}).get("state_snapshot") if crow else None
        if isinstance(snap, str):
            snap = _json.loads(snap)
        _c, _r = _hist_at(snap, message_index)
        if _c is not None and (require_role is None or _r == require_role):
            original, target_role = _c, _r
            if original != new_content:
                for m in snap["history"]:
                    if isinstance(m, dict) and m.get("content") == original:
                        m["content"] = new_content
                db.execute("update branch_commits set state_snapshot = %s where id = %s", (Jsonb(snap), commit_id))
    # 兜底:commit 无 history(酒馆/旧档)→ messages 表按展示序(滤空)定位 original。
    if original is None:
        rows = db.execute(
            "select role, content from messages where save_id = %s order by turn, id", (save_id,)
        ).fetchall()
        filt = [r for r in rows if str(r["content"] or "").strip()]
        if 0 <= message_index < len(filt):
            _r = filt[message_index]["role"]
            if require_role is None or _r == require_role:
                original, target_role = filt[message_index]["content"], _r
    if original is None:
        return False, None
    if original == new_content:
        return True, original
    # ② 工作树快照(非 kb 旧档刷新读它)+ ③ snapshot_hash bump(跨 worker 失效)
    for tbl, keycol in (("game_saves", "id"), ("runtime_checkouts", "save_id")):
        for r in db.execute(f"select id, state_snapshot from {tbl} where {keycol} = %s", (save_id,)).fetchall():
            snap = r.get("state_snapshot")
            if isinstance(snap, str):
                snap = _json.loads(snap)
            if not (isinstance(snap, dict) and isinstance(snap.get("history"), list)):
                continue
            changed = False
            for m in snap["history"]:
                if isinstance(m, dict) and m.get("content") == original:
                    m["content"] = new_content
                    changed = True
            if changed:
                if tbl == "runtime_checkouts":
                    db.execute(
                        "update runtime_checkouts set state_snapshot = %s, snapshot_hash = %s,"
                        " row_version = row_version + 1 where id = %s",
                        (Jsonb(snap), _state_snapshot_hash(snap), r["id"]),
                    )
                else:
                    db.execute(
                        "update game_saves set state_snapshot = %s, row_version = row_version + 1 where id = %s",
                        (Jsonb(snap), r["id"]),
                    )
    # ④ messages 表(内容匹配 + 目标角色,避免同文本跨角色误伤)
    if target_role:
        db.execute(
            "update messages set content = %s where save_id = %s and role = %s and content = %s",
            (new_content, save_id, target_role, original),
        )
    else:
        db.execute(
            "update messages set content = %s where save_id = %s and content = %s",
            (new_content, save_id, original),
        )
    return True, original


def _resolve_message_index_by_content(db, save_id: int, content: str, *, role: str | None = None) -> int | None:
    """按【全文内容 + 角色】算出展示序(滤空)message_index。权威源同 _amend_history_message:
    活跃 commit 快照 history;无则 messages 表兜底。找不到 → None。

    用途:acceptance 改写候选异步到达,前端「最后一条 assistant」启发式在玩家已推进/相邻回合时
    会指错(行者无疆:改写改到前一个回合)。候选 log 里存了 original_text 全文,直接拿它内容匹配算出
    权威 index,绕开前端竞态。展示序(滤空)与 _hist_at 一致;新回合的消息追加在后、不移动旧 index。"""
    import json as _json
    target = str(content or "")
    if not target.strip():
        return None
    srow = db.execute("select active_commit_id from game_saves where id = %s", (save_id,)).fetchone()
    commit_id = int((srow or {}).get("active_commit_id") or 0) if srow else 0
    seq: list[tuple[str, str]] = []
    if commit_id:
        crow = db.execute(
            "select state_snapshot from branch_commits where id = %s and save_id = %s",
            (commit_id, save_id),
        ).fetchone()
        snap = (crow or {}).get("state_snapshot") if crow else None
        if isinstance(snap, str):
            snap = _json.loads(snap)
        if isinstance(snap, dict) and isinstance(snap.get("history"), list):
            seq = [(m.get("role"), m.get("content")) for m in snap["history"] if isinstance(m, dict)]
    if not seq:
        rows = db.execute(
            "select role, content from messages where save_id = %s order by turn, id", (save_id,)
        ).fetchall()
        seq = [(r["role"], r["content"]) for r in rows]
    disp = [(rl, ct) for (rl, ct) in seq if str(ct or "").strip()]  # 展示序 = 滤空
    # 从后往前:改写针对最近那条同文(通常同 save 内该 assistant 全文唯一)。
    for i in range(len(disp) - 1, -1, -1):
        rl, ct = disp[i]
        if ct == target and (role is None or rl == role):
            return i
    return None


@router.post("/api/acceptance/choice", response_model=GenericOkResponse, responses=COMMON_ERROR_RESPONSES)
async def api_acceptance_choice(
    body: dict[str, Any],
    api_user: dict[str, Any] | None = Depends(get_current_user),
) -> JSONResponse:
    """acceptance A/B 候选选择:玩家在「首稿 vs 改写稿」之间选一版。

    body: {alt_id: int, choice: "original"|"rewrite", message_index?: int}
    - 记录选择(chosen/chosen_at)供数据采集迭代 acceptance 算法。
    - choice=="rewrite" 时把该轮 assistant 消息内容换成【服务端存的】rewrite_text(前端不回传正文,防注入);
      定位复用 /api/message/edit 同款(按 message_index 定位 messages 表 + blob history)。
    - save_id 一律用 log 行里的服务端值,不信任请求体。
    """
    if not api_user:
        return json_response({"ok": False, "error": "auth required"}, status_code=401)
    alt_id = body.get("alt_id")
    choice = (body.get("choice") or "").strip().lower()
    msg_index = body.get("message_index")
    if alt_id is None or choice not in ("original", "rewrite"):
        return json_response({"ok": False, "error": "alt_id 与 choice(original|rewrite) 必填"}, status_code=400)
    try:
        alt_id = int(alt_id)
    except (TypeError, ValueError):
        return json_response({"ok": False, "error": "invalid alt_id"}, status_code=400)

    from platform_app.db import connect
    from platform_app.perms import owns_save
    uid = int(api_user["id"])
    swapped = False
    try:
        with connect() as db:
            row = db.execute(
                "select id, user_id, save_id, original_text, rewrite_text, chosen from acceptance_ab_log where id = %s",
                (alt_id,),
            ).fetchone()
            if not row:
                return json_response({"ok": False, "error": f"acceptance 候选 {alt_id} 不存在"}, status_code=404)
            # 归属校验:候选必须属于当前用户(IDOR 防护)。
            if int(row["user_id"] or 0) != uid:
                return json_response({"ok": False, "error": "无权操作该候选"}, status_code=403)
            save_id = int(row["save_id"] or 0)
            original_text = str(row["original_text"] or "")
            rewrite_text = str(row["rewrite_text"] or "")
            # 记录选择(幂等:重复点同一选择只更新时间戳)。
            db.execute(
                "update acceptance_ab_log set chosen = %s, chosen_at = now() where id = %s",
                (choice, alt_id),
            )
            db.commit()

            if choice == "rewrite" and rewrite_text and save_id:
                # 权威定位:用候选 log 里存的 original_text 全文内容匹配算出 message_index —— 不信任前端
                # 传的(异步候选 + 前端「最后一条 assistant」启发式会指到相邻回合 = 行者无疆「改到前一个
                # 回合」的根)。内容没命中(清洗差异/旧档)才回退前端 message_index。
                mi = _resolve_message_index_by_content(db, save_id, original_text, role="assistant")
                if mi is None:
                    try:
                        mi = int(msg_index) if msg_index is not None else -1
                    except (TypeError, ValueError):
                        mi = -1
                if mi >= 0 and owns_save(db, save_id, uid):
                    # 自包含写穿所有存储(commit 快照 + 工作树 blob + snapshot_hash bump + messages)。
                    swapped, _orig = _amend_history_message(db, save_id, mi, rewrite_text, require_role="assistant")
                    db.commit()
    except Exception as e:
        _log.exception("[acceptance/choice] failed")
        return json_response({"ok": False, "error": str(e)}, status_code=500)
    return json_response({"ok": True, "choice": choice, "swapped": swapped})
