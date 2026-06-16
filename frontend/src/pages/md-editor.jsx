// md-editor.jsx — VSCode 风 Markdown 编辑器(剧本知识资产内联编辑 + agent 直写)。
// 设计:docs/design/N_md_editor.md。三栏:左文件树 / 中多标签 CodeMirror / 右 agent。
// 本文件是页面壳 + 状态编排;CodeMirror 包在 components/CodeMirrorEditor.jsx(P3),
// 序列化在 lib/md-serialize.js(P2),agent 面板在 components/MdEditorAgent.jsx(P5)。
import React from 'react';
import './md-editor.css';
import { lsGet, lsSet } from '../lib/storage.js';
import CodeMirrorEditor from '../components/CodeMirrorEditor.jsx';
import MdEditorAgent from '../components/MdEditorAgent.jsx';
import { toMd, fromMd } from '../lib/md-serialize.js';
import { runContinue } from '../lib/md-continue.js';

const { useState, useEffect, useCallback, useRef } = React;

// 文件树节点类型 → 中文标签 + 排序。
const NODE_GROUPS = [
  { kind: 'chapter',   label: '章节正文', icon: '§' },
  { kind: 'card',      label: '角色卡',   icon: '@' },
  { kind: 'worldbook', label: '世界书',   icon: '#' },
  { kind: 'anchor',    label: '时间线',   icon: '~' },
  { kind: 'canon',     label: 'Canon 实体', icon: '*' },
];

const api = () => (typeof window !== 'undefined' ? window.api : null);
const toast = (msg, opts) => { try { window.__apiToast?.(msg, opts); } catch (_) {} };

// 每类实体图标 + 能力。章节删除/重排会断开 RAG 索引(chapter_index 是 chunks/facts/锚点的外键)→ 禁;
// 拖拽重排仅世界书安全(按 priority);其余实体有结构语义,不做乱序拖拽。
const KIND_ICON = { chapter: '§', card: '@', worldbook: '#', anchor: '~', canon: '*' };
const CAN_DELETE = { chapter: false, card: true, worldbook: true, anchor: true, canon: true };
const CAN_RENAME = { chapter: true, card: true, worldbook: true, anchor: true, canon: true };
const CAN_DRAG = { worldbook: true };

// ── 实体 CRUD(树内增删改) ─────────────────────────────────────────────
async function createNode(kind, sid, name) {
  const A = api(); const nm = (name || '').trim();
  if (kind === 'chapter')   { const r = await A.scripts.addChapter(sid, nm); return { id: r.chapter_index, label: `第${r.chapter_index}章 ${r.title || ''}`.trim() }; }
  if (kind === 'worldbook') { const r = await A.scripts.worldbookCreate(sid, { title: nm || '新条目', content: '' }); const e = r?.entry || r; return { id: e.id, label: e.title || nm || '新条目' }; }
  if (kind === 'card')      { const r = await A.scripts.cardUpsert(sid, { name: nm || '新角色' }); const c = r?.card || r; return { id: c.id, label: c.name || nm || '新角色' }; }
  if (kind === 'canon')     { const r = await A.scripts.canonUpsert(sid, { name: nm || '新实体', type: 'concept' }); const e = r?.entity || r; return { id: e.logical_key, label: `${e.name || nm || '新实体'}（${e.type || 'concept'}）` }; }
  if (kind === 'anchor')    { const r = await A.scripts.anchorCreate(sid, { story_time_label: nm || '新时点', chapter_min: 1, chapter_max: 1 }); const a = r?.anchor || r; return { id: a.id, label: nm || '新时点' }; }
  throw new Error('不支持新建');
}
async function renameNode(kind, sid, id, name) {
  const A = api(); const nm = (name || '').trim(); if (!nm) return;
  if (kind === 'chapter')   { await A.scripts.updateChapter(sid, id, { title: nm }); return; }
  if (kind === 'worldbook') { await A.scripts.worldbookUpdate(sid, id, { title: nm }); return; }
  if (kind === 'anchor')    { await A.scripts.anchorUpdate(sid, id, { story_phase: nm }); return; }
  // card/canon 是全覆盖 upsert → 必须 re-fetch 全字段再改名,否则抹掉头像/属性等(历史 data-loss 坑)。
  if (kind === 'card')      { const cur = await A.scripts.cardGet(sid, id); const c = cur?.card || cur; await A.scripts.cardUpsert(sid, { ...c, id, name: nm }); return; }
  if (kind === 'canon')     { const cur = await A.scripts.canonGet(sid, id); const e = cur?.entity || cur; await A.scripts.canonUpsert(sid, { ...e, logical_key: id, name: nm }); return; }
}
async function deleteNode(kind, sid, id) {
  const A = api();
  if (kind === 'worldbook') return A.scripts.worldbookDelete(sid, id);
  if (kind === 'card')      return A.scripts.cardDelete(sid, id);
  if (kind === 'anchor')    return A.scripts.anchorDelete(sid, id);
  if (kind === 'canon')     return A.scripts.canonDelete(sid, id);
  throw new Error('该类型不支持删除');
}

// ── 文件树:VSCode 风资源管理器(多组展开 / 搜索 / 图标 / 工具栏 / 键盘 / 右键 / 增删改 / 拖拽)──
function FileTree({ scriptId, openNode, activeKey, reloadKey, onMutate }) {
  const [expanded, setExpanded] = useState(() => new Set(lsGet('mde.tree.expanded2', ['chapter']) || ['chapter']));
  const [lists, setLists] = useState({});   // kind → {loading, error, items}
  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState(null);     // 键盘/焦点选中 nodeKey
  const [ctx, setCtx] = useState(null);     // 右键菜单 {x,y,kind,item|null}
  const [editing, setEditing] = useState(null); // 就地编辑 {kind, id|'__new__', value}
  const [busy, setBusy] = useState(false);
  const [dragK, setDragK] = useState(null); // 拖拽中的 worldbook nodeKey
  const bodyRef = useRef(null);

  const persistExpanded = (s) => lsSet('mde.tree.expanded2', [...s]);
  const loadGroup = useCallback(async (kind) => {
    if (!scriptId) return;
    setLists((s) => ({ ...s, [kind]: { ...(s[kind] || {}), loading: true } }));
    try {
      const items = await fetchGroupList(kind, scriptId);
      setLists((s) => ({ ...s, [kind]: { loading: false, items } }));
    } catch (e) {
      setLists((s) => ({ ...s, [kind]: { loading: false, error: e?.message || String(e), items: [] } }));
    }
  }, [scriptId]);

  // 切剧本 → 清缓存,重载所有当前展开的组。
  useEffect(() => { setLists({}); if (scriptId) [...expanded].forEach(loadGroup); /* eslint-disable-next-line */ }, [scriptId]);
  // agent / CRUD 写库后(reloadKey 变)→ 重载所有展开组(名称/数量可能变)。
  useEffect(() => { if (reloadKey && scriptId) [...expanded].forEach(loadGroup); /* eslint-disable-next-line */ }, [reloadKey]);
  // 有搜索词时:自动加载所有组(才能跨组搜),搜索时分组全展开命中。
  useEffect(() => {
    if (!scriptId || !filter.trim()) return;
    NODE_GROUPS.forEach((g) => { if (!lists[g.kind]) loadGroup(g.kind); });
    /* eslint-disable-next-line */
  }, [filter, scriptId]);

  const toggle = (kind) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind); else { next.add(kind); if (!lists[kind]) loadGroup(kind); }
      persistExpanded(next); return next;
    });
  };
  const collapseAll = () => { setExpanded((p) => { const n = new Set(); persistExpanded(n); return n; }); };

  const q = filter.trim().toLowerCase();
  const groupItems = (kind) => ((lists[kind]?.items) || []).filter((it) => !q || (it.label || '').toLowerCase().includes(q));
  const isOpen = (kind) => q ? true : expanded.has(kind);  // 搜索时所有组展开

  // 扁平可见条目(供键盘上下移动)。
  const flat = [];
  for (const g of NODE_GROUPS) if (isOpen(g.kind)) for (const it of groupItems(g.kind)) flat.push({ kind: g.kind, id: it.id, label: it.label, meta: it });

  const startNew = (kind) => { if (!isOpen(kind)) toggle(kind); setEditing({ kind, id: '__new__', value: '' }); setCtx(null); };
  const startRename = (kind, it) => { setEditing({ kind, id: it.id, value: (kind === 'chapter') ? (it.meta?.title ?? it.label) : it.label }); setCtx(null); };

  const commitEdit = async () => {
    const e = editing; if (!e) return;
    const nm = (e.value || '').trim();
    if (!nm) { setEditing(null); return; }
    setBusy(true);
    try {
      if (e.id === '__new__') {
        const created = await createNode(e.kind, scriptId, nm);
        await loadGroup(e.kind);
        onMutate?.('create', e.kind, created.id, created.label);
        openNode({ kind: e.kind, id: created.id, label: created.label });
        toast('已新建', { kind: 'ok', duration: 1100 });
      } else {
        await renameNode(e.kind, scriptId, e.id, nm);
        await loadGroup(e.kind);
        const disp = e.kind === 'chapter' ? `第${e.id}章 ${nm}`.trim() : nm;
        onMutate?.('rename', e.kind, e.id, disp);
        toast('已重命名', { kind: 'ok', duration: 1100 });
      }
    } catch (err) { toast('操作失败', { kind: 'danger', detail: err?.message }); }
    finally { setBusy(false); setEditing(null); }
  };

  const doDelete = async (kind, it) => {
    setCtx(null);
    if (!CAN_DELETE[kind]) { toast('章节删除会断开 RAG 索引,暂不支持在此删除', { kind: 'warning' }); return; }
    const ok = await (window.__confirm
      ? window.__confirm({ title: '删除该条目?', message: `${it.label}\n此操作不可恢复。`, danger: true, confirmText: '删除' })
      : Promise.resolve(confirm(`删除「${it.label}」?`)));
    if (!ok) return;
    setBusy(true);
    try {
      await deleteNode(kind, scriptId, it.id);
      await loadGroup(kind);
      onMutate?.('delete', kind, it.id);
      toast('已删除', { kind: 'ok', duration: 1100 });
    } catch (err) { toast('删除失败', { kind: 'danger', detail: err?.message }); }
    finally { setBusy(false); }
  };

  const duplicate = async (kind, it) => {
    setCtx(null);
    if (!CAN_RENAME[kind] || kind === 'chapter') { toast('该类型不支持复制', { kind: 'warning' }); return; }
    setBusy(true);
    try {
      const created = await createNode(kind, scriptId, `${it.label} 副本`);
      await loadGroup(kind); onMutate?.('create', kind, created.id, created.label);
      toast('已复制', { kind: 'ok', duration: 1100 });
    } catch (err) { toast('复制失败', { kind: 'danger', detail: err?.message }); }
    finally { setBusy(false); }
  };

  // 键盘:↑↓ 选择 / Enter 打开 / F2 改名 / Delete 删除。
  const onKeyDown = (ev) => {
    if (editing) return;
    if (!flat.length) return;
    const idx = flat.findIndex((f) => nodeKey(f.kind, f.id) === sel);
    if (ev.key === 'ArrowDown') { ev.preventDefault(); const n = flat[Math.min(flat.length - 1, idx + 1)] || flat[0]; setSel(nodeKey(n.kind, n.id)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); const n = flat[Math.max(0, idx - 1)] || flat[0]; setSel(nodeKey(n.kind, n.id)); }
    else if (ev.key === 'Enter' && idx >= 0) { ev.preventDefault(); const n = flat[idx]; openNode({ kind: n.kind, id: n.id, label: n.label, meta: n.meta }); }
    else if (ev.key === 'F2' && idx >= 0) { ev.preventDefault(); const n = flat[idx]; if (CAN_RENAME[n.kind]) startRename(n.kind, n); }
    else if (ev.key === 'Delete' && idx >= 0) { ev.preventDefault(); const n = flat[idx]; doDelete(n.kind, n); }
  };

  // 世界书拖拽重排 → 按落点重排 priority(spaced 重编号,只 PUT 变化项)。
  const onDrop = async (kind, targetIt) => {
    if (kind !== 'worldbook' || !dragK) { setDragK(null); return; }
    const items = groupItems('worldbook');
    const from = items.findIndex((x) => nodeKey('worldbook', x.id) === dragK);
    const to = items.findIndex((x) => x.id === targetIt.id);
    setDragK(null);
    if (from < 0 || to < 0 || from === to) return;
    const reordered = items.slice(); const [moved] = reordered.splice(from, 1); reordered.splice(to, 0, moved);
    setBusy(true);
    try {
      const A = api(); const n = reordered.length;
      await Promise.all(reordered.map((it, i) => {
        const np = (n - i) * 10; // 自顶向下 priority 递减
        return (it.meta?.priority === np) ? null : A.scripts.worldbookUpdate(scriptId, it.id, { priority: np });
      }).filter(Boolean));
      await loadGroup('worldbook'); onMutate?.('reorder', 'worldbook');
      toast('已重排序', { kind: 'ok', duration: 1000 });
    } catch (err) { toast('重排失败', { kind: 'danger', detail: err?.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="mde-tree" tabIndex={0} ref={bodyRef} onKeyDown={onKeyDown} onClick={() => ctx && setCtx(null)}>
      <div className="mde-tree-toolbar">
        <input className="mde-tree-filter" value={filter} placeholder="搜索全部资源…" onChange={(e) => setFilter(e.target.value)} />
        <NewMenu onPick={startNew} />
        <button className="mde-tree-tbbtn" title="折叠全部" onClick={collapseAll}>⊟</button>
        <button className="mde-tree-tbbtn" title="刷新" onClick={() => [...expanded].forEach(loadGroup)}>⟳</button>
      </div>
      <div className="mde-tree-body">
        {NODE_GROUPS.map((g) => {
          const st = lists[g.kind] || {};
          const open = isOpen(g.kind);
          const items = groupItems(g.kind);
          if (q && open && items.length === 0 && (st.items || []).length) return null; // 搜索时无命中的组隐藏
          return (
            <div key={g.kind} className="mde-tree-group">
              <div className="mde-tree-grouprow" onContextMenu={(e) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, kind: g.kind, item: null }); }}>
                <button className={'mde-tree-grouphead' + (open ? ' open' : '')} onClick={() => toggle(g.kind)}>
                  <span className="mde-tree-caret">{open ? '▾' : '▸'}</span>
                  <span className="mde-tree-gicon">{g.icon}</span>
                  <span className="mde-tree-glabel">{g.label}</span>
                  {st.items && <span className="mde-tree-count">{q ? items.length : st.items.length}</span>}
                </button>
                {CAN_CREATE_KIND(g.kind) && <button className="mde-tree-additem" title={`新建${g.label}`} onClick={(e) => { e.stopPropagation(); startNew(g.kind); }}>＋</button>}
              </div>
              {open && (
                <div className="mde-tree-children">
                  {st.loading && <div className="mde-tree-hint">加载中…</div>}
                  {st.error && <div className="mde-tree-hint err">加载失败:{st.error}</div>}
                  {editing && editing.kind === g.kind && editing.id === '__new__' && (
                    <input className="mde-tree-edit" autoFocus value={editing.value}
                      placeholder={`新${g.label}名称`} disabled={busy}
                      onChange={(e) => setEditing((s) => ({ ...s, value: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); }}
                      onBlur={commitEdit} />
                  )}
                  {!st.loading && !st.error && items.length === 0 && !(editing && editing.id === '__new__' && editing.kind === g.kind) && <div className="mde-tree-hint">（空）</div>}
                  {items.map((it) => {
                    const k = nodeKey(g.kind, it.id);
                    if (editing && editing.kind === g.kind && editing.id === it.id) {
                      return (
                        <input key={k} className="mde-tree-edit" autoFocus value={editing.value} disabled={busy}
                          onChange={(e) => setEditing((s) => ({ ...s, value: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); }}
                          onBlur={commitEdit} />
                      );
                    }
                    return (
                      <div
                        key={k}
                        className={'mde-tree-item' + (activeKey === k ? ' active' : '') + (sel === k ? ' sel' : '') + (dragK === k ? ' dragging' : '')}
                        title={it.label}
                        draggable={!!CAN_DRAG[g.kind]}
                        onDragStart={() => CAN_DRAG[g.kind] && setDragK(k)}
                        onDragOver={(e) => CAN_DRAG[g.kind] && dragK && e.preventDefault()}
                        onDrop={() => onDrop(g.kind, it)}
                        onClick={() => { setSel(k); openNode({ kind: g.kind, id: it.id, label: it.label, meta: it }); }}
                        onDoubleClick={() => CAN_RENAME[g.kind] && startRename(g.kind, it)}
                        onContextMenu={(e) => { e.preventDefault(); setSel(k); setCtx({ x: e.clientX, y: e.clientY, kind: g.kind, item: it }); }}
                      >
                        <span className="mde-tree-iicon">{KIND_ICON[g.kind]}</span>
                        <span className="mde-tree-ilabel">{it.label || `(${g.kind} ${it.id})`}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {ctx && (
        <div className="mde-ctx" style={{ left: ctx.x, top: ctx.y }} onClick={(e) => e.stopPropagation()}>
          {ctx.item ? (
            <>
              <button onClick={() => { openNode({ kind: ctx.kind, id: ctx.item.id, label: ctx.item.label, meta: ctx.item }); setCtx(null); }}>打开</button>
              {CAN_RENAME[ctx.kind] && <button onClick={() => startRename(ctx.kind, ctx.item)}>重命名</button>}
              {CAN_RENAME[ctx.kind] && ctx.kind !== 'chapter' && <button onClick={() => duplicate(ctx.kind, ctx.item)}>复制</button>}
              {CAN_DELETE[ctx.kind]
                ? <button className="danger" onClick={() => doDelete(ctx.kind, ctx.item)}>删除</button>
                : <button disabled title="章节删除会断开 RAG 索引">删除(章节不可)</button>}
            </>
          ) : (
            CAN_CREATE_KIND(ctx.kind) && <button onClick={() => startNew(ctx.kind)}>新建{NODE_GROUPS.find((g) => g.kind === ctx.kind)?.label}</button>
          )}
        </div>
      )}
    </div>
  );
}

const CAN_CREATE_KIND = () => true; // 5 类都支持新建
function NewMenu({ onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mde-newmenu">
      <button className="mde-tree-tbbtn" title="新建" onClick={() => setOpen((o) => !o)}>＋</button>
      {open && (
        <div className="mde-newmenu-pop" onMouseLeave={() => setOpen(false)}>
          {NODE_GROUPS.map((g) => (
            <button key={g.kind} onClick={() => { setOpen(false); onPick(g.kind); }}>
              <span className="mde-tree-gicon">{g.icon}</span> {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const nodeKey = (kind, id) => `${kind}:${id}`;

// 每组的列表拉取 —— 复用 window.api.scripts.* / api.cards.*。
async function fetchGroupList(kind, sid) {
  const A = api();
  if (kind === 'chapter') {
    const r = await A.scripts.chapters(sid, { limit: 5000 });
    const arr = r?.chapters || r?.items || [];
    return arr.map((c) => ({ id: c.chapter_index, label: `第${c.chapter_index}章 ${c.title || ''}`.trim(), word_count: c.word_count }));
  }
  if (kind === 'card') {
    const r = await A.cards.scriptList(sid);
    const arr = Array.isArray(r) ? r : (r?.items || []);
    return arr.map((c) => ({ id: c.id, label: c.name + (c.full_name && c.full_name !== c.name ? ` (${c.full_name})` : '') }));
  }
  if (kind === 'worldbook') {
    const r = await A.scripts.worldbook(sid);
    const arr = r?.entries || r?.items || (Array.isArray(r) ? r : []);
    return arr.map((w) => ({ id: w.id, label: w.title || `(条目 ${w.id})` }));
  }
  if (kind === 'anchor') {
    const r = await A.scripts.timeline(sid);
    const phases = r?.phases || [];
    const out = [];
    for (const ph of phases) for (const a of (ph.anchors || [])) {
      out.push({ id: a.anchor_id || a.id, label: `${a.story_time_label || ph.phase_label || ''}（${a.chapter_min}-${a.chapter_max}）` });
    }
    return out;
  }
  if (kind === 'canon') {
    // canon-entities 列表端点在 P1 新增;暂经 graph 端点兜底。
    if (A.scripts.canonList) {
      const r = await A.scripts.canonList(sid);
      const arr = r?.entities || r?.items || [];
      return arr.map((e) => ({ id: e.logical_key, label: `${e.name}（${e.type}）` }));
    }
    try {
      const r = await A.scripts.graph(sid);
      const arr = r?.entities || [];
      return arr.map((e) => ({ id: e.logical_key, label: `${e.name}（${e.type}）` }));
    } catch (_) { return []; }
  }
  return [];
}

// ── 标签编辑器(P0:textarea;P3 替换为 CodeMirror)──────────────────────
function EditorPane({ tab, onChange, scriptId, onViewReady, onContinueAccept, chapterIndex }) {
  if (!tab) {
    return <div className="mde-empty">从左侧选择一个文件开始编辑<br /><span className="muted">章节正文 / 角色卡 / 世界书 / 时间线 / Canon</span></div>;
  }
  if (tab.loading) return <div className="mde-empty">加载中…</div>;
  if (tab.error) return <div className="mde-empty err">加载失败:{tab.error}</div>;
  return (
    <CodeMirrorEditor
      value={tab.content}
      docKey={tab.key}
      onChange={(v) => onChange(tab.key, v)}
      scriptId={scriptId}
      onViewReady={onViewReady}
      onContinueAccept={onContinueAccept}
      chapterIndex={chapterIndex}
    />
  );
}

// ── 主页面 ───────────────────────────────────────────────────────────
export default function MdEditorPage() {
  const [scripts, setScripts] = useState(null);
  const [scriptId, setScriptId] = useState(() => lsGet('mde.scriptId', null));
  const [tabs, setTabs] = useState([]);          // [{key, kind, id, label, content, original, loading, error, dirty}]
  const [activeKey, setActiveKey] = useState(null);
  const [treeReloadKey, setTreeReloadKey] = useState(0);   // agent 写库后 bump,触发文件树重载
  const activeViewRef = useRef(null);                      // 当前 CodeMirror 视图(供侧栏「续写到正文」)
  const agentRef = useRef(null);                           // MdEditorAgent 命令句柄(续写后同步桥接)
  const activeRef = useRef(null);                          // 当前标签(在接受续写的回调里读最新 label)
  const [syncNudge, setSyncNudge] = useState(null);        // 接受续写后提示同步:{text, label, rewrite} | null

  // 拉剧本列表(仅自己拥有的可编辑)。
  useEffect(() => {
    (async () => {
      try {
        const r = await api().scripts.list();
        const arr = r?.items || r?.scripts || (Array.isArray(r) ? r : []);
        const owned = arr.filter((s) => s.is_owner !== false && s.role !== 'subscriber');
        setScripts(owned);
        if (!scriptId && owned[0]) { setScriptId(owned[0].id); lsSet('mde.scriptId', owned[0].id); }
      } catch (e) { setScripts([]); toast('剧本列表加载失败', { kind: 'danger', detail: e?.message }); }
    })();
    // eslint-disable-next-line
  }, []);

  const pickScript = (id) => { setScriptId(id); lsSet('mde.scriptId', id); setTabs([]); setActiveKey(null); };

  // 作者优先:从零新建空白剧本 → 切到它(自动带第1章)。
  const createBlankScript = async () => {
    try {
      const r = await api().scripts.createBlank('新剧本');
      if (!r?.script_id) throw new Error(r?.error || '创建失败');
      setScripts((prev) => [{ id: r.script_id, title: r.title }, ...(prev || [])]);
      pickScript(r.script_id);
      toast('已新建空白剧本', { kind: 'ok', duration: 1400 });
    } catch (e) { toast('新建剧本失败', { kind: 'danger', detail: e?.message }); }
  };
  // 给当前剧本追加一章并打开。
  const addChapter = async () => {
    if (!scriptId) return;
    try {
      const r = await api().scripts.addChapter(scriptId, '');
      if (!r?.chapter_index) throw new Error(r?.error || '创建失败');
      setTreeReloadKey((x) => x + 1);
      openNode({ kind: 'chapter', id: r.chapter_index, label: `第${r.chapter_index}章 ${r.title || ''}`.trim() });
      toast('已新建章节', { kind: 'ok', duration: 1200 });
    } catch (e) { toast('新建章节失败', { kind: 'danger', detail: e?.message }); }
  };

  // 打开节点 → 新标签(或激活已开)。
  const openNode = useCallback(async (node) => {
    const key = nodeKey(node.kind, node.id);
    setActiveKey(key);
    setTabs((cur) => {
      if (cur.some((t) => t.key === key)) return cur;
      return [...cur, { key, kind: node.kind, id: node.id, label: node.label, content: '', original: '', loading: true, error: null, dirty: false }];
    });
    try {
      const content = await loadNodeContent(node.kind, scriptId, node.id);
      setTabs((cur) => cur.map((t) => t.key === key ? { ...t, content, original: content, loading: false } : t));
    } catch (e) {
      setTabs((cur) => cur.map((t) => t.key === key ? { ...t, loading: false, error: e?.message || String(e) } : t));
    }
  }, [scriptId]);

  const onEdit = useCallback((key, val) => {
    setTabs((cur) => cur.map((t) => t.key === key ? { ...t, content: val, dirty: val !== t.original } : t));
  }, []);

  const closeTab = useCallback(async (key) => {
    const t = tabs.find((x) => x.key === key);
    if (t?.dirty) {
      const ok = await (window.__confirm ? window.__confirm({ title: '放弃未保存的修改?', message: t.label, danger: true, confirmText: '放弃' }) : Promise.resolve(confirm('放弃未保存的修改?')));
      if (!ok) return;
    }
    setTabs((cur) => {
      const idx = cur.findIndex((x) => x.key === key);
      const next = cur.filter((x) => x.key !== key);
      if (activeKey === key) setActiveKey(next[Math.max(0, idx - 1)]?.key || null);
      return next;
    });
  }, [tabs, activeKey]);

  const saveTab = useCallback(async (key) => {
    const t = tabs.find((x) => x.key === key);
    if (!t || !t.dirty) return;
    setTabs((cur) => cur.map((x) => x.key === key ? { ...x, saving: true } : x));
    try {
      await saveNodeContent(t.kind, scriptId, t.id, t.content, t.original);
      setTabs((cur) => cur.map((x) => x.key === key ? { ...x, original: t.content, dirty: false, saving: false } : x));
      toast('已保存', { kind: 'ok', duration: 1200 });
    } catch (e) {
      setTabs((cur) => cur.map((x) => x.key === key ? { ...x, saving: false } : x));
      toast('保存失败', { kind: 'danger', detail: e?.message });
    }
  }, [tabs, scriptId]);

  // agent 写库后:重载受影响的标签(若打开且无未保存改动)+ 刷新文件树。
  const refreshTab = useCallback(async (kind, id) => {
    setTreeReloadKey((x) => x + 1);
    const key = nodeKey(kind, id);
    const t = tabs.find((x) => x.key === key);
    if (!t) return;
    if (t.dirty) { toast('AI 改了这条,但你有未保存修改,未自动刷新', { kind: 'warn', duration: 2600 }); return; }
    try {
      const content = await loadNodeContent(kind, scriptId, id);
      setTabs((cur) => cur.map((x) => x.key === key ? { ...x, content, original: content, dirty: false } : x));
      toast('AI 已修改,已刷新', { kind: 'ok', duration: 1400 });
    } catch (_) { /* 静默 */ }
  }, [tabs, scriptId]);

  // 资源管理器增删改后:同步已打开的标签(删→关、改名→更新标题),并触发树重载。
  const onTreeMutate = useCallback((action, kind, id, label) => {
    const key = nodeKey(kind, id);
    if (action === 'delete') {
      setTabs((cur) => {
        const idx = cur.findIndex((t) => t.key === key);
        const next = cur.filter((t) => t.key !== key);
        if (activeKey === key) setActiveKey(next[Math.max(0, idx - 1)]?.key || null);
        return next;
      });
    } else if (action === 'rename' && label) {
      setTabs((cur) => cur.map((t) => t.key === key ? { ...t, label } : t));
    }
  }, [activeKey]);

  // 接受一段续写/改写后的桥接:够长就提示「要不要让助手把新设定同步进知识库」。
  // (续写引擎只产纯文本不落库,知识同步只能由右栏 agent 触发 —— 这条桥接把两路打通。)
  const onProseAccepted = useCallback((text, info) => {
    const t = (text || '').trim();
    if (t.length < 12) return;   // 太短(单词级)不打扰
    setSyncNudge({ text: t, label: activeRef.current?.label || '正文', rewrite: !!(info && info.rewrite) });
  }, []);

  // 侧栏「续写到正文」:对当前打开的章节正文,在光标处(或选中段)用 AI 续写/改写。
  const onContinue = useCallback((instruction) => {
    const view = activeViewRef.current;
    if (!view) { toast('请先打开一个文件再续写', { kind: 'warn' }); return; }
    const _a = activeRef.current;
    const _ci = (_a && _a.kind === 'chapter') ? _a.id : null;   // 章号→后端装配相关设定+防剧透
    runContinue(view, { scriptId, instruction, onAccept: onProseAccepted, chapterIndex: _ci });
  }, [scriptId, onProseAccepted]);

  // 「同步设定」:把刚接受的正文丢给右栏 agent,按 rule 4 读现状 + 同步知识资产。
  const doSync = useCallback(() => {
    const n = syncNudge;
    if (!n) return;
    setSyncNudge(null);
    try { agentRef.current?.syncFromProse(n.text, n.label, n.rewrite); } catch (_) { /* 静默 */ }
  }, [syncNudge]);

  // Cmd/Ctrl+S 保存当前标签。
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (activeKey) saveTab(activeKey);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeKey, saveTab]);

  const active = tabs.find((t) => t.key === activeKey) || null;
  activeRef.current = active;

  return (
    <div className="mde-root">
      {/* 顶栏:剧本选择 */}
      <div className="mde-topbar">
        <span className="mde-brand">MD 编辑器</span>
        <select className="mde-script-select" value={scriptId || ''} onChange={(e) => pickScript(Number(e.target.value) || e.target.value)}>
          {scripts === null && <option>加载剧本…</option>}
          {scripts && scripts.length === 0 && <option value="">（无可编辑剧本）</option>}
          {(scripts || []).map((s) => <option key={s.id} value={s.id}>{s.title || `剧本 ${s.id}`}</option>)}
        </select>
        <button className="mde-newbtn" onClick={createBlankScript} title="从零创建空白剧本(作者优先,自带第1章)">+ 空白剧本</button>
        {scriptId && <button className="mde-newbtn" onClick={addChapter} title="给当前剧本追加一章并打开">+ 章节</button>}
        {active && active.dirty && <button className="mde-save" onClick={() => saveTab(active.key)} disabled={active.saving}>{active.saving ? '保存中…' : '保存 (⌘S)'}</button>}
      </div>

      <div className="mde-panes">
        {/* 左:文件树 */}
        <aside className="mde-left">
          {scriptId ? <FileTree scriptId={scriptId} openNode={openNode} activeKey={activeKey} reloadKey={treeReloadKey} onMutate={onTreeMutate} /> : <div className="mde-tree-hint">先选剧本</div>}
        </aside>

        {/* 中:标签 + 编辑器 */}
        <main className="mde-center">
          <div className="mde-tabs">
            {tabs.map((t) => (
              <div key={t.key} className={'mde-tab' + (t.key === activeKey ? ' active' : '')} onClick={() => setActiveKey(t.key)}>
                <span className="mde-tab-label">{t.dirty ? '● ' : ''}{t.label}</span>
                <span className="mde-tab-close" onClick={(e) => { e.stopPropagation(); closeTab(t.key); }}>×</span>
              </div>
            ))}
          </div>
          <EditorPane tab={active} onChange={onEdit} scriptId={scriptId} onViewReady={(v) => { activeViewRef.current = v; }} onContinueAccept={onProseAccepted} chapterIndex={active && active.kind === 'chapter' ? active.id : null} />
          {syncNudge && (
            <div className="mde-syncbar">
              <span className="mde-syncbar-text">
                刚{syncNudge.rewrite ? '改写' : '续写'}的内容若引入或改变了设定,要让助手同步进角色卡 / 世界书 / 时间线吗?
              </span>
              <button className="mde-syncbar-go" onClick={doSync}>同步设定</button>
              <button className="mde-syncbar-no" onClick={() => setSyncNudge(null)}>忽略</button>
            </div>
          )}
        </main>

        {/* 右:agent 直写面板(console_assistant SSE)+ 续写到正文 */}
        <aside className="mde-right">
          {scriptId
            ? <MdEditorAgent ref={agentRef} scriptId={scriptId} activeTab={active} onWriteComplete={refreshTab} onContinue={onContinue} />
            : <div className="mde-tree-hint">先选剧本</div>}
        </aside>
      </div>
    </div>
  );
}

// ── 节点内容 加载:GET 行 → md-serialize.toMd ─────────────────────────────
async function loadNodeContent(kind, sid, id) {
  const row = await loadRow(kind, sid, id);
  return toMd(kind, row);
}

async function loadRow(kind, sid, id) {
  const A = api();
  if (kind === 'chapter') {
    const r = await A.scripts.chapterDetail(sid, id);
    return r?.chapter ?? r ?? {};
  }
  if (kind === 'card') {
    const r = await A.cards.scriptGet(sid, id);
    return r?.card ?? r ?? {};
  }
  if (kind === 'worldbook') {
    const r = await A.scripts.worldbook(sid);
    const arr = r?.entries || r?.items || (Array.isArray(r) ? r : []);
    return arr.find((x) => String(x.id) === String(id)) || {};
  }
  if (kind === 'anchor') {
    // timeline 端点按 phase 聚合,锚点字段是子集(无 keywords/sample_title);
    // diff-based 保存只发改动字段,故未加载字段不会被覆盖(见 saveNodeContent)。
    const r = await A.scripts.timeline(sid);
    for (const ph of (r?.phases || [])) for (const a of (ph.anchors || [])) {
      if (String(a.anchor_id || a.id) === String(id)) {
        return { ...a, id: a.anchor_id || a.id, story_phase: a.story_phase || ph.phase_label || '' };
      }
    }
    return { id };
  }
  if (kind === 'canon') {
    if (A.scripts.canonGet) { const r = await A.scripts.canonGet(sid, id); return r?.entity ?? r ?? {}; }
    // 兜底:列表里找
    if (A.scripts.canonList) {
      const r = await A.scripts.canonList(sid);
      const arr = r?.entities || r?.items || [];
      return arr.find((e) => String(e.logical_key) === String(id)) || { logical_key: id };
    }
    return { logical_key: id };
  }
  return {};
}

// ── 节点内容 保存:fromMd(当前) vs fromMd(原始) 求 diff,只发改动字段 ──────────
async function saveNodeContent(kind, sid, id, content, original) {
  const A = api();
  const cur = fromMd(kind, content);
  const orig = original != null ? fromMd(kind, original) : {};
  const diff = diffPatch(orig, cur);
  if (Object.keys(diff).length === 0) return;   // 无实际改动

  if (kind === 'chapter') {
    await A.scripts.updateChapter(sid, id, diff);   // 收 {title?, content?, volume_title?}
    return;
  }
  if (kind === 'card') {
    // 后端 upsert_character_card 是「全量覆盖」(缺字段→清空,含 SCHEMA 不覆盖的 avatar/metadata/
    // token_budget/priority 等)。只发 diff 会抹掉这些 → 重新拉全卡、叠加本次编辑的可写字段、整卡回写。
    const full = await A.cards.scriptGet(sid, id);
    const base = (full && full.card) ? full.card : (full || {});
    await A.cards.scriptUpsert(sid, { ...base, id, ...cur });
    return;
  }
  if (kind === 'worldbook') {
    await A.scripts.worldbookUpdate(sid, id, diff);
    return;
  }
  if (kind === 'anchor') {
    if (!A.scripts.anchorUpdate) throw new Error('时间线写端点未就绪(需后端 P1)');
    await A.scripts.anchorUpdate(sid, id, diff);
    return;
  }
  if (kind === 'canon') {
    if (!A.scripts.canonUpsert) throw new Error('canon 写端点未就绪(需后端 P1)');
    await A.scripts.canonUpsert(sid, { logical_key: id, ...diff });
    return;
  }
  throw new Error(`未知实体类型:${kind}`);
}

// 浅 diff:返回 cur 中与 orig 不同(深比较值)的键。
function diffPatch(orig, cur) {
  const out = {};
  for (const k of Object.keys(cur)) {
    if (!deepEq(orig[k], cur[k])) out[k] = cur[k];
  }
  return out;
}
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEq(a[k], b[k]));
  }
  return false;
}
