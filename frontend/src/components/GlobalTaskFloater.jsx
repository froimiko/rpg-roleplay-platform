import React from 'react';
import { createPortal } from 'react-dom';
import CSFlashbar from '@cloudscape-design/components/flashbar';
import CSProgressBar from '@cloudscape-design/components/progress-bar';
import CSButton from '@cloudscape-design/components/button';

/* GlobalTaskFloater — 右下角全局「后台任务」浮窗。
   数据源:GET /api/me/tasks/active(导入 / 各模块重建 / 生图 统一聚合)。
   设计原则(按用户要求):
     · 用 Cloudscape Flashbar(stackItems 折叠)现成组件 + 全局暖色主题,不自重设计;
     · 如实状态:import 类有真实进度条(overall_progress),生图只给 spinner + 已用时间
       (provider 不吐进度,绝不放假百分比);
     · 只在有进行中任务时出现;完成 / 失败用现有 toast 给一次性提示;
     · 可折叠(收起成小药丸)/ 展开。
   挂载:平台 / 游戏台 / 酒馆 三个独立入口各 import 一次,createPortal 到 document.body。
*/

const POLL_ACTIVE_MS = 3000;
const POLL_IDLE_MS = 7000;
const POLL_BACKOFF_MS = 60000;   // 401 / 网络错时退避(登出页 / 掉线不刷屏)

function fmtElapsed(sec) {
  sec = Math.max(0, Math.floor(sec));
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return m + 'm' + (s ? ' ' + s + 's' : '');
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm';
}

const ACTIVE_ST = { queued: 1, running: 1 };

// 暖色板(对齐全站主题:#c96442 强调橙 / 暖深底 / 暖浅字)。loading=true 的项渲染成 info 态,
// 故覆盖 info 颜色。Cloudscape v3 的 style prop 精确改各 type 颜色,不必 CSS hack。
const FLASHBAR_STYLE = {
  item: {
    root: {
      background: { info: '#2a2620' },
      color: { info: '#ebe7df' },
      borderColor: { info: '#46413a' },
    },
  },
};
const PROGRESS_STYLE = {
  progressValue: { backgroundColor: '#c96442' },
  progressBar: { backgroundColor: 'rgba(201,100,66,0.18)' },
};

export default function GlobalTaskFloater() {
  const { useState, useEffect, useRef } = React;
  const [tasks, setTasks] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [, tick] = useState(0);               // 每秒重渲染刷新"已用时间"
  const mounted = useRef(true);
  const prevActive = useRef(new Set());
  const toasted = useRef(new Set());

  // ── 轮询(自调度 setTimeout 循环;隐藏标签页退避;事件可即时唤醒)──
  useEffect(() => {
    mounted.current = true;
    let timer = null;
    const api = (typeof window !== 'undefined' && window.api) || null;

    const schedule = (ms) => { if (timer) clearTimeout(timer); timer = setTimeout(run, ms); };

    const run = async () => {
      if (!mounted.current) return;
      if (!api || !api.tasks || !api.tasks.active) return schedule(POLL_BACKOFF_MS);
      if (typeof document !== 'undefined' && document.hidden) return schedule(POLL_IDLE_MS);
      try {
        const r = await api.tasks.active();
        if (!mounted.current) return;
        const list = (r && r.tasks) || [];
        const byId = {};
        list.forEach((t) => { byId[t.id] = t; });
        const curActive = new Set(list.filter((t) => ACTIVE_ST[t.status]).map((t) => t.id));
        // 上轮活跃、本轮不再活跃 → 用现有 toast 给一次性"完成 / 失败"提示
        prevActive.current.forEach((id) => {
          if (curActive.has(id) || toasted.current.has(id)) return;
          const t = byId[id];
          if (!t) return;                       // 已超出"最近结束"窗口,静默
          const toast = (typeof window !== 'undefined' && window.__apiToast) || null;
          if (!toast) return;                   // toast 通道不可用:先不标记,留待下次轮询重试
          toasted.current.add(id);
          if (t.status === 'done') toast(t.title + ' 已完成', { kind: 'ok', duration: 3500 });
          else if (t.status === 'done_with_errors') toast(t.title + ' 完成(有警告)', { kind: 'warning', duration: 5000 });
          else if (t.status === 'failed') toast(t.title + ' 失败' + (t.error ? '：' + t.error : ''), { kind: 'danger', duration: 7000 });
          else if (t.status === 'cancelled') toast(t.title + ' 已取消', { kind: 'info', duration: 3000 });
        });
        prevActive.current = curActive;
        if (toasted.current.size > 80) {
          toasted.current = new Set([...toasted.current].filter((id) => byId[id]));
        }
        setTasks(list);
        setFetchedAt(Date.now());
        schedule(curActive.size > 0 ? POLL_ACTIVE_MS : POLL_IDLE_MS);
      } catch (e) {
        if (!mounted.current) return;
        const st = e && e.status;
        schedule(st === 401 ? POLL_BACKOFF_MS : POLL_IDLE_MS);
      }
    };

    const kick = () => { if (timer) clearTimeout(timer); run(); };
    const onVis = () => { if (!document.hidden) kick(); };

    run();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    window.addEventListener('rpg-task-refresh', kick);     // 触发方(生图/重建)可即时唤醒
    return () => {
      mounted.current = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      window.removeEventListener('rpg-task-refresh', kick);
    };
  }, []);

  const active = tasks.filter((t) => ACTIVE_ST[t.status]);

  // 每秒刷新"已用时间"(仅在有活跃任务时)
  useEffect(() => {
    if (active.length === 0) return undefined;
    const id = setInterval(() => { if (mounted.current) tick((x) => x + 1); }, 1000);
    return () => clearInterval(id);
  }, [active.length]);

  if (active.length === 0) return null;        // 只在有进行中任务时出现

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  // 收起态:右下角一个小药丸,显示进行中数量,点开展开
  if (collapsed) {
    const pill = (
      <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1500 }}>
        <CSButton iconName="status-in-progress" onClick={() => setCollapsed(false)}>
          {active.length} 个后台任务
        </CSButton>
      </div>
    );
    return createPortal(pill, portalTarget);
  }

  const nowMs = Date.now();
  const items = active.map((t) => {
    const elapsed = fmtElapsed((t.elapsed_sec || 0) + (fetchedAt ? (nowMs - fetchedAt) / 1000 : 0));
    const hasProg = t.progress != null && t.progress_total;
    const pct = hasProg ? Math.max(0, Math.min(100, Math.round((t.progress / t.progress_total) * 100))) : 0;
    const statusText = (t.status === 'queued' ? '排队中' : '进行中')
      + (t.phase ? ' · ' + t.phase : '')
      + ' · 已用 ' + elapsed;
    return {
      id: t.id,
      loading: true,             // Cloudscape:loading 自带 spinner(渲染为 info 态)
      dismissible: false,
      header: t.title,
      content: (
        <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          <div style={{ opacity: 0.85 }}>{statusText}</div>
          {hasProg && (
            <div style={{ marginTop: 5 }}>
              <CSProgressBar variant="flash" status="in-progress" value={pct} style={PROGRESS_STYLE} />
            </div>
          )}
        </div>
      ),
    };
  });

  const dock = (
    <div className="rpg-task-dock"
      style={{ position: 'fixed', right: 16, bottom: 16, width: 360, maxWidth: 'calc(100vw - 32px)', zIndex: 1500 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <CSButton variant="icon" iconName="angle-down" ariaLabel="收起后台任务" onClick={() => setCollapsed(true)} />
      </div>
      <CSFlashbar
        items={items}
        stackItems={items.length > 1}
        style={FLASHBAR_STYLE}
        i18nStrings={{
          ariaLabel: '后台任务',
          notificationBarText: active.length + ' 个后台任务进行中',
          notificationBarAriaLabel: '展开 / 收起后台任务',
          errorIconAriaLabel: '错误',
          successIconAriaLabel: '完成',
          warningIconAriaLabel: '警告',
          infoIconAriaLabel: '进行中',
          inProgressIconAriaLabel: '进行中',
        }}
      />
    </div>
  );
  return createPortal(dock, portalTarget);
}
