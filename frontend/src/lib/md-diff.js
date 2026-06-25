// md-diff.js — Cursor/VSCode 风「AI 提议改章 → 编辑器内联 diff 审阅」(CodeMirror 6)。
// 设计:agent 提议把某章改成 newText → 把编辑器 doc 设为 newText,行级 diff 把新增行标绿(line deco)、
// 被删行以红色删除线块挂在原位(block widget),顶栏「全部批准 / 拒绝」。批准=保留新文(回调落库),
// 拒绝=还原旧文。复用 md-continue.js 同款 StateField+Decoration+showPanel 原语(零新依赖)。
import { StateField, StateEffect } from '@codemirror/state';
import { EditorView, Decoration, WidgetType, ViewPlugin, showPanel } from '@codemirror/view';

// ── 行级 LCS diff → ops:[{type:'same'|'add'|'del', text}] ──────────────────
export function lineDiff(oldText, newText) {
  const a = (oldText || '').split('\n');
  const b = (newText || '').split('\n');
  const n = a.length, m = b.length;
  // LCS 长度表(章节体量 OK;超大文本退化为「全删全增」由调用方控）。
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'del', text: a[i] }); i++; }
    else { ops.push({ type: 'add', text: b[j] }); j++; }
  }
  while (i < n) { ops.push({ type: 'del', text: a[i] }); i++; }
  while (j < m) { ops.push({ type: 'add', text: b[j] }); j++; }
  return ops;
}

// ── 被删行块组件(红色删除线)──────────────────────────────────────────────
class DelWidget extends WidgetType {
  constructor(text) { super(); this.text = text; }
  eq(o) { return o.text === this.text; }
  toDOM() {
    const d = document.createElement('div');
    d.className = 'mde-diff-del';
    d.textContent = this.text || ' ';
    return d;
  }
  ignoreEvent() { return true; }
}

// ── 状态:{ops, oldText, onAccept, onReject} | null ────────────────────────
const setChapterDiff = StateEffect.define();

export const chapterDiffField = StateField.define({
  create: () => null,
  update(val, tr) {
    let v = val;
    for (const e of tr.effects) if (e.is(setChapterDiff)) v = e.value;
    return v;
  },
});

function buildDeco(view) {
  const v = view.state.field(chapterDiffField, false);
  if (!v || !Array.isArray(v.ops)) return Decoration.none;
  const doc = view.state.doc;
  const ranges = [];
  let ln = 1;   // 当前 new-doc 行号(doc 此时即 newText,行号对齐)
  for (const op of v.ops) {
    if (op.type === 'same') { ln++; }
    else if (op.type === 'add') {
      if (ln <= doc.lines) ranges.push(Decoration.line({ class: 'mde-diff-add' }).range(doc.line(ln).from));
      ln++;
    } else { // del:在当前行起点前挂一个红色删除块
      const at = ln <= doc.lines ? doc.line(ln).from : doc.length;
      ranges.push(Decoration.widget({ widget: new DelWidget(op.text), block: true, side: -1 }).range(at));
    }
  }
  return Decoration.set(ranges, true);   // sort=true:让 CM 自己排序,避免手排出错
}

const diffPlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildDeco(view); }
  update(u) {
    if (u.docChanged || u.transactions.some((t) => t.effects.some((e) => e.is(setChapterDiff)))) {
      this.decorations = buildDeco(u.view);
    }
  }
}, { decorations: (v) => v.decorations });

export function hasChapterDiff(view) { return !!(view && view.state.field(chapterDiffField, false)); }

export function acceptChapterDiff(view) {
  const v = view.state.field(chapterDiffField, false);
  if (!v) return false;
  view.dispatch({ effects: setChapterDiff.of(null) });   // doc 已是 newText,清掉 diff 装饰
  view.focus();
  if (typeof v.onAccept === 'function') { try { v.onAccept(); } catch (_) {} }
  return true;
}

export function rejectChapterDiff(view) {
  const v = view.state.field(chapterDiffField, false);
  if (!v) return false;
  view.dispatch({   // 还原旧文 + 清 diff
    changes: { from: 0, to: view.state.doc.length, insert: v.oldText || '' },
    effects: setChapterDiff.of(null),
  });
  view.focus();
  if (typeof v.onReject === 'function') { try { v.onReject(); } catch (_) {} }
  return true;
}

// 入口:在 view 里展示「旧文→新文」的内联 diff。cbs.onAccept/onReject 在用户点批准/拒绝时回调。
export function showChapterDiff(view, oldText, newText, cbs = {}) {
  if (!view) return false;
  const ops = lineDiff(oldText || '', newText || '');
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newText || '' } });
  view.dispatch({ effects: setChapterDiff.of({ ops, oldText: oldText || '', onAccept: cbs.onAccept, onReject: cbs.onReject }) });
  view.focus();
  return true;
}

// ── 顶栏:改动统计 + 全部批准 / 拒绝 ───────────────────────────────────────
function diffPanel(view) {
  const dom = document.createElement('div');
  dom.className = 'mde-diff-panel';
  const render = (vw) => {
    const v = vw.state.field(chapterDiffField, false);
    dom.style.display = v ? 'flex' : 'none';
    dom.textContent = '';
    if (!v) return;
    const nAdd = v.ops.filter((o) => o.type === 'add').length;
    const nDel = v.ops.filter((o) => o.type === 'del').length;
    const label = document.createElement('span');
    label.className = 'mde-diff-panel-label';
    label.textContent = `AI 改动 · +${nAdd} / -${nDel} 行`;
    const ok = document.createElement('button');
    ok.className = 'mde-diff-accept'; ok.type = 'button'; ok.textContent = '全部批准';
    ok.onclick = () => acceptChapterDiff(vw);
    const no = document.createElement('button');
    no.className = 'mde-diff-reject'; no.type = 'button'; no.textContent = '拒绝';
    no.onclick = () => rejectChapterDiff(vw);
    dom.append(label, ok, no);
  };
  render(view);
  return { dom, top: true, update: (u) => render(u.view) };
}

export function chapterDiffExtension() {
  return [chapterDiffField, diffPlugin, showPanel.of(diffPanel)];
}
