"""platform_app.api.federation — 功能 B 路由。

三类鉴权:
  1. cookie(require_user):PAT 管理 / 设备批准 / 本地连接器(都是已登录用户操作)。
  2. Bearer PAT(require_pat):/api/ext/library/* 外部库读写。
  3. 公开(无鉴权):/api/ext/device/code|token 设备码流(令牌靠 device_code/user_code 自证)。
"""
from __future__ import annotations

import asyncio
from urllib.parse import quote as _quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from .. import federation
from ._deps import json_response, require_user

router = APIRouter()


# ── Bearer PAT 依赖 ───────────────────────────────────────────────────────
def _bearer_token(request: Request) -> str:
    h = request.headers.get("authorization") or ""
    if not h.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    return h[7:].strip()


def require_pat_read(request: Request) -> dict:
    try:
        return federation.verify_pat(_bearer_token(request), required_scope="library:read")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


def require_pat_publish(request: Request) -> dict:
    try:
        return federation.verify_pat(_bearer_token(request), required_scope="library:publish")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


# ════════════════════════════════════════════════════════════════════════
#  PROVIDER:PAT 管理(cookie)
# ════════════════════════════════════════════════════════════════════════
@router.get("/api/me/pat")
async def api_list_pat(user=Depends(require_user)):
    return json_response(federation.list_pats(user["id"]))


@router.post("/api/me/pat")
async def api_create_pat(request: Request, user=Depends(require_user)):
    body = await request.json()
    name = (body.get("name") or "").strip()
    scopes = body.get("scopes") or ["library:read"]
    ttl = int(body.get("ttl_days") or federation.PAT_DEFAULT_TTL_DAYS)
    return json_response(federation.create_pat(user["id"], name, scopes, ttl))


@router.post("/api/me/pat/{pat_id}/revoke")
async def api_revoke_pat(pat_id: int, user=Depends(require_user)):
    return json_response(federation.revoke_pat(user["id"], pat_id))


# ── PROVIDER:设备批准页(cookie)─────────────────────────────────────────
@router.get("/api/me/device/lookup")
async def api_device_lookup(user_code: str, user=Depends(require_user)):
    info = federation.device_lookup(user_code)
    if not info:
        return json_response({"ok": False, "error": "授权码不存在或已失效"}, status_code=404)
    return json_response({"ok": True, "device": info})


@router.post("/api/me/device/approve")
async def api_device_approve(request: Request, user=Depends(require_user)):
    body = await request.json()
    deny = bool(body.get("deny"))
    try:
        return json_response(federation.device_approve(user["id"], body.get("user_code") or "", deny=deny))
    except ValueError as exc:
        return json_response({"ok": False, "error": str(exc)}, status_code=400)


# ════════════════════════════════════════════════════════════════════════
#  PROVIDER:设备码流(公开)
# ════════════════════════════════════════════════════════════════════════
@router.post("/api/ext/device/code")
async def api_ext_device_code(request: Request):
    body = await request.json()
    # verification_uri:用户在浏览器里输 user_code 的页面(本服务的设置页)。
    base = federation._normalize_base(str(request.base_url))
    verification_uri = f"{base}/Platform.html#settings-account"
    return json_response(federation.device_start(
        body.get("client_name") or "", body.get("scopes") or ["library:read"], verification_uri))


@router.post("/api/ext/device/token")
async def api_ext_device_token(request: Request):
    body = await request.json()
    return json_response(federation.device_poll(body.get("device_code") or ""))


# ════════════════════════════════════════════════════════════════════════
#  PROVIDER:外部库 API(Bearer PAT)
# ════════════════════════════════════════════════════════════════════════
@router.get("/api/ext/library/scripts")
async def api_ext_list(q: str | None = None, limit: int = 30, offset: int = 0, pat=Depends(require_pat_read)):
    return json_response(federation.ext_list_scripts(q, limit, offset))


@router.get("/api/ext/library/scripts/{script_id}/pack")
async def api_ext_pack(script_id: int, pat=Depends(require_pat_read)):
    try:
        zip_bytes, filename = federation.ext_export_pack(script_id)
    except PermissionError:
        return json_response({"ok": False, "error": "该剧本未公开"}, status_code=403)
    except ValueError as exc:
        return json_response({"ok": False, "error": str(exc)}, status_code=404)
    ascii_fallback = filename.encode("ascii", "ignore").decode("ascii") or f"script-{script_id}.zip"
    quoted = _quote(filename, safe="")
    cd = f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quoted}"
    return Response(content=zip_bytes, media_type="application/zip",
                    headers={"Content-Disposition": cd, "X-Content-Type-Options": "nosniff"})


@router.post("/api/ext/library/scripts/publish")
async def api_ext_publish(request: Request, pat=Depends(require_pat_publish)):
    form = await request.form()
    file = form.get("file")
    if not file or not hasattr(file, "read"):
        raise HTTPException(status_code=400, detail="缺 file 字段")
    raw = await file.read()
    if raw[:4] != b"PK\x03\x04":
        raise HTTPException(status_code=400, detail="不是合法的剧本包 zip")
    try:
        return json_response(federation.ext_publish_pack(pat["user"]["id"], raw))
    except ValueError as exc:
        return json_response({"ok": False, "error": str(exc)}, status_code=400)


# ════════════════════════════════════════════════════════════════════════
#  CLIENT:本地连接器(cookie)
# ════════════════════════════════════════════════════════════════════════
@router.get("/api/me/library-connector")
async def api_connector_get(user=Depends(require_user)):
    return json_response(federation.connector_get(user["id"]))


@router.post("/api/me/library-connector")
async def api_connector_set(request: Request, user=Depends(require_user)):
    body = await request.json()
    try:
        federation.connector_set(user["id"], body.get("base_url") or "", body.get("token") or "")
        return json_response(federation.connector_get(user["id"]))
    except ValueError as exc:
        return json_response({"ok": False, "error": str(exc)}, status_code=400)


@router.post("/api/me/library-connector/test")
async def api_connector_test(user=Depends(require_user)):
    try:
        return json_response(await asyncio.to_thread(federation.connector_test, user["id"]))
    except ValueError as exc:
        return json_response({"ok": False, "error": str(exc)}, status_code=400)


@router.get("/api/me/library-connector/scripts")
async def api_connector_scripts(q: str | None = None, limit: int = 30, offset: int = 0, user=Depends(require_user)):
    try:
        return json_response(await asyncio.to_thread(federation.connector_list, user["id"], q, limit, offset))
    except ValueError as exc:
        return json_response({"ok": False, "error": str(exc)}, status_code=400)


@router.post("/api/me/library-connector/import")
async def api_connector_import(request: Request, user=Depends(require_user)):
    body = await request.json()
    rid = body.get("remote_script_id")
    if not rid:
        return json_response({"ok": False, "error": "缺 remote_script_id"}, status_code=400)
    try:
        return json_response(await asyncio.to_thread(federation.connector_import, user["id"], int(rid)))
    except ValueError as exc:
        return json_response({"ok": False, "error": str(exc)}, status_code=400)


@router.post("/api/me/library-connector/publish")
async def api_connector_publish(request: Request, user=Depends(require_user)):
    body = await request.json()
    sid = body.get("script_id")
    if not sid:
        return json_response({"ok": False, "error": "缺 script_id"}, status_code=400)
    try:
        return json_response(await asyncio.to_thread(federation.connector_publish, user["id"], int(sid)))
    except (ValueError, PermissionError) as exc:
        return json_response({"ok": False, "error": str(exc)}, status_code=400)


# ── CLIENT:设备码流(cookie,本地引导)────────────────────────────────────
@router.post("/api/me/library-connector/device/start")
async def api_connector_device_start(request: Request, user=Depends(require_user)):
    body = await request.json()
    try:
        return json_response(await asyncio.to_thread(
            federation.connector_device_start, user["id"],
            body.get("base_url") or "", body.get("scopes") or ["library:read"]))
    except ValueError as exc:
        return json_response({"ok": False, "error": str(exc)}, status_code=400)


@router.post("/api/me/library-connector/device/poll")
async def api_connector_device_poll(request: Request, user=Depends(require_user)):
    body = await request.json()
    try:
        return json_response(await asyncio.to_thread(
            federation.connector_device_poll, user["id"],
            body.get("base_url") or "", body.get("device_code") or ""))
    except ValueError as exc:
        return json_response({"ok": False, "error": str(exc)}, status_code=400)
