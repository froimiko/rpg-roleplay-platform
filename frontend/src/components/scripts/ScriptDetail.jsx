/* 剧本详情面板 + 子组件(版本历史 Drawer / 共享模式 / 封面 / KB 提取面板)。
   从 pages/scripts.jsx 拆出,JSX / props 流逐字节不变。 */

import React from 'react';
import { useState as useStatePL, useEffect as useEffectPL } from 'react';
import { useTranslation } from 'react-i18next';
import { CardEditModal, cardSnippet, npcToUserCardBody } from '../../pages/cards.jsx';
import { WorldbookEditorView } from '../../pages/script-edit-worldbook.jsx';
import { CanonEntityEditorView } from '../../pages/script-edit-canon.jsx';
import { useScriptRebuild, ModuleRebuildPanel } from '../../pages/script-modules-panel.jsx';
import AgentModelPicker from '../AgentModelPicker.jsx';
import GmStyleEditor from '../GmStyleEditor.jsx';
import AvatarImg from '../AvatarImg.jsx';
import MediaStudio from '../MediaStudio.jsx';
import { ModuleStatusCard } from '../ModuleStatusCard.jsx';
import { ModuleMatrixOverview } from '../ModuleMatrixOverview.jsx';
import { RebuildJobBanner } from '../RebuildJobBanner.jsx';
import { RebuildEstimateModal } from '../RebuildEstimateModal.jsx';
import { scriptPlayBlockReason } from './shared.js';
import CSHeader from '@cloudscape-design/components/header';
import CSTable from '@cloudscape-design/components/table';
import CSContainer from '@cloudscape-design/components/container';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSButton from '@cloudscape-design/components/button';
import CSButtonDropdown from '@cloudscape-design/components/button-dropdown';
import CSBox from '@cloudscape-design/components/box';
import CSBadge from '@cloudscape-design/components/badge';
import CSStatusIndicator from '@cloudscape-design/components/status-indicator';
import CSFormField from '@cloudscape-design/components/form-field';
import CSInput from '@cloudscape-design/components/input';
import CSSelect from '@cloudscape-design/components/select';
import CSKeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import CSAlert from '@cloudscape-design/components/alert';
import CSProgressBar from '@cloudscape-design/components/progress-bar';
import CSModal from '@cloudscape-design/components/modal';
import CSColumnLayout from '@cloudscape-design/components/column-layout';
import CSSegmentedControl from '@cloudscape-design/components/segmented-control';
import CSCards from '@cloudscape-design/components/cards';
import CSTabs from '@cloudscape-design/components/tabs';

/* ─── 版本历史 Drawer ────────────────────────────────────────────
   GET /api/scripts/{id}/commits?limit=30&cursor=X
   支持 cursor 翻页;当前 head_commit_id 行标 "current" badge;
   owner 可点回滚,非 owner disabled。 */
function VersionHistoryDrawer({ script, currentUserId, onClose }) {
  const { t } = useTranslation();
  const [commits, setCommits] = useStatePL([]);
  const [loading, setLoading] = useStatePL(false);
  const [cursor, setCursor] = useStatePL(null);
  const [hasMore, setHasMore] = useStatePL(false);
  const [rollingBack, setRollingBack] = useStatePL(null);

  const loadCommits = React.useCallback(async (c = null) => {
    if (!script) return;
    setLoading(true);
    try {
      const params = { limit: 30 };
      if (c) params.cursor = c;
      const r = await window.api.scripts.commits(script.id, params);
      const list = Array.isArray(r) ? r : (r?.items || r?.commits || []);
      const nextCursor = r?.next_cursor || null;
      if (c) {
        setCommits(prev => [...prev, ...list]);
      } else {
        setCommits(list);
      }
      setCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch (_) {
      window.__apiToast?.(t('scripts.version.load_fail'), { kind: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [script?.id]);

  useEffectPL(() => {
    if (script) loadCommits(null);
  }, [script?.id, loadCommits]);

  const isOwner = script && currentUserId && script.owner_id === currentUserId;

  const onRollback = async (commit) => {
    if (!await window.__confirm({
      title: t('scripts.version.rollback_confirm', { id: String(commit.id ?? '').slice(0, 8) }),
      danger: true,
      confirmText: t('scripts.version.rollback_btn'),
    })) return;
    setRollingBack(commit.id);
    try {
      await window.api.scripts.checkout(script.id, commit.id);
      window.__apiToast?.(t('scripts.version.rollback_ok', { id: String(commit.id ?? '').slice(0, 8) }), { kind: 'ok' });
      try { window.dispatchEvent(new CustomEvent('rpg-scripts-updated')); } catch (_) {}
      onClose && onClose();
    } catch (e) {
      window.__apiToast?.(t('scripts.version.rollback_fail'), { kind: 'danger', detail: e?.message });
    } finally {
      setRollingBack(null);
    }
  };

  // ESC 关闭 + 点 backdrop 关闭
  useEffectPL(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!script) return null;

  return (
    <>
    {/* 半透明 backdrop:点击关闭 + 阻止鼠标事件穿透到下层主页面 */}
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.35)', zIndex: 899,
    }} />
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(560px, 92vw)',
      background: 'var(--panel, #1a1d22)', borderLeft: '1px solid var(--line-soft)',
      zIndex: 900, display: 'flex', flexDirection: 'column', overflowY: 'auto',
      boxShadow: '-4px 0 16px rgba(0,0,0,0.35)',
    }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <CSBox variant="h3" padding="n">{t('scripts.version.drawer_title')} · {script.title}</CSBox>
        <CSButton variant="normal" iconName="close" onClick={onClose}>{t('common.close')}</CSButton>
      </div>
      <div style={{ flex: 1, padding: '12px 16px' }}>
        <CSTable
          variant="embedded"
          loading={loading && commits.length === 0}
          loadingText={t('common.loading')}
          items={commits}
          trackBy="id"
          columnDefinitions={[
            {
              id: 'commit', header: t('scripts.version.col_commit'), width: 110,
              cell: (c) => (
                <CSSpaceBetween direction="horizontal" size="xxs" alignItems="center">
                  <span className="mono" style={{ fontSize: 12 }}>{String(c.id || '').slice(0, 8)}</span>
                  {script.head_commit_id && c.id === script.head_commit_id && (
                    <CSBadge color="green">{t('scripts.version.badge_current')}</CSBadge>
                  )}
                </CSSpaceBetween>
              ),
            },
            {
              id: 'message', header: t('scripts.version.col_message'),
              cell: (c) => <CSBox fontSize="body-s">{c.message || '—'}</CSBox>,
            },
            {
              id: 'kind', header: t('scripts.version.col_kind'), width: 90,
              cell: (c) => <CSBox fontSize="body-s" color="text-body-secondary">{c.kind || '—'}</CSBox>,
            },
            {
              id: 'date', header: t('scripts.version.col_date'), width: 130,
              cell: (c) => <CSBox fontSize="body-s" color="text-body-secondary">{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</CSBox>,
            },
            {
              id: 'action', header: '', width: 120,
              cell: (c) => (
                <CSButton
                  variant="inline-link"
                  disabled
                  title={t('scripts.version.checkout_unavailable')}
                  onClick={() => onRollback(c)}
                >{t('scripts.version.rollback_btn')}</CSButton>
              ),
            },
          ]}
          empty={<CSBox textAlign="center" padding={{ vertical: 'l' }} color="inherit">{t('scripts.version.empty')}</CSBox>}
        />
        {hasMore && (
          <div style={{ paddingTop: 12, textAlign: 'center' }}>
            <CSButton loading={loading} onClick={() => loadCommits(cursor)}>{t('common.load_more', { defaultValue: '加载更多' })}</CSButton>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

/* ─── 共享模式选择器 ─────────────────────────────────────────────
   CSSegmentedControl: private / public / pinned-snapshot / floating-latest
   pinned 时显示 commit 下拉选择器。
   POST /api/scripts/{id}/pin 设置 */
function SharingModeSelector({ script, currentUserId, onChanged }) {
  const { t } = useTranslation();
  const [mode, setMode] = useStatePL(script?.sharing_mode || 'private');
  const [commits, setCommits] = useStatePL([]);
  const [pinCommitId, setPinCommitId] = useStatePL(script?.current_pin_commit_id || null);
  const [saving, setSaving] = useStatePL(false);

  const isOwner = script && currentUserId && script.owner_id === currentUserId;

  useEffectPL(() => {
    setMode(script?.sharing_mode || 'private');
    setPinCommitId(script?.current_pin_commit_id || null);
  }, [script?.id, script?.sharing_mode, script?.current_pin_commit_id]);

  useEffectPL(() => {
    if (!script || !isOwner) return;
    (async () => {
      try {
        const r = await window.api.scripts.commits(script.id, { limit: 30 });
        const list = Array.isArray(r) ? r : (r?.items || r?.commits || []);
        setCommits(list);
      } catch (_) {}
    })();
  }, [script?.id, isOwner]);

  if (!script || !isOwner) return null;

  const onSave = async (newMode, newPinCommitId) => {
    setSaving(true);
    try {
      if (newMode === 'private') {
        await window.api.scripts.unpin(script.id);
      } else {
        await window.api.scripts.pin(script.id, {
          mode: newMode,
          target_script_id: script.id,
          commit_id: newMode === 'pinned-snapshot' ? (newPinCommitId || undefined) : undefined,
        });
      }
      window.__apiToast?.(t('scripts.share.pin_ok'), { kind: 'ok', duration: 2000 });
      onChanged && onChanged();
    } catch (e) {
      window.__apiToast?.(t('scripts.share.pin_fail'), { kind: 'danger', detail: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = ({ detail }) => {
    const m = detail.selectedId;
    setMode(m);
    if (m !== 'pinned-snapshot') onSave(m, null);
  };

  const commitOptions = commits.map(c => ({
    value: c.id,
    label: `${String(c.id || '').slice(0, 8)} · ${c.message || c.kind || ''}`,
  }));
  const selectedCommitOpt = commitOptions.find(o => o.value === pinCommitId) || (pinCommitId ? { value: pinCommitId, label: String(pinCommitId).slice(0, 8) } : null);

  return (
    <CSSpaceBetween size="xs">
      <CSFormField label={t('scripts.share.mode_label')}>
        <CSSegmentedControl
          selectedId={mode}
          options={[
            { id: 'private',          text: t('scripts.share.mode_private') },
            { id: 'public',           text: t('scripts.share.mode_public') },
            { id: 'pinned-snapshot',  text: t('scripts.share.mode_pinned') },
            { id: 'floating-latest',  text: t('scripts.share.mode_floating') },
          ]}
          onChange={handleModeChange}
          disabled={saving}
        />
      </CSFormField>
      {mode === 'pinned-snapshot' && (
        <CSSpaceBetween direction="horizontal" size="xs" alignItems="flex-end">
          <CSFormField
            label={t('scripts.share.pin_commit_label')}
            description={t('scripts.share.pin_commit_hint', { defaultValue: '选定版本作记录;当前 GM 检索按【目标剧本的最新内容】读取(精确版本回放为后续功能)。floating-latest 则始终跟随目标最新。' })}
            stretch
          >
            <CSSelect
              selectedOption={selectedCommitOpt}
              options={commitOptions}
              placeholder={t('scripts.share.pin_commit_placeholder')}
              onChange={({ detail }) => setPinCommitId(detail.selectedOption.value)}
              disabled={saving}
            />
          </CSFormField>
          <CSButton loading={saving} disabled={!pinCommitId || saving} onClick={() => onSave('pinned-snapshot', pinCommitId)}>
            {t('common.save', { defaultValue: '保存' })}
          </CSButton>
        </CSSpaceBetween>
      )}
    </CSSpaceBetween>
  );
}

/* 剧本详情面板 —— 选中某剧本后在列表下方展开(对齐存档页结构)。
   Tabs:概览 / 参数(剧本覆盖设定) / 世界书(worldbook) / 知识库人物 / NPC 角色卡 / 时间线锚点。
   世界书 / NPC 角色卡 / 时间线锚点按需懒加载。 */
// 剧本封面:宽高比自适应海报(模糊填充 + contain),竖/方/横封面都完整显示;悬停更换 + 点击放大。
function CoverFrame({ src, title, isOwner, onEdit }) {
  const { t } = useTranslation();
  const [aspect, setAspect] = React.useState(null);
  const [light, setLight] = React.useState(false);
  React.useEffect(() => { setAspect(null); }, [src]);
  React.useEffect(() => {
    if (!light) return;
    const h = (e) => { if (e.key === 'Escape') setLight(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [light]);
  const onLoad = (e) => {
    const w = e.target && e.target.naturalWidth, h = e.target && e.target.naturalHeight;
    if (w && h) { const r = Math.max(0.62, Math.min(1.78, w / h)); setAspect(`${r.toFixed(4)} / 1`); }
  };
  return (
    <div className="mh-hero" style={{ ...(aspect ? { aspectRatio: aspect } : { aspectRatio: '16 / 9' }), cursor: 'zoom-in' }} onClick={() => setLight(true)}>
      <img src={src} className="mh-hero__fill" alt="" aria-hidden="true" loading="lazy" />
      <img src={src} className="mh-hero__img" alt={title} loading="lazy" onLoad={onLoad} />
      <div className="mh-hero__scrim" />
      <div className="mh-hero__meta"><div className="mh-hero__name" style={{ fontSize: 20 }}>{title}</div></div>
      {isOwner && (
        <div className="mh-hero__actions">
          <span className="mh-chip" onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }}>{t('scripts.page.change_cover')}</span>
        </div>
      )}
      {light && (
        <div className="mlb-backdrop" onClick={() => setLight(false)} role="dialog" aria-modal="true">
          <img src={src} alt={title} style={{ maxWidth: '92vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 10, boxShadow: '0 12px 60px rgba(0,0,0,.7)' }} onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLight(false)} aria-label={t('common.close')} style={{ position: 'absolute', top: 20, right: 24, width: 38, height: 38, borderRadius: 99, border: 0, background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 19, cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  );
}

function ScriptDetailPanel({ script: s, savesCount, scriptSaves = [], embedStatus, currentUserId,
  pendingTab, onPendingTabConsumed,
  onPlay, onContinueSave, onNewGame, onChapters, onReview, onExtractDone, onExport, onToggleVisibility, onDelete, onUnsubscribe, onEditOverrides, onReload }) {
  const { t } = useTranslation();
  const [tab, setTab] = useStatePL('overview');

  // 列表"状态"下拉点击 → 父组件 setPendingTab(id) → 这里听到后切 tab,
  // 立刻 consume 防止下次同样的 id 又触发(虽然父端会清 null,这是双保险)
  React.useEffect(() => {
    if (pendingTab) {
      setTab(pendingTab);
      onPendingTabConsumed && onPendingTabConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTab, s.id]);
  const [wb, setWb] = useStatePL(null);
  const [npc, setNpc] = useStatePL(null);
  const [tl, setTl] = useStatePL(null);
  const [ov, setOv] = useStatePL(null);
  const [loading, setLoading] = useStatePL(false);
  const [npcEdit, setNpcEdit] = useStatePL(null); // { card, isNew } | null — NPC 卡编辑(复用 CardEditModal)
  // Version history drawer
  const [historyOpen, setHistoryOpen] = useStatePL(false);
  // Fork inline confirmation state
  const [forkBusy, setForkBusy] = useStatePL(false);
  const [forkConfirm, setForkConfirm] = useStatePL(false);
  // 封面:统一 MediaStudio
  const [coverStudioOpen, setCoverStudioOpen] = useStatePL(false);
  const [coverUrl, setCoverUrl] = useStatePL(s.cover_image_url || null);

  useEffectPL(() => {
    setWb(null); setNpc(null); setTl(null); setOv(null);
    // 若有 pendingTab 跳转(列表"状态"下拉触发),别用 overview 覆盖它 —
    // pendingTab effect 与本 reset effect 在 s.id 变化时会同帧触发,
    // 后者若无条件 setTab('overview') 会盖掉前者设的目标 tab。
    if (!pendingTab) setTab('overview');
    setHistoryOpen(false); setForkConfirm(false);
    setCoverUrl(s.cover_image_url || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.id]);

  const isOwner = currentUserId && s.owner_id === currentUserId;


  // 手动把某 NPC 卡设为主角(AI canon importance 误判时纠正)。设完重拉列表刷新「主角」徽标。
  const [protagBusy, setProtagBusy] = useStatePL(null); // 正在设置的 card id
  const onSetProtagonist = async (c) => {
    if (!c || !c.id) return;
    setProtagBusy(c.id);
    try {
      await window.api.cards.scriptSetProtagonist(s.id, c.id);
      window.__apiToast?.(t('scripts.toast.protagonist_set', { name: c.name || 'NPC', defaultValue: `已将「${c.name || 'NPC'}」设为主角` }), { kind: 'ok' });
      setNpc(null); // 触发 NPC 列表重新拉取
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.protagonist_fail', { defaultValue: '设为主角失败' }), { kind: 'danger', detail: e?.message });
    } finally {
      setProtagBusy(null);
    }
  };

  // NPC 卡 → 用户角色卡(card_type='pc')。复制一份独立用户卡(含头像),后端 myUpsert
  // (POST /api/me/character-cards),与 agent 工具 clone_npc_to_user_card 等价。订阅者也可转
  // (转到自己名下,不改原剧本)。body shape 与角色卡页共用 npcToUserCardBody,避免漂移。
  const [promoteBusy, setPromoteBusy] = useStatePL(null);
  const onPromoteNpc = async (c) => {
    if (!c) return;
    setPromoteBusy(c.id);
    try {
      const body = npcToUserCardBody(c, {
        fromNpcTag: t('cards.list.tag_from_npc', { defaultValue: '来自NPC' }),
        unnamed: t('scripts.editor.unnamed_npc', { defaultValue: '无名角色' }),
      });
      const r = await window.api.cards.myUpsert(body);
      if (r && r.ok === false) throw new Error(r.error || r.detail || t('scripts.page.promote_fail'));
      window.__apiToast?.(t('scripts.toast.npc_promoted', { name: body.name, defaultValue: `已把「${body.name}」转为你的用户角色卡` }),
        { kind: 'ok', duration: 2600, detail: t('scripts.toast.npc_promoted_detail', { defaultValue: '在「角色卡 · 我的」里可编辑/挂到任意剧本' }) });
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.npc_promote_fail', { defaultValue: '转为用户角色卡失败' }), { kind: 'danger', detail: e?.message || String(e) });
    } finally {
      setPromoteBusy(null);
    }
  };

  // 按需 AI 复核全部 NPC 卡:弹公用模型选择器(默认用户常用模型,可改)→ 用所选模型批量裁决
  // (合并同人卡 / 锁定真主角 / 删非人名卡)。on-demand,不进导入流水线 → 零自动成本。
  const [auditOpen, setAuditOpen] = useStatePL(false);
  const [auditSel, setAuditSel] = useStatePL({ api_id: '', model: '' });
  const [auditBusy, setAuditBusy] = useStatePL(false);
  const runAudit = async () => {
    setAuditBusy(true);
    try {
      const r = await window.api.cards.auditCards(s.id, auditSel.api_id, auditSel.model);
      if (r && r.ok === false) {
        if (r.needs_credentials) {
          window.__apiToast?.(t('scripts.audit.need_key', { defaultValue: '该模型还没配 API Key' }),
            { kind: 'warn', detail: t('scripts.audit.need_key_hint', { defaultValue: '去「设置 → API 与模型」配置后重试,或在上面换一个已配置的模型。' }) });
        } else {
          window.__apiToast?.(t('scripts.audit.fail', { defaultValue: 'AI 复核失败' }), { kind: 'danger', detail: r.error });
        }
        return;
      }
      // 异步:关弹窗,右下角全局后台任务浮窗接管进度;完成后轮询拿摘要 + 刷新 NPC 列表。
      const jobId = r && r.job_id;
      setAuditOpen(false);
      window.__apiToast?.(t('scripts.audit.started', { defaultValue: '已开始 AI 复核,可在右下角后台任务查看进度' }), { kind: 'ok' });
      if (!jobId) { setNpc(null); return; }
      const startedAt = Date.now();
      const poll = async () => {
        try {
          const st = await window.api.scripts.jobStatus(jobId);
          const job = (st && st.job) || {};
          const status = job.status || '';
          if (status === 'done' || status === 'done_with_errors') {
            const sm = ((job.budget_estimate || {}).result || {}).summary || {};
            const parts = [];
            if (sm.protagonist) parts.push(t('scripts.page.audit_protagonist_set', { name: sm.protagonist }));
            if (Array.isArray(sm.merged) && sm.merged.length) parts.push(t('scripts.page.audit_merged', { n: sm.merged.length }));
            if (Array.isArray(sm.dropped) && sm.dropped.length) parts.push(t('scripts.page.audit_dropped', { n: sm.dropped.length }));
            window.__apiToast?.(parts.length ? t('scripts.page.audit_done_detail', { detail: parts.join('、') }) : t('scripts.page.audit_done_no_changes'), { kind: 'ok' });
            setNpc(null);
            return;
          }
          if (status === 'failed' || status === 'cancelled') {
            window.__apiToast?.(t('scripts.audit.fail', { defaultValue: 'AI 复核失败' }), { kind: 'danger', detail: job.error });
            return;
          }
        } catch (_) { /* 轮询失败:继续重试,浮窗仍独立跟踪 */ }
        // 大花名册分批复核可达数分钟;放宽到 6 分钟再兜底(浮窗始终独立显示真状态)。
        if (Date.now() - startedAt < 360000) setTimeout(poll, 2500);
        else setNpc(null); // 超时兜底:刷新一次,浮窗继续显示真状态
      };
      setTimeout(poll, 1600);
    } catch (e) {
      window.__apiToast?.(t('scripts.audit.fail', { defaultValue: 'AI 复核失败' }), { kind: 'danger', detail: e?.message });
    } finally {
      setAuditBusy(false);
    }
  };

  const doFork = async () => {
    setForkBusy(true);
    try {
      const newTitle = t('scripts.page.fork_title_suffix', { title: s.title });
      const r = await window.api.scripts.fork(s.id, { title: newTitle });
      if (!r || r.ok === false) throw new Error(r?.error || t('scripts.share.fork_fail'));
      window.__apiToast?.(t('scripts.toast.fork_ok'), { kind: 'ok' });
      setForkConfirm(false);
      try { window.dispatchEvent(new CustomEvent('rpg-scripts-updated')); } catch (_) {}
      // 跳转到新 script (如果后端返回 script_id/id)
      const newId = r.script_id || r.id || r.script?.id;
      if (newId && onReload) onReload(newId);
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.fork_fail'), { kind: 'danger', detail: e?.message });
    } finally {
      setForkBusy(false);
    }
  };

  useEffectPL(() => {
    let cancelled = false;
    (async () => {
      try {
        if (tab === 'world' && wb == null) {
          setLoading(true);
          const r = await window.api.scripts.worldbook(s.id);
          if (!cancelled) setWb(Array.isArray(r) ? r : (r?.items || r?.entries || []));
        } else if (tab === 'npc' && npc == null) {
          setLoading(true);
          const r = await window.api.cards.scriptList(s.id);
          if (!cancelled) setNpc(Array.isArray(r) ? r : (r?.items || r?.cards || []));
        } else if (tab === 'timeline' && tl == null) {
          setLoading(true);
          const r = await window.api.scripts.timeline(s.id);
          if (!cancelled) setTl(r?.phases || []);
        } else if (tab === 'params' && ov == null) {
          setLoading(true);
          const r = await window.api.scripts.getOverrides(s.id);
          if (!cancelled) setOv(r?.data ?? r ?? {});
        }
      } catch (_) {
        if (!cancelled) { if (tab === 'world') setWb([]); else if (tab === 'npc') setNpc([]); else if (tab === 'timeline') setTl([]); else if (tab === 'params') setOv({}); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // 必须把 wb/npc/tl/ov 纳入依赖:保存/重建后用 setNpc(null) 触发重拉的模式靠的就是
    // 这些值变 null 重跑本 effect(== null 守卫天然防循环)。此前漏了它们 → 保存后置 null
    // 却不重拉 → 列表渲染 npc||[]=空,刷新切 tab 才恢复(用户反馈"保存后变空,刷新恢复"真因)。
  }, [tab, s.id, wb, npc, tl, ov]);

  const es = embedStatus[s.id];
  const embedLabel = (() => {
    if (!es) return t('scripts.my.embed_none');
    const done = es.chunks.done + es.cards.done + es.worldbook.done;
    const all = es.chunks.total + es.cards.total + es.worldbook.total;
    if (es.running) return t('scripts.my.embed_running', { pct: all ? Math.round(done / all * 100) : 0 });
    return all > 0 && done >= all ? t('scripts.my.embed_done', { n: all }) : t('scripts.my.embed_none');
  })();
  // 章节向量未建警告:chunks.done=0 但 cards/worldbook>0 时,RAG 检索退化到 keyword,玩起来会塌房
  const embedWarning = (() => {
    if (!es) return null;
    if ((es.chunks?.done || 0) === 0 && ((es.cards?.done || 0) > 0 || (es.worldbook?.done || 0) > 0)) {
      return t('scripts.editor.embed_warn_chunks_missing', { defaultValue: '章节向量未建,RAG 退化到关键字' });
    }
    return null;
  })();

  // phase_rebuild_panel: 7 模块状态 + 估算/重做 SSE 协调器.
  // hook 自己拉 /modules-status,在 active rebuild job 时禁用其他卡按钮 + 顶部 banner 实时进度.
  const rb = useScriptRebuild(s.id);
  const playBlock = scriptPlayBlockReason(s, t);

  // 默认提示词:用剧本简介(描述故事内容,适合作画面参考),而非标题(标题不是画面描述词)。
  // 无简介则留空,由 MediaStudio 的占位示例引导用户自己写。
  const genCoverDefaultPrompt = (s.description || '').trim().slice(0, 300);

  return (
    <>
    {coverStudioOpen && (
      <MediaStudio
        open={coverStudioOpen}
        onClose={() => setCoverStudioOpen(false)}
        target={{ type: 'script_cover', id: s.id }}
        name={s.title}
        defaultPrompt={genCoverDefaultPrompt}
        onApplied={(url) => {
          setCoverUrl(url);
          setCoverStudioOpen(false);
        }}
      />
    )}
    {historyOpen && (
      <VersionHistoryDrawer
        script={s}
        currentUserId={currentUserId}
        onClose={() => setHistoryOpen(false)}
      />
    )}
    <CSContainer header={
      <CSHeader variant="h2"
        actions={
          <CSSpaceBetween direction="horizontal" size="xs">
            {isOwner && (
              <CSButton iconName="gen-ai" onClick={() => setCoverStudioOpen(true)}>{t('scripts.page.change_cover')}</CSButton>
            )}
            {/* 反馈#3:开始游戏改下拉——可选继续某个存档 / 开新游戏,不再有存档就直接进后台 */}
            <CSButtonDropdown variant="primary" expandToViewport disabled={!!playBlock}
              items={[
                ...(scriptSaves.length ? [{
                  text: t('scripts.my.play_continue_group'),
                  items: scriptSaves.map((sv) => ({
                    id: 'continue:' + sv.id,
                    text: sv.title || ('#' + sv.id),
                    iconName: 'caret-right-filled',
                  })),
                }] : []),
                { id: 'new', text: t('scripts.my.play_new_game'), iconName: 'add-plus' },
              ]}
              onItemClick={({ detail }) => {
                if (detail.id === 'new') { onNewGame && onNewGame(s); return; }
                if (typeof detail.id === 'string' && detail.id.startsWith('continue:')) {
                  const sv = scriptSaves.find((x) => String(x.id) === detail.id.slice('continue:'.length));
                  if (sv) onContinueSave && onContinueSave(sv);
                }
              }}
            >{t('scripts.my.play_game')}</CSButtonDropdown>
            <CSButton iconName="file" onClick={() => onChapters(s)}>{t('scripts.my.view_chapters')}</CSButton>
            <CSButton iconName="status-info" onClick={() => onReview(s)}>{t('scripts.my.kb_review')}</CSButton>
            <CSButton iconName="settings" onClick={() => setHistoryOpen(v => !v)}>{t('scripts.version.history_btn')}</CSButton>
            <CSButtonDropdown expandToViewport
              items={[
                { id: 'export', text: t('scripts.my.action_export'), iconName: 'download' },
                { id: 'visibility', text: s.is_public ? t('scripts.my.action_unpublish') : t('scripts.my.action_publish'), iconName: s.is_public ? 'lock-private' : 'share' },
                s.is_subscribed
                  ? { id: 'unsubscribe', text: t('scripts.my.action_unsubscribe'), iconName: 'remove' }
                  : { id: 'delete', text: t('scripts.my.action_delete'), iconName: 'remove' },
              ]}
              onItemClick={({ detail }) => {
                const id = detail.id;
                if (id === 'export') onExport(s);
                else if (id === 'visibility') onToggleVisibility(s);
                else if (id === 'delete') onDelete(s);
                else if (id === 'unsubscribe') onUnsubscribe && onUnsubscribe(s);
              }}>{t('scripts.my.more')}</CSButtonDropdown>
          </CSSpaceBetween>
        }
      >{s.title}</CSHeader>
    }>
      {/* Fork alert — non-owner script */}
      {!isOwner && s.owner_id && (
        <CSSpaceBetween size="s">
          <CSAlert
            type="info"
            header={t('scripts.share.fork_alert_header')}
            action={
              forkConfirm ? (
                <CSSpaceBetween direction="horizontal" size="xs">
                  <CSButton variant="primary" loading={forkBusy} onClick={doFork}>{t('scripts.share.fork_btn')}</CSButton>
                  <CSButton disabled={forkBusy} onClick={() => setForkConfirm(false)}>{t('common.cancel', { defaultValue: '取消' })}</CSButton>
                </CSSpaceBetween>
              ) : (
                <CSButton iconName="copy" onClick={() => setForkConfirm(true)}>{t('scripts.share.fork_btn')}</CSButton>
              )
            }
          >
            {forkConfirm
              ? t('scripts.share.fork_confirm_body', { title: s.title })
              : t('scripts.share.fork_alert_body')}
          </CSAlert>
        </CSSpaceBetween>
      )}
      {/* Sharing mode selector — owner only */}
      {isOwner && (
        <SharingModeSelector script={s} currentUserId={currentUserId} onChanged={onReload} />
      )}
      {/* phase_rebuild_panel: 活跃重做任务通知条,所有 tab 共享 */}
      <RebuildJobBanner {...rb.bannerProps} />
      {playBlock && (
        <CSAlert type="warning" header={t('scripts.my.play_block_title')}>
          {playBlock}
        </CSAlert>
      )}
      {/* phase_rebuild_panel: 估算确认弹窗,所有卡片重做按钮共享 */}
      <RebuildEstimateModal {...rb.modalProps} />
      {/* tab 栏滚下去就消失了用户找不到当前 tab — Cloudscape Tabs 不暴露
          单独的 tablist 组件,只能 scope CSS 给本组件根节点下的 [role=tablist] 加
          position: sticky。不会影响别处 CSTabs(scope 在 data-detail-tabs 节点)。 */}
      <style>{`
        [data-detail-tabs] > [class*="tabs-header"],
        [data-detail-tabs] [role="tablist"] {
          position: sticky !important;
          top: 0 !important;
          z-index: 30 !important;
          background: var(--color-background-layout-main, #1c1b1a) !important;
        }
      `}</style>
      <div data-detail-tabs>
      <CSTabs activeTabId={tab} onChange={({ detail }) => setTab(detail.activeTabId)} tabs={[
        { id: 'overview', label: t('scripts.editor.tab_overview'), content: (
          <div className="msplit">
            <div className="msplit__media">
              {/* 剧本封面:图片优先 + 宽高比自适应(竖/方/横都完整显示) */}
              {coverUrl ? (
                <CoverFrame src={coverUrl} title={s.title} isOwner={isOwner} onEdit={() => setCoverStudioOpen(true)} />
              ) : (
                <div className="mh-hero mh-hero--empty" style={{ aspectRatio: '16 / 9', cursor: isOwner ? 'pointer' : 'default' }}
                  onClick={isOwner ? () => setCoverStudioOpen(true) : undefined}>
                  <div className="mh-empty__inner">
                    <div className="mh-empty__icon">🎬</div>
                    <div className="mh-empty__title">{s.title}</div>
                    <div className="mh-empty__hint">{isOwner ? t('scripts.page.cover_empty_hint_owner') : t('scripts.page.cover_empty_hint')}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="msplit__body">
            <CSSpaceBetween size="l">
            <CSKeyValuePairs columns={4} items={[
              { label: t('scripts.my.chapters'), value: (s.chapter_count || 0).toLocaleString() },
              { label: t('scripts.my.words'), value: `${((s.word_count || 0) / 10000).toFixed(1)} ${t('scripts.my.wan')}` },
              { label: t('scripts.editor.split_mode'), value: s.import_report?.mode_label || '—' },
              { label: t('scripts.editor.split_confidence'), value: s.import_report?.confidence != null ? `${Math.round(s.import_report.confidence * 100)}%` : '—' },
              { label: t('scripts.editor.saves_count'), value: t('scripts.editor.saves_n', { n: savesCount }) },
              { label: t('scripts.editor.embed_index'), value: (
                <CSSpaceBetween direction="horizontal" size="xxs">
                  <span>{embedLabel}</span>
                  {embedWarning && <CSStatusIndicator type="warning">{embedWarning}</CSStatusIndicator>}
                </CSSpaceBetween>
              ) },
              { label: t('scripts.my.share'), value: s.is_public ? <CSStatusIndicator type="success">{t('scripts.my.is_public')}</CSStatusIndicator> : <CSStatusIndicator type="stopped">{t('scripts.editor.not_public')}</CSStatusIndicator> },
              { label: t('scripts.editor.script_id'), value: <span className="mono">{s.uid}</span> },
            ]} />
            {/* phase_rebuild_panel: 7 模块状态矩阵 — 取代旧 embed 单卡 */}
            <ModuleMatrixOverview {...rb.matrixProps} />
            {/* 收敛处置③:embed 4 子卡改只读进度展示——重嵌操作统一收口到「知识库中心」
                (ModuleRebuildPanel → embeddings 模块卡),这里不再传 onRebuild,
                ModuleStatusCard 无 onRebuild 时天然不渲染"重做"按钮。 */}
            <CSSpaceBetween size="s">
              <CSHeader variant="h3" description={t('scripts.editor.embed_breakdown_desc', { defaultValue: '向量索引按内容类型拆分的只读进度;重嵌请去「知识库中心」。' })}>
                {t('scripts.editor.embed_breakdown_title', { defaultValue: '向量索引' })}
              </CSHeader>
              <CSColumnLayout columns={2} variant="text-grid" minColumnWidth={300}>
                {['chunks', 'cards', 'worldbook', 'canon'].map((kind) => {
                  const s2 = es ? es[kind] : null;
                  const done = s2?.done || 0;
                  const total = s2?.total || 0;
                  const status = !s2 || total === 0
                    ? 'unknown'
                    : (done >= total ? 'ready' : (done > 0 ? 'partial' : 'missing'));
                  return (
                    <ModuleStatusCard
                      key={kind}
                      module="embeddings"
                      scriptId={s.id}
                      status={es?.running ? 'running' : status}
                      doneCount={done}
                      totalCount={total}
                      activeJobId={rb.activeJob ? (rb.activeJob.job_id || rb.activeJob.id) : null}
                      title={t(`scripts.editor.embed_kind_${kind}`, { defaultValue: kind })}
                      description={t('scripts.editor.embed_kind_desc', { defaultValue: 'pgvector embedding_vec 列' })}
                    />
                  );
                })}
              </CSColumnLayout>
            </CSSpaceBetween>
            </CSSpaceBetween>
            </div>
          </div>
        ) },
        { id: 'params', label: t('scripts.editor.tab_params'), content: (
          <CSSpaceBetween size="s">
            <CSBox color="text-body-secondary" fontSize="body-s">{t('scripts.editor.overrides_desc')}</CSBox>
            <pre style={{ margin: 0, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--line-soft)', borderRadius: 8, fontSize: 12.5, lineHeight: 1.55, maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {ov ? JSON.stringify(ov, null, 2) : (loading ? t('common.loading') : '{}')}
            </pre>
            <CSButton iconName="edit" onClick={() => onEditOverrides(s)}>{t('scripts.editor.edit_overrides')}</CSButton>
          </CSSpaceBetween>
        ) },
        { id: 'world', label: t('scripts.editor.tab_world'), content: (
          /* 收敛处置⑤:重做卡从内容 tab 删除——本 tab 只留编辑器本体,
             重建/富化操作统一去「知识库中心」。 */
          <WorldbookEditorView script={s} />
        ) },
        { id: 'npc', label: t('scripts.editor.tab_npc'), content: (
          <CSSpaceBetween size="l">
            {/* 收敛处置⑤/⑥:重做卡 + "AI 复核人名/语义" 均迁出本 tab——
                前者去「知识库中心」的 cards 模块卡,后者迁到「知识库中心」角色卡分组
                (ModuleRebuildPanel 内 cards 卡旁的次按钮)。本 tab 只留 NPC 列表本体。 */}
            <CSCards loading={loading && npc == null} loadingText={t('scripts.editor.loading_npc')}
            items={npc || []} trackBy="id"
            cardsPerRow={[{ cards: 1 }, { minWidth: 480, cards: 2 }]}
            header={
              <CSHeader counter={`(${(npc || []).length})`}
                actions={
                  <CSSpaceBetween direction="horizontal" size="xs">
                    <CSButton iconName="add-plus" onClick={() => setNpcEdit({ card: null, isNew: true })}>{t('scripts.editor.add_npc')}</CSButton>
                  </CSSpaceBetween>
                }>
                {t('scripts.editor.tab_npc')}
              </CSHeader>
            }
            cardDefinition={{
              header: (c) => (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AvatarImg src={c.avatar_path || null} name={c.name || '?'} size={48} shape="rounded" zoomable />
                    <CSBox variant="h3" padding="n">
                      {c.name || t('scripts.editor.unnamed_npc')}
                      {c.full_name && c.full_name !== c.name && (
                        <CSBox display="inline" color="text-status-inactive" fontSize="body-s" padding={{ left: 'xs' }}>{c.full_name}</CSBox>
                      )}
                      {/* 主角 badge — 后端 _stage_cards canon importance 第 1 名标记 */}
                      {c.metadata && c.metadata.is_protagonist && (
                        <CSBox display="inline" padding={{ left: 'xs' }}>
                          <CSBadge color="severity-high">{t('scripts.page.badge_protagonist')}</CSBadge>
                        </CSBox>
                      )}
                    </CSBox>
                  </div>
                  {c.enabled === false && <CSStatusIndicator type="stopped">{t('common.disabled')}</CSStatusIndicator>}
                </div>
              ),
              sections: [
                { id: 'identity', content: (c) => (
                  <CSBox color="text-label" fontSize="body-s" fontWeight="bold">{c.identity || c.role || 'NPC'}</CSBox>
                ) },
                { id: 'meta', content: (c) => (
                  ((c.first_revealed_chapter > 1) || (c.importance != null) || (Array.isArray(c.aliases) && c.aliases.length)) ? (
                    <CSSpaceBetween direction="horizontal" size="xxs">
                      {c.first_revealed_chapter > 1 && <CSBadge color="blue">{t('scripts.editor.npc_chapter', { n: c.first_revealed_chapter })}</CSBadge>}
                      {c.importance != null && <CSBadge color="grey">{t('scripts.editor.npc_importance', { n: c.importance })}</CSBadge>}
                      {Array.isArray(c.aliases) && c.aliases.slice(0, 3).map((a) => <CSBadge key={a}>{a}</CSBadge>)}
                    </CSSpaceBetween>
                  ) : null
                ) },
                { id: 'bio', content: (c) => (
                  <CSBox color="text-body-secondary" fontSize="body-s">{cardSnippet(c, 200) || '—'}</CSBox>
                ) },
                { id: 'act', content: (c) => (
                  <CSSpaceBetween direction="horizontal" size="xs">
                    <CSButton variant="inline-link" iconName="edit" onClick={() => setNpcEdit({ card: c, isNew: false })}>{t('scripts.editor.view_edit')}</CSButton>
                    {isOwner && !(c.metadata && c.metadata.is_protagonist) && (
                      <CSButton variant="inline-link" iconName="user-profile"
                        loading={protagBusy === c.id}
                        onClick={() => onSetProtagonist(c)}>
                        {t('scripts.editor.set_protagonist', { defaultValue: '设为主角' })}
                      </CSButton>
                    )}
                    {/* NPC → 用户角色卡:任何查看者(含订阅者)都可复制到自己名下,不改原剧本 */}
                    <CSButton variant="inline-link" iconName="add-plus"
                      loading={promoteBusy === c.id}
                      onClick={() => onPromoteNpc(c)}>
                      {t('scripts.editor.promote_npc', { defaultValue: '转为用户角色卡' })}
                    </CSButton>
                  </CSSpaceBetween>
                ) },
              ],
            }}
            empty={<CSBox textAlign="center" color="inherit" padding={{ vertical: 'l' }}>{t('scripts.editor.npc_empty')}</CSBox>} />
          </CSSpaceBetween>
        ) },
        { id: 'canon-editor', label: t('scripts.editor.tab_canon', { defaultValue: '知识库人物' }), content: (
          /* 收敛处置⑤⑦:重做卡删除(去知识库中心);孤儿组件 CanonEntityEditorView 接线——
             它自带 GET/PUT/POST/DELETE /api/scripts/{id}/canon-entities 全套 CRUD(后端已存在,
             非孤儿端点),按 ownerId/currentUserId 走只读闸。 */
          <CanonEntityEditorView scriptId={s.id} ownerId={s.owner_id} currentUserId={currentUserId} />
        ) },
        { id: 'timeline', label: t('scripts.editor.tab_timeline'), content: (
          <CSSpaceBetween size="l">
            {/* 收敛处置⑦:孤儿组件 AnchorEditorView 通读后发现它期望 GET /api/scripts/{id}/anchors
                (列表,带 phase/chapter 过滤)做初始加载,但后端 script_edit.py 只注册了
                PUT/POST/DELETE /api/scripts/{id}/anchors(单条),没有对应的列表 GET 路由——
                接上会导致组件首次加载即 404 卡死。按任务指示降级:时间线 tab 保持现有只读列表
                (数据源 window.api.scripts.timeline,与 AnchorEditorView 期望的端点不同),
                不接 AnchorEditorView。重做卡按处置⑤删除,去知识库中心统一操作。 */}
            {(loading && tl == null)
              ? <CSBox color="text-body-secondary">{t('common.loading')}</CSBox>
              : (!tl || tl.length === 0)
                ? <CSBox textAlign="center" color="inherit" padding={{ vertical: 'l' }}>{t('scripts.editor.timeline_empty')}</CSBox>
                : <CSSpaceBetween size="l">
                    {tl.map((p, i) => (
                      <div key={i}>
                        <CSBox variant="h4" padding="n">{p.phase_label} <CSBox display="inline" color="text-status-inactive" fontSize="body-s">{t('scripts.editor.chapter_range', { min: p.chapter_min, max: p.chapter_max })}</CSBox></CSBox>
                        {p.summary && <CSBox color="text-body-secondary" fontSize="body-s">{p.summary}</CSBox>}
                        <CSSpaceBetween size="xxs">
                          {(p.anchors || []).map((a) => {
                            const label = (a.story_time_label || '').trim();
                            const summary = String(a.sample_summary || '').replace(/\s+/g, ' ').trim();
                            return (
                              <div
                                key={a.anchor_id}
                                style={{
                                  borderTop: '1px solid var(--line-soft)',
                                  paddingTop: 8,
                                  overflowWrap: 'anywhere',
                                }}
                              >
                                <CSBox fontSize="body-s">
                                  <span className="mono" style={{ color: 'var(--accent)', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{label || t('scripts.editor.chapter_range', { min: a.chapter_min, max: a.chapter_max })}</span>
                                </CSBox>
                                {summary && (
                                  <CSBox color="text-body-secondary" fontSize="body-s">
                                    <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{summary}</span>
                                  </CSBox>
                                )}
                              </div>
                            );
                          })}
                        </CSSpaceBetween>
                      </div>
                    ))}
                  </CSSpaceBetween>}
          </CSSpaceBetween>
        ) },
        { id: 'modules', label: t('scripts.kb_center', { defaultValue: '知识库中心' }), content: (
          /* 收敛处置④⑥:「模块」tab 升级为「知识库中心」——所有重建/提取操作的唯一聚合地。
             矩阵(ModuleRebuildPanel,含 facts_refine/worldbook_enrich/world_key 三张新卡)
             + 角色卡分组的 AI 复核次按钮(原 NPC tab 迁来) + 底部「全量重新提取」区块
             (原独立 extract tab 并入,KbExtractPanel 仅剩 full scope)。 */
          <CSSpaceBetween size="l">
            <ModuleRebuildPanel scriptId={s.id} />
            {isOwner && (npc || []).length >= 2 && (
              <CSContainer header={
                <CSHeader variant="h3" description={t('scripts.audit.desc_short', { defaultValue: '合并同人多卡、锁定真主角、删非人名卡——按需触发,不进导入流水线。' })}>
                  {t('scripts.audit.section_title', { defaultValue: 'NPC 角色卡 · AI 复核' })}
                </CSHeader>
              }>
                <CSButton iconName="search" onClick={() => setAuditOpen(true)}>
                  {t('scripts.audit.btn', { defaultValue: 'AI 复核人名/语义' })}
                </CSButton>
              </CSContainer>
            )}
            <CSContainer header={
              <CSHeader variant="h3" description={t('scripts.editor.extract_full_desc', { defaultValue: '重新跑一遍全量 LLM 抽取(章节摘要/知识库人物/世界书/锚点全刷新)。单模块重做请用上面的矩阵卡片。' })}>
                {t('scripts.editor.extract_full_title', { defaultValue: '全量重新提取' })}
              </CSHeader>
            }>
              <KbExtractPanel script={s} onDone={onExtractDone} />
            </CSContainer>
          </CSSpaceBetween>
        ) },
        { id: 'gm-style', label: t('scripts.page.tab_gm_style'), content: (
          /* GM 倾向性 6 滑块(剧本级):篇幅/镜头/戏剧密度/心理/悬念/引导,仅 owner 可写 */
          <GmStyleEditor scope="script" scriptId={s.id} canWrite={!!isOwner} />
        ) },
      ]} />
      </div>
      {auditOpen && (
        <CSModal
          visible
          onDismiss={() => { if (!auditBusy) setAuditOpen(false); }}
          header={t('scripts.audit.title', { defaultValue: 'AI 复核 NPC 角色卡' })}
          footer={
            <CSBox float="right">
              <CSSpaceBetween direction="horizontal" size="xs">
                <CSButton onClick={() => setAuditOpen(false)} disabled={auditBusy}>{t('common.cancel', { defaultValue: '取消' })}</CSButton>
                <CSButton variant="primary" loading={auditBusy} onClick={runAudit}>
                  {t('scripts.audit.run', { defaultValue: '开始复核' })}
                </CSButton>
              </CSSpaceBetween>
            </CSBox>
          }
        >
          <CSSpaceBetween size="m">
            <CSBox color="text-body-secondary" fontSize="body-s">
              {t('scripts.audit.desc', { defaultValue: '用所选模型对本剧本全部 NPC 卡做一次复核:合并同一人的多张卡(如 金玉/玉儿/小玉)、识别并锁定真主角、删除官职/地名等非人名卡。按需触发,不影响导入流程与成本。' })}
            </CSBox>
            <AgentModelPicker
              prefPrefix="card_audit"
              fallbackPrefix="gm"
              variant="bare"
              header={undefined}
              description={t('scripts.audit.model_desc', { defaultValue: '选择本次复核用的模型(默认你设置的默认模型,可改;复核质量越好的模型越准)。' })}
              configHash="settings-models"
              onChange={(api_id, model) => setAuditSel({ api_id, model })}
            />
          </CSSpaceBetween>
        </CSModal>
      )}
      {npcEdit && (
        <CardEditModal
          card={npcEdit.card}
          isNew={npcEdit.isNew}
          kind="npc"
          onClose={() => setNpcEdit(null)}
          onPromote={async (c) => { await onPromoteNpc(c || npcEdit.card); }}
          onSave={async (payload) => {
            try {
              await window.api.cards.scriptUpsert(s.id, payload);
              window.__apiToast?.(npcEdit.isNew ? t('scripts.toast.npc_added') : t('scripts.toast.npc_saved'), { kind: 'ok' });
              setNpcEdit(null);
              setNpc(null); // 触发 NPC 列表重新拉取
            } catch (e) {
              window.__apiToast?.(t('scripts.toast.save_fail'), { kind: 'danger', detail: e?.message });
            }
          }}
        />
      )}
    </CSContainer>
    </>
  );
}

/* ── LLM 知识提取(异步 job + import-jobs SSE) ─────────────────
   后端 POST /scripts/{id}/llm-extract 立即返 job_id,kind='llm_extract',
   复用 streamImport SSE。4 阶段:seed / arc_extract(或 per_chapter)/ resolve / embed。
   完成后剧本 review_status 自动重置为 unreviewed(需复核)。 */
const _EXTRACT_STAGE_LABEL_KEYS = {
  seed: 'scripts.review.stage_seed',
  arc_extract: 'scripts.review.stage_arc_extract',
  per_chapter: 'scripts.review.stage_per_chapter',
  resolve: 'scripts.review.stage_resolve',
  embed: 'scripts.review.stage_embed',
};
function _stageIndicator(status) {
  if (status === 'done') return 'success';
  if (status === 'running') return 'in-progress';
  if (status === 'error' || status === 'failed') return 'error';
  return 'pending';
}

function KbExtractPanel({ script, onDone }) {
  const { t } = useTranslation();
  const sid = script.id;
  // 收敛处置⑥:scope 收窄到唯一值 'full'——worldbook_only/anchors_only/embed_only
  // 与知识库中心的单模块重做(rebuild/{module})完全重复,已删除。本面板只承担
  // "一键全量重新提取"(重跑整套 LLM 抽取流水线)。
  const scope = 'full';
  const [algorithm, setAlgorithm] = useStatePL('arc');
  // Provider/Model 统一由 AgentModelPicker(prefPrefix=extractor)管理:它解析用户
  // 已配凭据 + 偏好后通过 onChange 回传 {api_id, model_real_name},这里只持有回传值
  // 用于拼请求体。与本文件「提取模型」(L3047)同一套实现,不再自造平行选择器。
  const [model, setModel] = useStatePL('');
  const [apiId, setApiId] = useStatePL('');
  const [targetArcs, setTargetArcs] = useStatePL('100');
  const [concurrency, setConcurrency] = useStatePL('15');
  const [authorEra, setAuthorEra] = useStatePL('');
  const [maxUsd, setMaxUsd] = useStatePL('10');
  // 章节范围(可空 → 全书);用户想"只重做第 1-50 章"时用
  const [chapterMin, setChapterMin] = useStatePL('');
  const [chapterMax, setChapterMax] = useStatePL('');
  const [estimate, setEstimate] = useStatePL(null);
  // 强制估算 — 这个 hash 记估算时的参数,跟当前参数不一致 → 开始按钮锁死
  const [estimatedHash, setEstimatedHash] = useStatePL('');
  const [estimating, setEstimating] = useStatePL(false);
  const [job, setJob] = useStatePL(null);
  const [phase, setPhase] = useStatePL('config'); // config | running | done | error
  const [err, setErr] = useStatePL('');
  const esRef = React.useRef(null);

  React.useEffect(() => () => { try { esRef.current && esRef.current.close && esRef.current.close(); } catch (_) {} }, []);

  // 切走标签页又切回来时,extract 流被本组件 unmount 切断 — 这里复活:
  // 拉本剧本最近一条 import_job;若 pending/running,直接重新订 SSE,
  // 让用户能继续看进度而不是空表 + 不知道 token 在不在烧。
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await window.api.scripts.activeJob(sid);
        if (cancelled || !r || !r.ok || !r.active) return;
        const jb = r.job || {};
        const jid = jb.job_id || jb.id;
        if (!jid) return;
        // 立即把已有快照塞进去,SSE 还在建连接时也能先看到进度
        setJob({ ...jb, job_id: jid });
        startStream(jid);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  const cfgBody = () => {
    const body = {
      scope,
      algorithm,
      // model/api_id 来自 AgentModelPicker(extractor 偏好)解析的用户已配凭据;
      // 不再硬编码 deepseek 兜底(那会让没配 deepseek key 的用户提交到无凭据 provider)。
      model: (model || '').trim(),
      api_id: (apiId || '').trim(),
      target_arcs: Number(targetArcs) || 40,
      concurrency: Number(concurrency) || 15,
      author_era: (authorEra || '').trim(),
      max_book_usd: Number(maxUsd) || 10,
    };
    const cMin = Number(chapterMin);
    const cMax = Number(chapterMax);
    if (chapterMin && Number.isFinite(cMin)) body.chapter_min = cMin;
    if (chapterMax && Number.isFinite(cMax)) body.chapter_max = cMax;
    return body;
  };

  // 估算参数指纹 — 用来锁定"必须估算才能开始"
  const _paramsHash = () => JSON.stringify(cfgBody());

  const doEstimate = async () => {
    setEstimating(true); setEstimate(null); setErr('');
    try {
      const r = await window.api.scripts.llmExtractEstimate(sid, cfgBody());
      setEstimate(r);
      setEstimatedHash(_paramsHash());
    } catch (e) {
      setErr((e && (e.payload?.error || e.message)) || t('scripts.review.estimate_fail'));
      setEstimatedHash('');
    } finally { setEstimating(false); }
  };

  // 当前参数 vs 估算时参数:不一致(用户改了参数)= stale,需要重新估算
  const _estimateStale = !estimatedHash || estimatedHash !== _paramsHash();
  // scope 恒为 'full',永远走 LLM,必须先估算才能开始。
  const _canStart = !_estimateStale && estimate && estimate.ok !== false;

  const startStream = (jobId) => {
    setPhase('running');
    setJob((j) => j || { kind: 'llm_extract', status: 'running', stages: [], job_id: jobId });
    esRef.current = window.api.scripts.streamImport(jobId, {
      on_message: (jb) => { if (jb && typeof jb === 'object') setJob({ ...jb, job_id: jb.job_id || jb.id || jobId }); },
      on_done: () => {
        setPhase('done');
        window.__apiToast?.(t('scripts.review.extract_done'), { kind: 'ok', detail: t('scripts.review.extract_done_detail'), duration: 3200 });
        try { window.dispatchEvent(new CustomEvent('rpg-scripts-updated')); } catch (_) {}
        onDone && onDone();
      },
      on_error: () => { /* SSE 在 done 后会正常关闭,不当错误处理 */ },
    });
  };

  const doStart = async () => {
    setErr('');
    try {
      const r = await window.api.scripts.llmExtract(sid, { ...cfgBody(), confirmed: true });
      const jid = r && (r.job_id || r.id);
      if (jid) startStream(jid);
      else { setErr((r && r.error) || t('scripts.review.dispatch_fail')); setPhase('error'); }
    } catch (e) {
      const p = (e && e.payload) || {};
      if (p.job_id) { startStream(p.job_id); return; } // 409 复用已在跑的任务
      setErr(p.error || (e && e.message) || t('scripts.review.dispatch_fail'));
      setPhase('error');
    }
  };

  const doCancel = async () => {
    const jid = job && job.job_id;
    if (!jid) return;
    try { await window.api.scripts.jobCancel(jid); window.__apiToast?.(t('scripts.review.cancel_requested'), { kind: 'warn', duration: 2400 }); } catch (_) {}
  };

  const stages = (job && Array.isArray(job.stages)) ? job.stages : [];
  const overall = job ? (job.overall_progress || 0) : 0;
  const overallTotal = job ? (job.overall_total || 4) : 4;
  const usage = job && job.usage_actual;

  return (
    <CSSpaceBetween size="l">
      <CSSpaceBetween direction="horizontal" size="xs">
        {phase === 'config' && (
          <CSButton onClick={doEstimate} loading={estimating} variant={_estimateStale ? 'primary' : 'normal'}>{t('scripts.review.estimate_cost')}</CSButton>
        )}
        {(phase === 'config' || phase === 'error') && (
          <CSButton variant={!_estimateStale ? 'primary' : 'normal'} iconName="gen-ai"
            onClick={doStart} disabled={!_canStart}>
            {t('scripts.review.start_extract')}
          </CSButton>
        )}
        {phase === 'running' && <CSButton onClick={doCancel}>{t('scripts.review.cancel_job')}</CSButton>}
      </CSSpaceBetween>
      {phase === 'config' && _estimateStale && (
        <CSAlert type="info">{t('scripts.review.must_estimate_first')}</CSAlert>
      )}
      {err && <CSAlert type="error">{err}</CSAlert>}

        {(phase === 'config' || phase === 'error') && (
          <CSSpaceBetween size="l">
            <CSBox color="text-body-secondary" fontSize="body-s">
              {t('scripts.review.desc')}
            </CSBox>
            {/* 收敛处置⑥:scope 选择器已删——本面板只剩「全量重新提取」一种模式,
                worldbook_only/anchors_only/embed_only 与知识库中心矩阵卡片完全重复。 */}
            <CSFormField label={t('scripts.review.algorithm')}>
              <CSSegmentedControl selectedId={algorithm}
                options={[{ id: 'arc', text: t('scripts.review.algo_arc') }, { id: 'per_chapter', text: t('scripts.review.algo_per_chapter') }]}
                onChange={({ detail }) => setAlgorithm(detail.selectedId)} />
            </CSFormField>
            <CSColumnLayout columns={2}>
              <CSFormField label={t('scripts.review.chapter_min')}
                description={t('scripts.review.chapter_range_desc')}>
                <CSInput type="number" value={chapterMin}
                  placeholder={t('scripts.review.chapter_min_placeholder')}
                  onChange={({ detail }) => setChapterMin(detail.value)} />
              </CSFormField>
              <CSFormField label={t('scripts.review.chapter_max')}>
                <CSInput type="number" value={chapterMax}
                  placeholder={t('scripts.review.chapter_max_placeholder')}
                  onChange={({ detail }) => setChapterMax(detail.value)} />
              </CSFormField>
            </CSColumnLayout>
            <CSSpaceBetween size="l">
                {/* Provider+Model:全站唯一实现 AgentModelPicker(extractor 偏好)。
                    它只列出用户已配凭据的 provider、给「未配 key」告警、解析后通过
                    onChange 回传 {api_id, model_real_name} 供 cfgBody() 拼请求体;
                    persistOnMount 把解析出的默认写回 extractor.* 偏好,与 L3047
                    导入侧「提取模型」完全同源、同持久化键。 */}
                <AgentModelPicker
                  prefPrefix="extractor"
                  preferProvider="deepseek"
                  defaultModel={null}
                  variant="bare"
                  persistOnMount
                  configHash="settings-models"
                  description={t('scripts.review.model_desc')}
                  onChange={(api_id, model_real_name) => { setApiId(api_id || ''); setModel(model_real_name || ''); }}
                />
                <CSColumnLayout columns={2}>
                  {algorithm === 'arc' && (
                    <CSFormField label={t('scripts.review.target_arcs')} description={t('scripts.review.target_arcs_desc')}><CSInput type="number" value={targetArcs} onChange={({ detail }) => setTargetArcs(detail.value)} /></CSFormField>
                  )}
                  <CSFormField label={t('scripts.review.concurrency')}><CSInput type="number" value={concurrency} onChange={({ detail }) => setConcurrency(detail.value)} /></CSFormField>
                  <CSFormField label={t('scripts.review.author_era')} description={t('scripts.review.author_era_desc')}><CSInput value={authorEra} onChange={({ detail }) => setAuthorEra(detail.value)} /></CSFormField>
                  <CSFormField label={t('scripts.review.max_usd')}><CSInput type="number" value={maxUsd} onChange={({ detail }) => setMaxUsd(detail.value)} /></CSFormField>
                </CSColumnLayout>
              </CSSpaceBetween>

            {estimate && estimate.ok !== false && (
              <CSAlert type="info" header={t('scripts.review.cost_estimate')}>
                <CSKeyValuePairs columns={4} items={[
                  { label: t('scripts.import.est_cost'), value: estimate.est_usd != null ? `$${Number(estimate.est_usd).toFixed(3)}` : '—' },
                  { label: t('scripts.review.arcs'), value: estimate.arcs != null ? String(estimate.arcs) : '—' },
                  { label: t('scripts.review.input_tokens'), value: estimate.est_input_tokens != null ? Number(estimate.est_input_tokens).toLocaleString() : '—' },
                  { label: t('scripts.review.output_tokens'), value: estimate.est_output_tokens != null ? Number(estimate.est_output_tokens).toLocaleString() : '—' },
                ]} />
                {estimate.note && <CSBox fontSize="body-s" color="text-body-secondary" padding={{ top: 'xs' }}>{estimate.note}</CSBox>}
              </CSAlert>
            )}
            {estimate && estimate.ok === false && <CSAlert type="warning">{estimate.error || estimate.note || t('scripts.review.cannot_estimate')}</CSAlert>}
          </CSSpaceBetween>
        )}

        {(phase === 'running' || phase === 'done') && (
          <CSSpaceBetween size="m">
            <CSProgressBar value={overallTotal ? Math.round(overall / overallTotal * 100) : 0}
              label={t('scripts.review.overall_progress')} additionalInfo={t('scripts.review.stage_info', { cur: overall, total: overallTotal })}
              status={phase === 'done' ? 'success' : 'in-progress'} />
            <CSSpaceBetween size="xs">
              {stages.map((st) => (
                <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CSStatusIndicator type={_stageIndicator(st.status)}>
                    {st.label || (_EXTRACT_STAGE_LABEL_KEYS[st.id] ? t(_EXTRACT_STAGE_LABEL_KEYS[st.id]) : st.id)}
                  </CSStatusIndicator>
                  {st.stage_total ? <CSBox fontSize="body-s" color="text-body-secondary">{st.stage_progress || 0} / {st.stage_total}</CSBox> : null}
                </div>
              ))}
              {stages.length === 0 && <CSBox color="text-body-secondary" fontSize="body-s">{t('scripts.review.dispatching')}</CSBox>}
            </CSSpaceBetween>
            {job && job.budget_estimate && job.budget_estimate.arcs ? (
              <CSBox fontSize="body-s" color="text-body-secondary">{t('scripts.review.split_arcs', { n: job.budget_estimate.arcs })}</CSBox>
            ) : null}
            {usage && (
              <CSAlert type={phase === 'done' ? 'success' : 'info'} header={t('scripts.review.usage')}>
                <CSKeyValuePairs columns={4} items={[
                  { label: t('scripts.review.spent'), value: usage.usd != null ? `$${Number(usage.usd).toFixed(3)}` : '—' },
                  { label: t('scripts.review.input_tokens'), value: usage.input_tokens != null ? Number(usage.input_tokens).toLocaleString() : '—' },
                  { label: t('scripts.review.output_tokens'), value: usage.output_tokens != null ? Number(usage.output_tokens).toLocaleString() : '—' },
                  { label: t('scripts.review.llm_calls'), value: usage.llm_calls != null ? String(usage.llm_calls) : '—' },
                ]} />
              </CSAlert>
            )}
            {phase === 'done' && <CSAlert type="success">{t('scripts.review.extract_complete')}</CSAlert>}
          </CSSpaceBetween>
        )}
      </CSSpaceBetween>
  );
}

export { ScriptDetailPanel, KbExtractPanel };
