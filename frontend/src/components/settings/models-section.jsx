// 模型 / API 配置区(ModelsSection 及全部子弹窗 + Provider 配置 + 目录数据)。
// 纯机械从 pages/settings.jsx 搬出,函数体逐字复制,零行为变化。
import React from 'react';
import { useState as useStatePL, useEffect as useEffectPL, useCallback as useCallbackPL } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../game-icons.jsx';
import Modal from '../Modal.jsx';
import { SettingsToggle, ResizableSplit } from '../../platform-app.jsx';
import { getCaps as _getCapsImported, normalizeProviderId, credentialToCatalogId, catalogToCredentialId } from '../catalog-helpers.js';
import { plNavigate } from '../../router.js';
import { SetGroup } from './shared.jsx';
import CSContainer from '@cloudscape-design/components/container';
import CSHeader from '@cloudscape-design/components/header';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSFormField from '@cloudscape-design/components/form-field';
import CSInput from '@cloudscape-design/components/input';
import CSSelect from '@cloudscape-design/components/select';
import CSBox from '@cloudscape-design/components/box';
import CSButton from '@cloudscape-design/components/button';
import CSAlert from '@cloudscape-design/components/alert';
import CSTable from '@cloudscape-design/components/table';
import CSTabs from '@cloudscape-design/components/tabs';
import CSStatusIndicator from '@cloudscape-design/components/status-indicator';
import CSColumnLayout from '@cloudscape-design/components/column-layout';
import CSModal from '@cloudscape-design/components/modal';
import CSKeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import { CAP_LABEL } from '../../pages/settings.jsx';

// Provider 别名表 + 归一化/方向转换全部上提到 components/catalog-helpers.js(语义统一 #16)。
// 本文件保留原名薄别名,内部调用点与 ESM export(ModelConfigInterceptModal 依赖 normalizeApiId)零变化:
//   normalizeApiId            = normalizeProviderId   (走全别名表)
//   credentialApiIdForCatalog = catalogToCredentialId (catalog→credential:vertex_ai→AgentPlatform)
//   catalogApiIdForCredential = credentialToCatalogId (credential→catalog:AgentPlatform→vertex_ai)
const normalizeApiId = normalizeProviderId;
const credentialApiIdForCatalog = catalogToCredentialId;
const catalogApiIdForCredential = credentialToCatalogId;
function ModelsSection() {
  const { t } = useTranslation();
  // task 51：登录态零 mock。原 useState(MODELS_DATA) 首屏闪过 OpenAI/Anthropic/
  // Google/通义千问/DeepSeek/OpenRouter (35 模型)/local 七个假供应商和它们
  // 的假"key_hint = ·sk-…c024"。改成登录用户初始 []；匿名访客（设计预览）
  // 仍可看到 MODELS_DATA 作为 demo。
  // A5: 正常登录用户首屏显示 skeleton 占位（不展示 mock 数据），fetch 完成后
  // setLoading(false)；仅 URL ?demo=1 或匿名访客才使用 MODELS_DATA。
  const IS_DEMO = new URLSearchParams(location.search).get('demo') === '1';
  const IS_ANON_M = !(window.RPG_AUTH && window.RPG_AUTH.authed);
  const isAdminUser = !!(window.RPG_AUTH && window.RPG_AUTH.authed && window.MOCK_PLATFORM?.user?.role === "admin");
  const useMock = IS_ANON_M || IS_DEMO;
  const [apis, setApis] = useStatePL(useMock ? MODELS_DATA : []);
  // A5: loading 初始 true 对登录用户，false 对 demo/anon（已有 mock 数据）
  const [apisLoading, setApisLoading] = useStatePL(!useMock);
  const [expanded, setExpanded] = useStatePL({ openai: true, anthropic: true });
  const [editingApi, setEditingApi] = useStatePL(null);
  const [addingApi, setAddingApi] = useStatePL(false);
  const [visibilityApi, setVisibilityApi] = useStatePL(null);
  const [validateApi, setValidateApi] = useStatePL(null);
  const [selectedApiId, setSelectedApiId] = useStatePL(null);
  const autoSyncedRef = React.useRef(new Set());

  const mapModel = React.useCallback((m) => ({
    id: m.real_name || m.id,
    display: m.display_name || m.real_name || m.id,
    real_name: m.real_name || m.id,
    enabled: m.enabled !== false,
    // 可见性 = enabled(目录里没有独立的 hidden 字段,旧的 m.hidden!==true 恒为 true=可见性弹窗
    // 永远全选、不反映真实隐藏态)。统一用 enabled:与选择器过滤(m.enabled===false 隐藏)和
    // 可见性端点(写 enabled)一致,弹窗重开能正确显示用户隐藏了哪些。
    visible: m.enabled !== false,
    synced: m.synced === true,  // 同步来的(overlay)模型 → 可见性 toggle 走 per-user 端点
    capabilities: m.capabilities || {},
    health: m.health || "untested",
    health_error: m.health_error || "",
    health_latency_ms: m.health_latency_ms,
    health_checked_at: m.health_checked_at,
    health_status_detail: m.status_detail || m.health_status_detail || undefined,
  }), []);

  const loadConfiguredApis = useCallbackPL(async () => {
    const [data, creds] = await Promise.all([
      window.api.models.list(),
      window.api.credentials.list().catch(() => ({ items: [] })),
    ]);
    const credMap = {};
    for (const c of (creds?.items || creds?.credentials || [])) {
      const cid = normalizeApiId(c.api_id || c.id);
      credMap[cid] = {
        has_key: !!c.has_credential || !!c.has_key || !!c.key_hint,
        key_hint: c.key_hint || "",
        enabled: c.enabled !== false,
        base_url_override: c.base_url_override || "",
        proxy_url: c.proxy_url || "",
      };
    }
    const list = data?.models?.apis || data?.apis || [];
    const rows = Array.isArray(list) ? list.map(api => {
      const catalogId = catalogApiIdForCredential(api.api_id || api.id);
      const credentialId = credentialApiIdForCatalog(catalogId);
      const cred = credMap[credentialId] || credMap[normalizeApiId(catalogId)] || {};
      return {
        id: catalogId,
        credential_id: credentialId,
        name: api.display_name || api.name || catalogId,
        // 用户自己的 base_url_override(指向中转站)优先:它来自 list_credentials,不被
        // _redact_catalog 抹掉;而 api.base_url 对非 admin 已被后端 redact 成空。用 override
        // 兜底让 ① 详情/编辑弹窗显示真实中转站地址 ② 重新保存 key 时不会因表单空值把 override
        // 清掉(与生成/同步实际所用一致)③ 同步模型时 body 也带上正确地址。
        base_url: cred.base_url_override || api.base_url || "",
        key_set: !!cred.has_key,
        key_hint: cred.key_hint || t('settings.models.key_set_hint'),
        status: cred.enabled === false ? "disabled" : "configured",
        connectivity: { status: "untested" },
        enabled: cred.enabled !== false,
        proxy_url: cred.proxy_url || "",
        proxy: cred.proxy_url ? "http_proxy" : "direct",
        models: (api.models || api.entries || []).map(mapModel),
      };
    }).filter(api => api.key_set) : [];
    // 中转站: 把不在全局 catalog 里的用户自定义凭证(带 base_url)合成为 provider 行,
    // 否则保存后在列表里看不到、无法选模型。models=[] 由用户点同步从中转站拉取。
    const catalogIds = new Set((Array.isArray(list) ? list : []).map(a => normalizeApiId(catalogApiIdForCredential(a.api_id || a.id))));
    const customRows = Object.entries(credMap)
      .filter(([cid, c]) => c.has_key && c.base_url_override && !catalogIds.has(normalizeApiId(cid)))
      .map(([cid, c]) => ({
        id: cid, credential_id: cid, name: cid,
        base_url: c.base_url_override, key_set: true, key_hint: c.key_hint || '',
        status: c.enabled === false ? "disabled" : "configured",
        connectivity: { status: "untested" }, enabled: c.enabled !== false,
        proxy_url: c.proxy_url || "",
        proxy: c.proxy_url ? "http_proxy" : "direct", models: [], _custom: true,
      }));
    const allRows = [...rows, ...customRows];
    setApis(allRows);
    return allRows;
  }, [mapModel, t]);

  const syncRemoteModels = useCallbackPL(async (api, opts = {}) => {
    if (!api) return null;
    const apiId = catalogApiIdForCredential(api.id);
    setApis(arr => arr.map(a => a.id === apiId ? {
      ...a,
      connectivity: { ...(a.connectivity || {}), status: "checking", error: "" },
    } : a));
    const started = performance.now();
    try {
      const r = await window.api.models.syncRemote({ api_id: apiId, base_url: api.base_url || "" });
      if (!r?.ok) throw new Error(r?.error || "remote model sync failed");
      const elapsed = Math.max(1, Math.round(performance.now() - started));
      const models = (r.models || []).map(mapModel);
      setApis(arr => arr.map(a => a.id === apiId ? {
        ...a,
        models,
        status: "configured",
        connectivity: {
          status: "ok",
          latency_ms: elapsed,
          checked_at: Date.now(),
          remote_total: r.remote_total ?? models.length,
          synced: r.synced ?? models.length,
          error: "",
        },
      } : a));
      if (!opts.silent) {
        window.__apiToast?.(t('settings.models.sync_ok', { count: models.length }), { kind: "ok", duration: 2200 });
      }
      return r;
    } catch (e) {
      setApis(arr => arr.map(a => a.id === apiId ? {
        ...a,
        connectivity: {
          status: "err",
          checked_at: Date.now(),
          error: e?.message || "sync failed",
        },
      } : a));
      if (!opts.silent) {
        window.__apiToast?.(t('settings.models.sync_fail'), { kind: "danger", detail: e?.message });
      }
      return null;
    }
  }, [mapModel, t]);

  useEffectPL(() => {
    if (useMock) return;
    (async () => {
      try { await loadConfiguredApis(); }
      catch (_) {}
      finally { setApisLoading(false); }
    })();
  }, [useMock, loadConfiguredApis]);

  const toggleApi = async (id) => {
    const api = apis.find(a => a.id === id);
    const newEnabled = !api?.enabled;
    setApis(arr => arr.map(a => a.id === id ? { ...a, enabled: newEnabled } : a));
    try {
      await window.api.models.upsertApi({ api_id: id, enabled: newEnabled });
    } catch (_) {}
  };
  const toggleModel = async (apiId, mId) => {
    const api = apis.find(a => a.id === apiId);
    const m = api?.models.find(m => m.id === mId);
    const wasEnabled = m?.enabled ?? true;
    setApis(arr => arr.map(a => a.id === apiId
      ? { ...a, models: a.models.map(m => m.id === mId ? { ...m, enabled: !wasEnabled } : m) }
      : a));
    try {
      await window.api.models.upsertModel({ api_id: apiId, real_name: mId, enabled: !wasEnabled });
    } catch (_) {}
  };
  const renameModel = async (apiId, mId, display) => {
    setApis(arr => arr.map(a => a.id === apiId
      ? { ...a, models: a.models.map(m => m.id === mId ? { ...m, display } : m) }
      : a));
    try { await window.api.models.upsertModel({ api_id: apiId, real_name: mId, display_name: display }); } catch (_) {}
  };
  const setModelVisibility = async (apiId, ids) => {
    const api = apis.find(a => a.id === apiId);
    setApis(arr => arr.map(a => a.id === apiId
      ? { ...a, models: a.models.map(m => ({ ...m, visible: ids.includes(m.id) })) }
      : a));
    if (api) {
      await Promise.all(api.models.map(m => {
        const body = { api_id: apiId, model: m.id, visible: ids.includes(m.id) };
        // 同步来的(overlay)模型走 per-user 端点(任何用户可隐藏自己的、re-sync 不重置);
        // 全局策展模型走全局端点(admin-only)——非 admin 跳过,避免注定失败的 403。
        if (m.synced) return window.api.models.meVisibility(body).catch(() => {});
        if (!isAdminUser) return Promise.resolve();  // 非 admin 无权改全局可见性
        return window.api.models.visibility(body).catch(() => {});
      }));
    }
  };
  const removeModels = async (apiId, ids) => {
    setApis(arr => arr.map(a => a.id === apiId
      ? { ...a, models: a.models.filter(m => !ids.includes(m.id)) }
      : a));
    await Promise.all(ids.map(id =>
      window.api.models.deleteModel({ api_id: apiId, real_name: id }).catch(() => {})
    ));
  };
  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const enabledTotal = apis.reduce((a, x) => a + x.models.filter(m => m.enabled).length, 0);
  const totalModels = apis.reduce((a, x) => a + x.models.length, 0);

  // 只显示「已配置 API Key」的供应商(对齐剧本/存档:没有就显示添加按钮,不堆砌)
  const configuredApis = apis.filter(a => a.key_set);
  const selectedApi = configuredApis.find(a => a.id === selectedApiId) || null;

  useEffectPL(() => {
    if (useMock || apisLoading) return;
    configuredApis.forEach(api => {
      if (autoSyncedRef.current.has(api.id)) return;
      autoSyncedRef.current.add(api.id);
      syncRemoteModels(api, { silent: true });
    });
  }, [useMock, apisLoading, configuredApis.map(a => a.id).join("|"), syncRemoteModels]);

  const detailEl = selectedApi ? (
    <ApiDetailPanel
      api={selectedApi}
      onEdit={() => setEditingApi(selectedApi.id)}
      onVisibility={() => setVisibilityApi(selectedApi.id)}
      onValidate={() => setValidateApi(selectedApi.id)}
      onToggleModel={(mId) => toggleModel(selectedApi.id, mId)}
      onRenameModel={(mId, display) => renameModel(selectedApi.id, mId, display)}
      onDeleteKey={async () => {
        if (!await window.__confirm({ title: t('settings.models.delete_key_title'), message: t('settings.models.delete_key_confirm', { name: selectedApi.name }), danger: true, confirmText: t('settings.models.delete_key_btn') })) return;
        try {
          // 删除凭证走真正的 delete 端点(无 Base URL 校验);旧实现用 set({api_key:''})
          // 会触发「自定义供应商必须填写 Base URL」的设置态校验,导致自定义中转站删不掉。
          await window.api.credentials.remove({ api_id: credentialApiIdForCatalog(selectedApi.id) });
          window.__apiToast?.(t('settings.models.delete_key_ok'), { kind: 'ok' });
          setSelectedApiId(null);
          setApis(arr => arr.map(a => a.id === selectedApi.id ? { ...a, key_set: false, key_hint: '—' } : a));
          // 删除凭证后从 autoSyncedRef 移除,允许下次重新配置 key 后重新 auto-sync。
          autoSyncedRef.current.delete(selectedApi.id);
          if (typeof window.__refreshPlatform === 'function') { try { await window.__refreshPlatform(); } catch (_) {} }
        } catch (e) { window.__apiToast?.(t('settings.models.delete_key_fail'), { kind: 'danger', detail: e?.message }); }
      }}
    />
  ) : null;

  // A5: skeleton 占位 — 登录用户首次进入时，fetch 完成前不展示表格
  if (apisLoading) {
    return (
      <CSSpaceBetween size="l">
        <CSHeader variant="h1" description={t('settings.models.description')}>{t('settings.models.title')}</CSHeader>
        {[1, 2, 3].map(i => (
          <CSContainer key={i}>
            <CSSpaceBetween size="s">
              {[1, 2].map(j => (
                <div key={j} style={{ height: 18, borderRadius: 4, background: 'var(--color-background-control-disabled, #3a3a3a)', opacity: 0.5 + j * 0.15, width: j === 1 ? '40%' : '70%' }} />
              ))}
            </CSSpaceBetween>
          </CSContainer>
        ))}
      </CSSpaceBetween>
    );
  }

  return (
    <CSSpaceBetween size="l">
      <CSHeader
        variant="h1"
        counter={`(${configuredApis.length})`}
        description={t('settings.models.description')}
        actions={<CSButton variant="primary" iconName="add-plus" onClick={() => setAddingApi(true)}>{t('settings.models.add_key')}</CSButton>}
      >{t('settings.models.title')}</CSHeader>

      {configuredApis.length === 0 ? (
        <CSContainer>
          <CSBox textAlign="center" color="inherit" padding={{ vertical: 'xxl' }}>
            <CSSpaceBetween size="s" alignItems="center">
              <CSBox variant="h3">{t('settings.models.empty_title')}</CSBox>
              <CSBox color="text-body-secondary">{t('settings.models.empty_desc')}</CSBox>
              <CSButton variant="primary" iconName="add-plus" onClick={() => setAddingApi(true)}>{t('settings.models.empty_add')}</CSButton>
            </CSSpaceBetween>
          </CSBox>
        </CSContainer>
      ) : (() => {
        const apiTableEl = (
          <CSTable
            variant="container"
            trackBy="id"
            selectionType="single"
            items={configuredApis}
            selectedItems={selectedApi ? [selectedApi] : []}
            onSelectionChange={({ detail }) => { const x = detail.selectedItems[0]; if (x) setSelectedApiId(x.id); }}
            onRowClick={({ detail }) => setSelectedApiId(detail.item.id)}
            columnDefinitions={[
              { id: 'name', header: t('settings.models.col_provider'), cell: (a) => (
                <div><CSBox fontWeight="bold">{a.name}</CSBox><CSBox fontSize="body-s" color="text-body-secondary"><span className="mono">{a.id}</span></CSBox></div>
              ) },
              { id: 'key', header: 'API Key', cell: (a) => <span className="mono">•••• {a.key_hint || t('settings.models.key_set_hint')}</span> },
              { id: 'models', header: t('settings.models.col_models'), cell: (a) => `${a.models.filter(m => m.enabled).length} / ${a.models.length}` },
              { id: 'connectivity', header: t('settings.models.col_connectivity'), cell: (a) => {
                const c = a.connectivity || {};
                const status = a.enabled === false ? "disabled" : (c.status || "untested");
                const label = status === "checking"
                  ? t('settings.models.connectivity_checking')
                  : status === "ok"
                    ? t('settings.models.connectivity_ok')
                    : status === "err"
                      ? t('settings.models.connectivity_err')
                      : status === "disabled"
                        ? t('settings.models.status_disabled')
                        : t('settings.models.connectivity_untested');
                const type = status === "ok" ? "success" : status === "err" ? "error" : status === "checking" ? "in-progress" : "stopped";
                return (
                  <button
                    type="button"
                    className="linklike"
                    title={t('settings.models.connectivity_refresh_tip')}
                    onClick={(e) => { e.stopPropagation(); syncRemoteModels(a); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
                  >
                    <CSStatusIndicator type={type}>{label}</CSStatusIndicator>
                    {c.latency_ms ? <span className="mono muted-2">{c.latency_ms}ms</span> : null}
                  </button>
                );
              } },
              { id: 'go', header: '', cell: (a) => (
                <span onClick={(e) => e.stopPropagation()}>
                  <SettingsToggle on={a.enabled} set={() => toggleApi(a.id)} />
                </span>
              ) },
            ]}
          />
        );
        return selectedApi
          ? <ResizableSplit storageKey="apikey" top={apiTableEl} bottom={detailEl} />
          : apiTableEl;
      })()}

      <EditApiModal
        open={!!editingApi || addingApi}
        api={apis.find(a => a.id === editingApi)}
        isNew={addingApi}
        isAdminUser={isAdminUser}
        onClose={() => { setEditingApi(null); setAddingApi(false); }}
        onConfirm={async (payload) => {
          const credentialId = normalizeApiId(payload.id);
          const catalogId = catalogApiIdForCredential(credentialId);
          const cfg = PROVIDERS_CONFIG.find((p) => catalogApiIdForCredential(p.id) === catalogId || normalizeApiId(p.id) === credentialId);
          const kind = catalogId === "vertex_ai"
            ? "vertex_ai"
            : catalogId === "anthropic"
              ? "anthropic"
              : "openai_compat";
          // 中转站: 普通用户也可添加自定义 OpenAI 兼容端点 — 后端 me.py 放行未知
          // provider(必带 base_url) + set_credential 的 _validate_base_url 做 SSRF 防护。
          try {
            // task: BYOK fix — 普通用户填 API key 不应被 admin 闸住。
            // /api/models/api(upsertApi)写全局 catalog,只有 admin 能调。
            // 普通用户场景:provider 是项目内置的,catalog 已有 → 直接走 credentials.set。
            // 若管理员新加 provider(addingApi=true)或者改 base_url/proxy 这类全局字段,
            // 才尝试 upsertApi。普通用户不保存未知 api_id,避免后续同步模型报 api_id 不存在。
            const existing = apis.find(a => a.id === catalogId);
            // proxy(连接方式/代理 URL)现在是 per-user 凭据字段,走 credentials.set,不再塞全局 catalog。
            const needsCatalogWrite = isAdminUser && (
              addingApi
              || !existing
              || (payload.base_url && payload.base_url !== existing.base_url)
            );
            if (needsCatalogWrite) {
              try {
                await window.api.models.upsertApi({
                  api_id: catalogId,
                  display_name: payload.name || cfg?.name || catalogId,
                  base_url: payload.base_url,
                  kind,
                });
              } catch (e) {
                if (e?.status === 403) {
                  // 普通用户改全局 catalog 被拒,提示但不阻断 key 保存
                  window.__apiToast?.(t('settings.more.edit_api.admin_base_url_warn'), { kind: "warn", duration: 3500 });
                } else {
                  throw e;
                }
              }
            }
            if (payload.api_key && payload.api_key.trim()) {
              try {
                await window.api.credentials.set({
                  api_id: credentialId, api_key: payload.api_key.trim(),
                  base_url_override: payload.base_url || '',
                  proxy: payload.proxy === 'http_proxy' ? (payload.proxy_url || '').trim() : '',
                });
              } catch (e) {
                window.__apiToast?.(t('settings.edit_api.key_save_fail'), { kind: "warn", detail: e?.message, duration: 4000 });
                throw e;
              }
            }
            window.__apiToast?.(addingApi ? t('settings.edit_api.add_ok') : t('settings.edit_api.save_ok'), { kind: "ok" });
            const rows = await loadConfiguredApis();
            const row = rows.find(a => a.id === catalogId) || {
              id: catalogId,
              name: payload.name || cfg?.name || catalogId,
              base_url: payload.base_url,
              key_set: true,
              enabled: true,
              models: [],
            };
            setSelectedApiId(catalogId);
            await syncRemoteModels(row, { silent: false });
          } catch (e) {
            window.__apiToast?.(t('settings.edit_api.save_fail'), { kind: "danger", detail: e?.message });
          }
          setEditingApi(null); setAddingApi(false);
          // 刷新让真实 key_set / key_hint 由后端权威
          if (typeof window.__refreshPlatform === "function") {
            try { await window.__refreshPlatform(); } catch (_) {}
          }
        }}
      />
      <VisibilityModal
        open={!!visibilityApi}
        api={apis.find(a => a.id === visibilityApi)}
        onClose={() => setVisibilityApi(null)}
        onConfirm={(visibleIds) => { setModelVisibility(visibilityApi, visibleIds); setVisibilityApi(null); }}
      />
      <ValidateModal
        open={!!validateApi}
        api={apis.find(a => a.id === validateApi)}
        onClose={() => setValidateApi(null)}
        onConfirm={(toRemove) => { removeModels(validateApi, toRemove); setValidateApi(null); }}
      />
    </CSSpaceBetween>
  );
}

/* API 详情面板 —— 选中某个已配置 Key 后在列表下方展开。
   Tabs:模型列表(ApiModelsList)/ API 用量(简略)。头部:编辑 / 管理显示 / 校验 / 删除 Key。 */
function ApiDetailPanel({ api, onEdit, onVisibility, onValidate, onDeleteKey, onToggleModel, onRenameModel }) {
  const { t } = useTranslation();
  const [tab, setTab] = useStatePL('models');
  const [usage, setUsage] = useStatePL(null);
  useEffectPL(() => { setTab('models'); setUsage(null); }, [api.id]);
  useEffectPL(() => {
    if (tab !== 'usage' || usage != null) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await window.api.account.usage(30);
        if (cancelled) return;
        const byApi = (r?.by_api || r?.apis || []).find(x => (x.api_id || x.id) === api.id);
        setUsage(byApi || {});
      } catch (_) { if (!cancelled) setUsage({}); }
    })();
    return () => { cancelled = true; };
  }, [tab, api.id]);

  return (
    <CSContainer header={
      <CSHeader variant="h2"
        description={<span style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="mono">{api.id}</span>
          <span style={{ color: 'var(--muted)' }}>{t('settings.models.base_url_label')}: <span className="mono">{api.base_url || '—'}</span></span>
          <span style={{ color: 'var(--muted)' }}>{t('settings.models.key_label')}: <span className="mono">•••• {api.key_hint || t('settings.models.key_set_hint')}</span></span>
        </span>}
        actions={
          <CSSpaceBetween direction="horizontal" size="xs">
            <CSButton iconName="edit" onClick={onEdit}>{t('settings.models.detail_edit')}</CSButton>
            <CSButton iconName="view-full" onClick={onVisibility}>{t('settings.models.detail_manage')}</CSButton>
            <CSButton iconName="refresh" onClick={onValidate}>{t('settings.models.detail_validate')}</CSButton>
            <CSButton iconName="remove" onClick={onDeleteKey}>{t('settings.models.detail_delete_key')}</CSButton>
          </CSSpaceBetween>
        }
      >{api.name}</CSHeader>
    }>
      <CSTabs activeTabId={tab} onChange={({ detail }) => setTab(detail.activeTabId)} tabs={[
        { id: 'models', label: t('settings.models.tab_models', { count: api.models.length }), content: (
          <ApiModelsList api={api} onToggleModel={onToggleModel} onRenameModel={onRenameModel} />
        ) },
        { id: 'usage', label: t('settings.models.tab_usage'), content: (
          usage == null
            ? <CSBox color="text-body-secondary">{t('common.loading')}</CSBox>
            : <CSSpaceBetween size="m">
                <CSKeyValuePairs columns={4} items={[
                  { label: t('settings.models.usage_requests'), value: usage.requests != null ? Number(usage.requests).toLocaleString() : '—' },
                  { label: t('settings.models.usage_input_tokens'), value: usage.input_tokens != null ? Number(usage.input_tokens).toLocaleString() : '—' },
                  { label: t('settings.models.usage_output_tokens'), value: usage.output_tokens != null ? Number(usage.output_tokens).toLocaleString() : '—' },
                  { label: t('settings.models.usage_cost'), value: usage.cost_usd != null ? `$${Number(usage.cost_usd).toFixed(2)}` : '—' },
                ]} />
                <CSBox fontSize="body-s" color="text-body-secondary">{t('settings.models.usage_detail')} <a href="/usage" onClick={(e) => { e.preventDefault(); plNavigate('usage'); }}>{t('settings.models.usage_page')}</a>。</CSBox>
              </CSSpaceBetween>
        ) },
      ]} />
    </CSContainer>
  );
}

function AddModelModal({ open, api, onClose, onConfirm }) {
  const { t } = useTranslation();
  const [form, setForm] = useStatePL({
    real_name: "",
    display: "",
    capabilities: [],
    price: "",
    context: "128K",
  });
  React.useEffect(() => {
    if (open) setForm({ real_name: "", display: "", capabilities: [], price: "", context: "128K" });
  }, [open]);
  if (!open || !api) return null;
  const toggleCap = (c) => setForm(f => ({ ...f, capabilities: f.capabilities.includes(c) ? f.capabilities.filter(x => x !== c) : [...f.capabilities, c] }));
  return (
    <Modal
      open
      eyebrow={t('settings.add_model.eyebrow', { api: api.name })}
      title={t('settings.add_model.title')}
      width={560}
      onClose={onClose}
      footer={<>
        <span className="muted-2" style={{fontSize: 11.5}}>
          <Icon name="info" size={11} /> POST <span className="mono">/api/v1/models/model</span>
        </span>
        <div style={{display: "flex", gap: 8}}>
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" disabled={!form.real_name || !form.display}
            onClick={() => onConfirm({ id: form.real_name, ...form })}>
            <Icon name="check" size={12} /> {t('settings.add_model.add_btn')}
          </button>
        </div>
      </>}
    >
        <div className="pl-modal-form">
          <div className="pl-field">
            <label>{t('settings.add_model.real_name')} <span className="muted-2" style={{textTransform: "none", letterSpacing: 0, marginLeft: 6}}>{t('settings.add_model.real_name_hint', { api: api.name })}</span></label>
            <input className="mono" value={form.real_name} onChange={(e) => setForm(f => ({ ...f, real_name: e.target.value }))} placeholder="gpt-4o-mini-2024-07-18" autoFocus />
          </div>
          <div className="pl-field">
            <label>{t('settings.add_model.display')} <span className="muted-2" style={{textTransform: "none", letterSpacing: 0, marginLeft: 6}}>{t('settings.add_model.display_hint')}</span></label>
            <input value={form.display} onChange={(e) => setForm(f => ({ ...f, display: e.target.value }))} placeholder="GPT-4o · RPG" />
          </div>
          <div className="pl-field">
            <label>{t('settings.add_model.caps')} <span className="muted-2" style={{textTransform: "none", letterSpacing: 0, marginLeft: 6}}>{t('settings.add_model.caps_hint')}</span></label>
            <div className="pl-rules">
              {Object.keys(CAP_LABEL).map(c => (
                <button key={c} className={`pl-rule-chip ${form.capabilities.includes(c) ? "active" : ""}`} onClick={() => toggleCap(c)}>{CAP_LABEL[c]}</button>
              ))}
            </div>
          </div>
          <div className="pl-import-grid" style={{gridTemplateColumns: "1fr 1fr"}}>
            <div className="pl-field">
              <label>{t('settings.add_model.price')}</label>
              <input className="mono" value={form.price} onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} placeholder="$0.15 / $0.60" />
            </div>
            <div className="pl-field">
              <label>{t('settings.add_model.context')}</label>
              <input className="mono" value={form.context} onChange={(e) => setForm(f => ({ ...f, context: e.target.value }))} placeholder="128K" />
            </div>
          </div>
        </div>
    </Modal>
  );
}

function EditApiModal({ open, api, isNew, isAdminUser = false, onClose, onConfirm }) {
  const { t } = useTranslation();
  // 新增时供应商走下拉(从 PROVIDERS_CONFIG 选,自动带出 base_url);选「自定义」可手填。
  // 编辑时供应商固定,只改 base_url / key。key 写入后不回显。
  const CUSTOM = '__custom__';
  const [provider, setProvider] = useStatePL('');   // 选中的 provider id(新增用)
  const [form, setForm] = useStatePL({ id: "", name: "", base_url: "", api_key: "", proxy: "direct", proxy_url: "" });
  React.useEffect(() => {
    if (!open) return;
    if (isNew) { setProvider(''); setForm({ id: "", name: "", base_url: "", api_key: "", proxy: "direct", proxy_url: "" }); }
    else if (api) { setProvider(api.id); setForm({ id: api.id, name: api.name, base_url: api.base_url, api_key: "", proxy: api.proxy || "direct", proxy_url: api.proxy_url || "" }); }
  }, [open, api, isNew]);
  if (!open) return null;

  const provOptions = [
    ...PROVIDERS_CONFIG.filter((p) => !p.hidden_in_edit_modal).map((p) => ({ value: p.id, label: p.name, description: p.defaultBase || undefined })),
    { value: CUSTOM, label: t('settings.edit_api.custom_provider'), description: t('settings.edit_api.custom_provider_desc') },
  ];
  const onPickProvider = (val) => {
    setProvider(val);
    if (val === CUSTOM) { setForm((f) => ({ ...f, id: "", name: "", base_url: "" })); return; }
    const p = PROVIDERS_CONFIG.find((x) => x.id === val);
    if (p) setForm((f) => ({ ...f, id: p.id, name: p.name, base_url: p.defaultBase || "" }));
  };
  const isCustom = provider === CUSTOM;
  // Agent Platform (vertex_ai / AgentPlatform) 走 SA JSON — 不需要 base_url，api_key 是 JSON 字符串
  const selectedProviderCfg = PROVIDERS_CONFIG.find((x) => x.id === provider);
  const isAgentPlatform = selectedProviderCfg?.special === 'agent_platform' || api?.kind === 'vertex_ai';
  // SA JSON 校验: 必须能 parse 且含三个必要字段
  const _saJsonValid = (() => {
    if (!isAgentPlatform || !form.api_key.trim()) return false;
    try {
      const sa = JSON.parse(form.api_key.trim());
      return !!(sa.client_email && sa.private_key && sa.project_id);
    } catch { return false; }
  })();
  const canSubmit = isAgentPlatform
    ? (!!form.id && !!form.name && (isNew ? _saJsonValid : true))
    : (!!form.id && !!form.name && !!form.base_url && (isNew ? !!form.api_key.trim() : true));

  return (
    <CSModal
      visible
      onDismiss={onClose}
      header={isNew ? t('settings.edit_api.add_title') : t('settings.edit_api.edit_title', { name: api?.name || '' })}
      footer={
        <CSBox float="right">
          <CSSpaceBetween direction="horizontal" size="xs">
            <CSButton variant="link" onClick={onClose}>{t('common.cancel')}</CSButton>
            <CSButton variant="primary" disabled={!canSubmit} onClick={() => onConfirm(form)}>{isNew ? t('settings.edit_api.add_btn') : t('settings.edit_api.save_btn')}</CSButton>
          </CSSpaceBetween>
        </CSBox>
      }
    >
      <CSSpaceBetween size="l">
        {isNew && (
          <CSFormField label={t('settings.edit_api.provider')} description={t('settings.edit_api.provider_desc')}>
            <CSSelect
              selectedOption={provOptions.find((o) => o.value === provider) || null}
              options={provOptions}
              placeholder={t('settings.edit_api.provider_placeholder')}
              filteringType="auto"
              onChange={({ detail }) => onPickProvider(detail.selectedOption.value)}
            />
          </CSFormField>
        )}
        {(isCustom || !isNew) && (
          <CSColumnLayout columns={2}>
            <CSFormField label={t('settings.edit_api.id_field')}>
              <CSInput value={form.id} disabled={!isNew}
                onChange={({ detail }) => setForm((f) => ({ ...f, id: detail.value }))} placeholder="openai" />
            </CSFormField>
            <CSFormField label={t('settings.edit_api.display_name')}>
              <CSInput value={form.name} onChange={({ detail }) => setForm((f) => ({ ...f, name: detail.value }))} placeholder="OpenAI" />
            </CSFormField>
          </CSColumnLayout>
        )}
        {(provider || !isNew) && (
          <>
            {/* Agent Platform (Vertex SA JSON) 模式: 隐藏 base_url, api_key 改为 SA JSON textarea */}
            {isAgentPlatform ? (
              <CSFormField
                label="Service Account JSON"
                description={api?.key_set ? t('settings.more.edit_api.sa_desc_set', { hint: api.key_hint || t('settings.more.edit_api.sa_encrypted') }) : t('settings.more.edit_api.sa_desc_new')}
              >
                <textarea
                  rows={6}
                  value={form.api_key}
                  onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                  placeholder={'{"type": "service_account", "project_id": "...", "client_email": "...", "private_key": "<PRIVATE_KEY_PEM_WITH_NEWLINES>"}'}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical', padding: '8px', boxSizing: 'border-box' }}
                  autoComplete="off"
                  spellCheck={false}
                />
                {form.api_key.trim() && !_saJsonValid && (
                  <div style={{ color: 'var(--color-text-status-error, #d91515)', fontSize: '12px', marginTop: '4px' }}>
                    {t('settings.more.edit_api.sa_json_invalid')}
                  </div>
                )}
                {_saJsonValid && (
                  <div style={{ color: 'var(--color-text-status-success, #1a7e3c)', fontSize: '12px', marginTop: '4px' }}>
                    {t('settings.more.edit_api.sa_json_valid', { project: (() => { try { return JSON.parse(form.api_key).project_id; } catch { return ''; } })() })}
                  </div>
                )}
              </CSFormField>
            ) : (
              <>
                <CSFormField label={t('settings.edit_api.base_url')}>
                  <CSInput value={form.base_url} onChange={({ detail }) => setForm((f) => ({ ...f, base_url: detail.value }))} placeholder="https://your-relay.example.com/v1" />
                </CSFormField>
                <CSFormField label={t('settings.edit_api.api_key')} description={api?.key_set ? t('settings.edit_api.api_key_desc_set', { hint: api.key_hint || t('settings.models.key_set_hint') }) : t('settings.edit_api.api_key_desc_new')}>
                  <CSInput type="password" value={form.api_key}
                    onChange={({ detail }) => setForm((f) => ({ ...f, api_key: detail.value }))}
                    placeholder={api?.key_set ? t('settings.edit_api.api_key_placeholder_keep') : "sk-…"} autoComplete="new-password" />
                </CSFormField>
              </>
            )}
            <CSFormField label={t('settings.edit_api.connection')}
              description={form.proxy === 'http_proxy' ? t('settings.edit_api.proxy_hint') : undefined}>
              <CSSelect
                selectedOption={{ value: form.proxy, label: form.proxy }}
                options={[{ value: 'direct', label: t('settings.edit_api.direct') }, { value: 'http_proxy', label: t('settings.edit_api.http_proxy') }, { value: 'lan', label: t('settings.edit_api.lan') }]}
                onChange={({ detail }) => setForm((f) => ({ ...f, proxy: detail.selectedOption.value }))}
              />
            </CSFormField>
            {form.proxy === 'http_proxy' && (
              <CSFormField label={t('settings.edit_api.proxy_url')}>
                <CSInput value={form.proxy_url}
                  onChange={({ detail }) => setForm((f) => ({ ...f, proxy_url: detail.value }))}
                  placeholder="http://127.0.0.1:7890" />
              </CSFormField>
            )}
          </>
        )}
      </CSSpaceBetween>
    </CSModal>
  );
}

function VisibilityModal({ open, api, onClose, onConfirm }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useStatePL(new Set());
  const [q, setQ] = useStatePL("");
  React.useEffect(() => {
    if (open && api) {
      setSelected(new Set(api.models.filter(m => m.visible !== false).map(m => m.id)));
      setQ("");
    }
  }, [open, api]);
  if (!open || !api) return null;
  const toggle = (id) => setSelected(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const filtered = api.models.filter(m => {
    if (!q) return true;
    const v = q.toLowerCase();
    return m.display.toLowerCase().includes(v) || m.real_name.toLowerCase().includes(v);
  });
  const allVisible = filtered.every(m => selected.has(m.id));
  const toggleAll = () => setSelected(s => {
    const n = new Set(s);
    if (allVisible) filtered.forEach(m => n.delete(m.id));
    else filtered.forEach(m => n.add(m.id));
    return n;
  });
  return (
    <Modal
      open
      eyebrow={t('settings.visibility.eyebrow', { name: api.name })}
      title={t('settings.visibility.title', { selected: selected.size, total: api.models.length })}
      width={640}
      panelStyle={{maxHeight: "88vh"}}
      onClose={onClose}
      footer={<>
        <span className="muted-2" style={{fontSize: 11.5}}>
          <Icon name="info" size={11} /> {t('settings.visibility.info')}
        </span>
        <div style={{display: "flex", gap: 8}}>
          <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn primary" onClick={() => onConfirm([...selected])}>
            <Icon name="check" size={12} /> {t('settings.visibility.save')}
          </button>
        </div>
      </>}
    >
        <div className="pl-model-search" style={{flex: "0 0 auto"}}>
          <Icon name="search" size={12} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('settings.visibility.search_placeholder', { count: api.models.length })} autoFocus />
          {q && <button className="iconbtn" onClick={() => setQ("")} style={{width: 18, height: 18}}>
            <Icon name="close" size={10} />
          </button>}
        </div>
        <div className="pl-vis-toolbar">
          <button className="btn ghost" onClick={toggleAll}>
            {allVisible ? <><Icon name="eye_off" size={12} /> {t('settings.visibility.hide_all')}</> : <><Icon name="eye" size={12} /> {t('settings.visibility.show_all')}</>}
          </button>
          <span className="muted-2 mono" style={{marginLeft: "auto", fontSize: 11}}>
            {t('settings.visibility.matched', { count: filtered.length, selected: filtered.filter(m => selected.has(m.id)).length })}
          </span>
        </div>
        <div className="pl-vis-list">
          {filtered.length === 0 ? (
            <div className="pl-model-empty">{t('settings.visibility.no_match')}</div>
          ) : filtered.map(m => (
            <label key={m.id} className={`pl-vis-row ${selected.has(m.id) ? "on" : ""}`}>
              <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
              <HealthDot health={m.health} statusDetail={m.health_status_detail} />
              <div className="pl-vis-row-body">
                <strong>{m.display}</strong>
                <span className="muted-2 mono">{m.real_name}</span>
              </div>
              <div className="pl-vis-row-meta">
                <div style={{display: "flex", gap: 3}}>
                  {(() => {
                    const caps = getCaps(m);
                    return (<>
                      {caps.slice(0, 2).map(c => (
                        <span key={c} className="pl-cap-tag">{t('settings.capabilities.' + c, { defaultValue: CAP_LABEL[c] || c })}</span>
                      ))}
                      {caps.length > 2 && <span className="muted-2" style={{fontSize: 11}}>+{caps.length - 2}</span>}
                    </>);
                  })()}
                </div>
                <span className="mono muted-2" style={{fontSize: 11}}>
                  {m.context_window != null ? fmtCtx(m.context_window) : (m.context || "—")}
                </span>
              </div>
            </label>
          ))}
        </div>
    </Modal>
  );
}

function ValidateModal({ open, api, onClose, onConfirm }) {
  const { t } = useTranslation();
  // task 50：之前 setTimeout 1400ms 后假装 "done"，newSniffed 是写死的
  // gpt-4.5-turbo / gpt-4o-realtime-preview（只在 api.id === "openai" 时显示）。
  // 整个嗅探过程 zero API call。现在改为：
  //   1. 真打 GET /api/models/diff?api_id=... 得到 added / removed / kept
  //   2. 「全部添加」走 POST /api/models/model 真的把每个 added 持久化
  //   3. 「删除 N 个」走原 onConfirm（沿用旧 path：调用方 ApiCardList 处理）
  const [phase, setPhase] = useStatePL("idle");
  const [diff, setDiff] = useStatePL(null);
  const [err, setErr] = useStatePL("");
  const [removeIds, setRemoveIds] = useStatePL(new Set());
  const [adding, setAdding] = useStatePL(false);
  React.useEffect(() => {
    if (!open || !api) return;
    setPhase("sniffing"); setErr(""); setDiff(null); setRemoveIds(new Set());
    (async () => {
      try {
        const r = await window.api.models.diff({ api_id: api.id });
        setDiff(r || {});
      } catch (e) {
        setErr(e?.message || "probe failed");
      } finally {
        setPhase("done");
      }
    })();
  }, [open, api?.id]);
  if (!open || !api) return null;
  // 后端 diff 返回 {local_only, remote_only, matching} 都是字符串数组（real_name）。
  // 统一映射为 {real_name, display} 对象数组，给 UI / addAll 用。
  const wrap = (arr) => (arr || []).map(s => typeof s === "string" ? { real_name: s, display: s } : s);
  const remoteOnly = wrap(diff && (diff.added || diff.remote_only));
  const localOnly = wrap(diff && (diff.removed || diff.local_only));
  const kept = wrap(diff && (diff.kept || diff.matching || diff.common));
  const unreachable = api.models.filter(m => m.health === "err");
  const toRemoveList = [...localOnly, ...unreachable.filter(u => !localOnly.some(r => r.real_name === u.real_name))];
  const toggleRemove = (id) => setRemoveIds(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const addAll = async () => {
    if (adding || remoteOnly.length === 0) return;
    setAdding(true);
    let ok = 0, fail = 0;
    for (const m of remoteOnly) {
      try {
        await window.api.models.upsertModel({
          api_id: api.id,
          real_name: m.real_name || m.id,
          display_name: m.display || m.name || m.real_name,
          enabled: true,
        });
        ok++;
      } catch (_) { fail++; }
    }
    setAdding(false);
    window.__apiToast?.(fail ? t('settings.validate.add_ok_fail', { ok, fail }) : t('settings.validate.add_ok', { ok }), { kind: ok ? "ok" : "danger", duration: 3000 });
    if (typeof window.__refreshPlatform === "function") { try { await window.__refreshPlatform(); } catch (_) {} }
    onClose();
  };
  return (
    <Modal
      open
      eyebrow={t('settings.validate.eyebrow', { name: api.name })}
      title={phase === "sniffing" ? t('settings.validate.sniffing') : t('settings.validate.done')}
      width={560}
      onClose={onClose}
      footer={<>
        <span className="muted-2" style={{fontSize: 11.5}}>
          <Icon name="info" size={11} /> GET /api/models/diff · POST /api/models/model
        </span>
        <div style={{display: "flex", gap: 8}}>
          <button className="btn ghost" onClick={onClose}>{phase === "done" ? t('common.close') : t('common.cancel')}</button>
          {phase === "done" && removeIds.size > 0 && (
            <button className="btn danger" onClick={() => onConfirm([...removeIds])}>
              <Icon name="trash" size={12} /> {t('settings.validate.delete_btn', { count: removeIds.size })}
            </button>
          )}
        </div>
      </>}
    >
        {phase === "sniffing" ? (
          <div className="pl-validate-progress">
            <div className="pl-validate-step done"><span className="dot ok" /> {t('settings.validate.step1')}</div>
            <div className="pl-validate-step running"><Icon name="spinner" size={12} className="spin" /> {t('settings.validate.step2')}</div>
          </div>
        ) : err ? (
          <div className="pl-model-empty" style={{padding: "24px 16px"}}>
            <Icon name="warn" size={18} style={{color: "var(--danger)"}} />
            <div>{t('settings.validate.fail_title', { err })}</div>
            <div className="muted" style={{marginTop: 8, fontSize: 12}}>{t('settings.validate.fail_hint')}</div>
          </div>
        ) : (
          <div className="pl-validate-result">
            <div className="pl-validate-stat-row">
              <div className="pl-validate-stat">
                <span className="pl-stat-label">{t('settings.validate.stat_existing')}</span>
                <span className="pl-stat-value" style={{fontSize: 20}}>{api.models.length}</span>
              </div>
              <div className="pl-validate-stat">
                <span className="pl-stat-label">{t('settings.validate.stat_remote')}</span>
                <span className="pl-stat-value" style={{fontSize: 20}}>{remoteOnly.length + kept.length}</span>
              </div>
              <div className="pl-validate-stat">
                <span className="pl-stat-label accent">{t('settings.validate.stat_new')}</span>
                <span className="pl-stat-value accent" style={{fontSize: 20}}>{remoteOnly.length}</span>
              </div>
              <div className="pl-validate-stat">
                <span className="pl-stat-label danger">{t('settings.validate.stat_local_extra')}</span>
                <span className="pl-stat-value danger" style={{fontSize: 20}}>{localOnly.length}</span>
              </div>
            </div>

            {remoteOnly.length > 0 && (
              <div className="pl-validate-section">
                <div className="pl-validate-section-head">
                  <span className="dot accent" /> {t('settings.validate.new_models', { count: remoteOnly.length })}
                  <button className="btn ghost" style={{height: 22, padding: "0 8px", fontSize: 11, marginLeft: "auto"}}
                    disabled={adding} onClick={addAll}>
                    {adding ? <><Icon name="spinner" size={11} className="spin" /> {t('settings.validate.adding')}</> : <><Icon name="plus" size={11} /> {t('settings.validate.add_all')}</>}
                  </button>
                </div>
                <ul className="pl-validate-list">
                  {remoteOnly.map(m => (
                    <li key={m.real_name || m.id} className="pl-validate-new">
                      <span className="dot accent" style={{flexShrink: 0}} />
                      <div style={{display: "grid", gap: 1, minWidth: 0}}>
                        <strong>{m.display || m.name || m.real_name}</strong>
                        <span className="muted-2 mono">{m.real_name || m.id}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {toRemoveList.length > 0 && (
              <div className="pl-validate-section">
                <div className="pl-validate-section-head">
                  <span className="dot danger" /> {t('settings.validate.local_extra', { count: toRemoveList.length })}
                  <span className="muted-2" style={{marginLeft: 6, fontSize: 11}}>{t('settings.validate.local_extra_hint')}</span>
                </div>
                <ul className="pl-validate-list">
                  {toRemoveList.map(m => (
                    <li key={m.id || m.real_name} className={removeIds.has(m.id || m.real_name) ? "marked" : ""}>
                      <input type="checkbox" checked={removeIds.has(m.id || m.real_name)} onChange={() => toggleRemove(m.id || m.real_name)} />
                      <HealthDot health={m.health} statusDetail={m.health_status_detail} />
                      <div style={{display: "grid", gap: 1, minWidth: 0, flex: 1}}>
                        <strong>{m.display || m.name || m.real_name}</strong>
                        <span className="muted-2 mono">{m.real_name || m.id}</span>
                      </div>
                      <span className="pill danger" style={{fontSize: 10.5}}>
                        {m.health === "err" ? t('settings.validate.unreachable') : t('settings.validate.remote_missing')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {remoteOnly.length === 0 && toRemoveList.length === 0 && (
              <div className="pl-model-empty" style={{padding: "24px 16px"}}>
                <Icon name="check" size={18} style={{color: "var(--ok)"}} />
                <div>{t('settings.validate.in_sync')}</div>
              </div>
            )}
          </div>
        )}
    </Modal>
  );
}

function ApiModelsList({ api, onToggleModel, onRenameModel }) {
  const { t } = useTranslation();
  const [q, setQ] = useStatePL("");
  const [capFilter, setCapFilter] = useStatePL(null);
  const [statusFilter, setStatusFilter] = useStatePL("all");
  const [showAll, setShowAll] = useStatePL(false);
  const [sortKey, setSortKey] = useStatePL("smart");
  const PAGE = 6;

  // Only models marked visible — visibility is controlled via the API card's
  // "编辑显示" modal, not per-row.
  const visibleModels = api.models.filter(m => m.visible !== false);

  // helpers to normalize capabilities (Wave 11.5-A: 复用 components/catalog-helpers.js,
  // 老 array / 新 typed object 两种 shape 都兼容)
  const getCaps = window.getCaps || _getCapsImported;

  const filtered = visibleModels.filter(m => {
    if (q) {
      const s = q.toLowerCase();
      if (!m.display.toLowerCase().includes(s) && !m.real_name.toLowerCase().includes(s)) return false;
    }
    if (capFilter && !getCaps(m).includes(capFilter)) return false;
    if (statusFilter === "enabled" && !m.enabled) return false;
    if (statusFilter === "disabled" && m.enabled) return false;
    if (statusFilter === "ok" && m.health !== "ok") return false;
    if (statusFilter === "err" && m.health !== "err") return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "smart") {
      if (a.enabled !== b.enabled) return b.enabled - a.enabled;
      return a.display.localeCompare(b.display, "zh-CN");
    }
    if (sortKey === "name") return a.display.localeCompare(b.display, "zh-CN");
    if (sortKey === "context") {
      // Wave 11-C: 优先用 context_window 数值,兼容旧 context 字符串
      const getCtx = (m) => m.context_window ?? parseInt(m.context) ?? 0;
      return getCtx(b) - getCtx(a);
    }
    if (sortKey === "health") {
      const order = { ok: 0, degraded: 1, untested: 2, err: 3 };
      return (order[a.health] ?? 4) - (order[b.health] ?? 4);
    }
    return 0;
  });

  const visible = showAll ? sorted : sorted.slice(0, PAGE);
  const hasMore = sorted.length > visible.length;
  const filtersActive = q || capFilter || statusFilter !== "all";
  const allCaps = [...new Set(visibleModels.flatMap(m => getCaps(m)))];
  const showSearch = visibleModels.length > 5;
  const hiddenCount = api.models.length - visibleModels.length;

  return (
    <>
      {showSearch && (
        <div className="pl-model-toolbar">
          <div className="pl-model-search">
            <Icon name="search" size={12} />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowAll(true); }}
              placeholder={t('settings.model_list.search_placeholder', { count: visibleModels.length })}
            />
            {q && <button className="iconbtn" onClick={() => setQ("")} style={{width: 18, height: 18}}>
              <Icon name="close" size={10} />
            </button>}
          </div>
          <div className="seg" style={{flexShrink: 0}}>
            <button className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>
              {t('settings.model_list.filter_all')} <span className="muted-2" style={{marginLeft: 4, fontSize: 10.5}}>{visibleModels.length}</span>
            </button>
            <button className={statusFilter === "enabled" ? "active" : ""} onClick={() => setStatusFilter("enabled")}>
              {t('settings.model_list.filter_enabled')} <span className="muted-2" style={{marginLeft: 4, fontSize: 10.5}}>{visibleModels.filter(m => m.enabled).length}</span>
            </button>
            <button className={statusFilter === "err" ? "active" : ""} onClick={() => setStatusFilter("err")}>
              {t('settings.model_list.filter_err')} <span className="muted-2" style={{marginLeft: 4, fontSize: 10.5}}>{visibleModels.filter(m => m.health === "err").length}</span>
            </button>
          </div>
          <select
            value={sortKey} onChange={(e) => setSortKey(e.target.value)}
            style={{height: 26, fontSize: 11.5, padding: "0 8px", width: "auto", flexShrink: 0}}
          >
            <option value="smart">{t('settings.model_list.sort_smart')}</option>
            <option value="name">{t('settings.model_list.sort_name')}</option>
            <option value="context">{t('settings.model_list.sort_context')}</option>
            <option value="health">{t('settings.model_list.sort_health')}</option>
          </select>
        </div>
      )}
      {showSearch && allCaps.length > 0 && (
        <div className="pl-model-caps-row">
          <span className="muted-2" style={{fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.14em", marginRight: 4}}>{t('settings.model_list.caps_label')}</span>
          {allCaps.map(c => (
            <button
              key={c}
              className={`pl-cap-tag clickable ${capFilter === c ? "active" : ""}`}
              onClick={() => setCapFilter(capFilter === c ? null : c)}
              data-tip={t('settings.more.model_list.cap_filter_tip', { cap: t('settings.capabilities.' + c, { defaultValue: CAP_LABEL[c] || c }) })}
            >
              {t('settings.capabilities.' + c, { defaultValue: CAP_LABEL[c] || c })}
            </button>
          ))}
          {capFilter && (
            <button className="pl-cap-tag clickable clear" onClick={() => setCapFilter(null)}>
              <Icon name="close" size={9} /> {t('settings.model_list.clear_filter')}
            </button>
          )}
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="pl-model-empty">
          <Icon name="search" size={16} style={{color: "var(--muted-2)"}} />
          <div>{t('settings.model_list.no_match', { count: visibleModels.length })}</div>
          {filtersActive && <button className="btn ghost" onClick={() => { setQ(""); setCapFilter(null); setStatusFilter("all"); }}>{t('settings.model_list.clear_filter')}</button>}
        </div>
      ) : (
        <CSTable
          variant="embedded"
          trackBy="id"
          items={visible}
          columnDefinitions={[
            {
              id: "health",
              header: "",
              width: 32,
              // A4: 传 statusDetail；无字段时 undefined → 向后兼容
              cell: (m) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <HealthDot health={m.health} statusDetail={m.health_status_detail} />
                  <StatusDetailBadge statusDetail={m.health_status_detail} />
                </span>
              ),
            },
            {
              id: "name",
              header: t('settings.model_list.col_name'),
              cell: (m) => <ModelNameCell m={m} onRename={(v) => onRenameModel?.(m.id, v)} deprecated={!!m.deprecated_at} />,
            },
            {
              id: "caps",
              header: t('settings.model_list.col_caps'),
              cell: (m) => (
                <div style={{display: "flex", gap: 4, flexWrap: "wrap"}}>
                  {getCaps(m).map(c => (
                    <span key={c} className="pl-cap-tag" data-tip={t('settings.capabilities.' + c, { defaultValue: CAP_LABEL[c] || c })}>{t('settings.capabilities.' + c, { defaultValue: CAP_LABEL[c] || c })}</span>
                  ))}
                </div>
              ),
            },
            {
              id: "price",
              header: t('settings.model_list.col_price'),
              cell: (m) => (
                <span className="mono muted">
                  {/* Wave 11-C: 优先展示 typed ModelInfo pricing(per million),兼容旧 price 字符串 */}
                  {m.input_cost_per_million != null
                    ? <span data-tip={t('settings.more.model_list.price_tip', { input: m.input_cost_per_million, output: m.output_cost_per_million ?? '?' })}>
                        {fmtPrice(m.input_cost_per_million)} / {fmtPrice(m.output_cost_per_million)}
                      </span>
                    : (m.price || "—")}
                </span>
              ),
            },
            {
              id: "context",
              header: t('settings.model_list.col_context'),
              cell: (m) => (
                <span className="mono muted">
                  {/* Wave 11-C: 优先展示 typed context_window,兼容旧 context 字符串 */}
                  {m.context_window != null ? fmtCtx(m.context_window) : (m.context || "—")}
                  {m.max_output_tokens != null && (
                    <div className="muted-2" style={{fontSize: 10}} data-tip={t('settings.more.model_list.max_output_tip', { n: fmtCtx(m.max_output_tokens) })}>
                      ↑{fmtCtx(m.max_output_tokens)}
                    </div>
                  )}
                </span>
              ),
            },
            {
              id: "source",
              header: t('settings.model_list.col_source'),
              width: 70,
              cell: (m) => {
                const isDeprecated = !!m.deprecated_at;
                return (
                  <span style={{fontSize: 11}} className="muted-2">
                    {/* Wave 11-C: catalog 数据来源 */}
                    {m.source ? (
                      <span className="pl-cap-tag" data-tip={`${t('settings.more.source_label_tip')}: ${sourceLabel(m.source, t)}`} style={{fontSize: 10}}>
                        {sourceLabel(m.source, t)}
                      </span>
                    ) : "—"}
                    {isDeprecated && (
                      <span className="pl-cap-tag" data-tip={`deprecated: ${m.deprecated_at}`} style={{marginLeft: 2, color: "var(--warn)", fontSize: 10, borderColor: "var(--warn)"}}>
                        {t('settings.model_list.deprecated')}
                      </span>
                    )}
                  </span>
                );
              },
            },
            {
              id: "toggle",
              header: "",
              width: 48,
              cell: (m) => <SettingsToggle on={m.enabled} set={() => onToggleModel(m.id)} />,
            },
          ]}
        />
      )}
      {hasMore && (
        <button className="pl-model-more" onClick={() => setShowAll(true)}>
          <Icon name="chevron_down" size={12} />
          {t('settings.model_list.expand_all', { count: sorted.length, shown: visible.length })}
        </button>
      )}
      {showAll && filtered.length > PAGE && (
        <button className="pl-model-more" onClick={() => setShowAll(false)}>
          <Icon name="chevron_up" size={12} /> {t('settings.model_list.collapse')}
        </button>
      )}
      {hiddenCount > 0 && (
        <div className="pl-model-hidden-note muted-2">
          {t('settings.model_list.hidden_note', { count: hiddenCount })}
        </div>
      )}
    </>
  );
}

function ModelNameCell({ m, onRename, deprecated }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useStatePL(false);
  const [val, setVal] = useStatePL(m.display);
  React.useEffect(() => { setVal(m.display); }, [m.display]);
  const apply = () => {
    const v = val.trim();
    if (v && v !== m.display) onRename?.(v);
    setEditing(false);
  };
  const cancel = () => { setVal(m.display); setEditing(false); };
  if (editing) {
    return (
      <div className="pl-title-cell pl-model-edit">
        <div className="pl-model-edit-row">
          <input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); apply(); }
              else if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
            style={{fontSize: 13, padding: "4px 8px", fontFamily: "var(--font-serif)"}}
          />
          <button className="iconbtn pl-edit-confirm" onClick={apply}>
            <Icon name="check" size={12} />
          </button>
          <button className="iconbtn pl-edit-cancel" onClick={cancel}>
            <Icon name="close" size={12} />
          </button>
        </div>
        <span className="muted-2 mono">{m.real_name}</span>
      </div>
    );
  }
  return (
    <div className="pl-title-cell">
      <strong
        style={{fontSize: 13.5, cursor: "text", textDecoration: deprecated ? "line-through" : "none", opacity: deprecated ? 0.7 : 1}}
        onDoubleClick={() => setEditing(true)}
        data-tip={deprecated ? `deprecated · ${m.deprecated_at || ""}` : t('settings.model_list.tip_double_click')}
      >
        {m.display}
        {deprecated && <span style={{marginLeft: 4, fontSize: 11, color: "var(--warn)"}}><Icon name="warn" size={10} /></span>}
      </strong>
      <span className="muted-2 mono">{m.real_name}</span>
    </div>
  );
}

// A4: status_detail 徽标 — 如后端返回 key_expired / forbidden，展示对应橙/红徽标
function StatusDetailBadge({ statusDetail }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useStatePL(false);
  if (!statusDetail) return null;
  if (statusDetail === 'key_expired') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span
          className="pl-cap-tag"
          style={{ background: 'rgba(200,100,0,0.15)', color: 'var(--warn,#d4823c)', borderColor: 'var(--warn,#d4823c)', cursor: 'pointer', fontSize: 10.5 }}
          onClick={() => setExpanded(e => !e)}
        >
          {t('settings.model_list.key_expired')}
        </span>
        {expanded && (
          <span style={{ fontSize: 11, color: 'var(--warn,#d4823c)', background: 'rgba(200,100,0,0.10)', padding: '2px 6px', borderRadius: 4 }}>
            {t('settings.model_list.key_expired_detail')}
          </span>
        )}
      </span>
    );
  }
  if (statusDetail === 'forbidden') {
    return (
      <span
        className="pl-cap-tag"
        style={{ background: 'rgba(200,40,40,0.12)', color: 'var(--danger,#d44)', borderColor: 'var(--danger,#d44)', fontSize: 10.5 }}
      >
        {t('settings.model_list.no_permission')}
      </span>
    );
  }
  return null;
}

function HealthDot({ health, statusDetail }) {
  const { t } = useTranslation();
  const map = {
    ok:       { color: "ok",      label: t('settings.model_list.health_ok') },
    degraded: { color: "warn",    label: t('settings.model_list.health_degraded') },
    err:      { color: "danger",  label: t('settings.model_list.health_err') },
    untested: { color: "muted-2", label: t('settings.model_list.health_untested') },
  };
  // A4: status_detail 优先覆盖 label
  const detail = statusDetail; // 向后兼容：没有字段则 undefined
  const labelSuffix = detail === 'key_expired' ? ` · ${t('settings.model_list.key_expired')}`
    : detail === 'forbidden' ? ` · ${t('settings.model_list.no_permission')}`
    : '';
  const v = map[health] || map.untested;
  return (
    <span className="pl-health" data-tip={v.label + labelSuffix}>
      <span className={`dot ${v.color}`} />
    </span>
  );
}
/** @param {import("../types/rust/catalog/CatalogSource").CatalogSource} source */
function sourceLabel(source, _t) {
  const MAP = {
    LiveApi:        "Live API",
    StaticCatalog:  "Static",
    UserOverride:   _t ? _t('settings.more.source_user_override') : "User Override",
    OpenRouterProxy:"OpenRouter Proxy",
  };
  return MAP[source] || source || "—";
}

/** @param {number|null|undefined} n context_window 格式化 */
// K/M 缩写统一到 window.__fmt.compact(data-loader.js;语义统一 #30),保留本地别名免改调用点。
function fmtCtx(n) {
  if (window.__fmt && window.__fmt.compact) return window.__fmt.compact(n);
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/** @param {number|null|undefined} v 每百万 token 价格 → 格式化 */
function fmtPrice(v) {
  if (v === null || v === undefined) return null;
  return `$${v.toFixed(3)}`;
}

const MODELS_DATA = [
  {
    id: "openai", name: "OpenAI", base_url: "https://api.openai.com/v1",
    enabled: true, status: "online", key_set: true, key_hint: "·sk-…3a9f", proxy: "直连",
    models: [
      { id: "gpt-5.5", real_name: "gpt-5.5", display: "GPT-5.5 · 标准", capabilities: ["text", "vision", "tool-use", "rpg"], enabled: true, price: "$2.50 / $10.00", context: "400K", health: "ok", visible: true },
      { id: "gpt-5.5-instant", real_name: "gpt-5.5-instant", display: "GPT-5.5 Instant · 低延迟", capabilities: ["fast", "vision"], enabled: true, price: "$1.25 / $5.00", context: "400K", health: "ok", visible: true },
      { id: "gpt-5.5-pro", real_name: "gpt-5.5-pro", display: "GPT-5.5 Pro", capabilities: ["text", "vision", "tool-use"], enabled: false, price: "$5.00 / $20.00", context: "400K", health: "ok", visible: true },
      { id: "gpt-5", real_name: "gpt-5", display: "GPT-5 · 上一代", capabilities: ["text", "vision"], enabled: false, price: "$2.00 / $8.00", context: "400K", health: "ok", visible: true },
    ]
  },
  {
    id: "anthropic", name: "Anthropic", base_url: "https://api.anthropic.com/v1",
    enabled: true, status: "online", key_set: true, key_hint: "·sk-***", proxy: "直连",
    models: [
      { id: "claude-opus-4-7", real_name: "claude-opus-4-7", display: "Claude Opus 4.7 · 长文", capabilities: ["long", "tool-use", "rpg"], enabled: true, price: "$15 / $75", context: "200K", health: "ok", visible: true },
      { id: "claude-sonnet-4-6", real_name: "claude-sonnet-4-6", display: "Claude Sonnet 4.6", capabilities: ["text", "fast"], enabled: true, price: "$3 / $15", context: "200K", health: "ok", visible: true },
      { id: "claude-haiku-4-5", real_name: "claude-haiku-4-5", display: "Claude Haiku 4.5", capabilities: ["fast"], enabled: false, price: "$1.00 / $5", context: "200K", health: "ok", visible: true },
    ]
  },
  {
    id: "google", name: "Google", base_url: "https://generativelanguage.googleapis.com/v1beta",
    enabled: false, status: "未连接", key_set: false, proxy: "需配置 API key",
    models: [
      { id: "gemini-3.5-flash", real_name: "gemini-3.5-flash", display: "Gemini 3.5 Flash · 当前默认", capabilities: ["fast", "vision", "tool-use"], enabled: false, price: "$1.50 / $9.00", context: "1M", health: "ok", visible: true },
      { id: "gemini-3.1-pro", real_name: "gemini-3.1-pro", display: "Gemini 3.1 Pro", capabilities: ["long", "vision", "tool-use"], enabled: false, price: "$2.00 / $12.00", context: "1M", health: "ok", visible: true },
    ]
  },
  {
    id: "qwen", name: "通义千问", base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    enabled: true, status: "online", key_set: true, key_hint: "·sk-…c024", proxy: "直连",
    models: [
      { id: "qwen3.7-max", real_name: "qwen3.7-max", display: "Qwen 3.7-Max · 旗舰", capabilities: ["cn", "rpg", "text", "reasoning"], enabled: true, price: "$2.50 / $7.50", context: "1M", health: "ok", visible: true },
      { id: "qwen3.6-flash", real_name: "qwen3.6-flash", display: "Qwen 3.6 Flash", capabilities: ["cn", "fast"], enabled: true, price: "$0.19 / $1.13", context: "131K", health: "ok", visible: true },
      { id: "qwen-turbo", real_name: "qwen-turbo", display: "Qwen Turbo", capabilities: ["cn", "fast"], enabled: false, price: "¥0.04 / ¥0.08", context: "1M", health: "ok", visible: true },
    ]
  },
  {
    id: "deepseek", name: "DeepSeek", base_url: "https://api.deepseek.com/v1",
    enabled: true, status: "online", key_set: true, key_hint: "·sk-…a8d2", proxy: "直连",
    models: [
      { id: "deepseek-v4-pro", real_name: "deepseek-ai/DeepSeek-V4-Pro", display: "DeepSeek V4-Pro · 旗舰", capabilities: ["reasoning", "cn", "tool-use"], enabled: true, price: "$1.74 / $3.48", context: "1M", health: "ok", visible: true },
      { id: "deepseek-v4-flash", real_name: "deepseek-ai/DeepSeek-V4-Flash", display: "DeepSeek V4-Flash · 快速", capabilities: ["cn", "fast"], enabled: true, price: "$0.30 / $1.20", context: "1M", health: "ok", visible: true },
    ]
  },
  {
    id: "openrouter", name: "OpenRouter", base_url: "https://openrouter.ai/api/v1",
    enabled: true, status: "online", key_set: true, key_hint: "·sk-or-…f72e", proxy: "直连",
    models: ((() => {
      const data = [
        ["openai/gpt-4o", "GPT-4o", ["text", "vision", "tool-use"], "$2.50 / $10.00", "128K", true],
        ["openai/gpt-4o-mini", "GPT-4o mini", ["fast", "vision"], "$0.15 / $0.60", "128K", true],
        ["openai/o3-mini", "o3-mini", ["reasoning"], "$1.10 / $4.40", "200K", false],
        ["openai/o1", "o1", ["reasoning"], "$15 / $60", "200K", false],
        ["anthropic/claude-opus-4-7", "Claude Opus 4.7", ["long", "tool-use"], "$15.75 / $78.75", "200K", true],
        ["anthropic/claude-sonnet-4-6", "Claude Sonnet 4.6", ["text", "fast"], "$3.15 / $15.75", "200K", false],
        ["anthropic/claude-haiku-4-5", "Claude Haiku 4.5", ["fast"], "$1.05 / $5.25", "200K", false],
        ["google/gemini-pro-1.5", "Gemini Pro 1.5", ["long", "vision"], "$1.25 / $5", "2M", false],
        ["google/gemini-flash-1.5", "Gemini Flash 1.5", ["fast", "vision"], "$0.075 / $0.30", "1M", false],
        ["google/gemini-2.0-flash-exp", "Gemini 2.0 Flash", ["fast", "vision"], "free", "1M", false],
        ["meta-llama/llama-3.1-405b", "Llama 3.1 405B", ["text"], "$2.70 / $2.70", "131K", false],
        ["meta-llama/llama-3.1-70b", "Llama 3.1 70B", ["text"], "$0.40 / $0.40", "131K", false],
        ["meta-llama/llama-3.3-70b", "Llama 3.3 70B", ["text"], "$0.13 / $0.40", "131K", false],
        ["mistralai/mistral-large", "Mistral Large", ["text", "tool-use"], "$2 / $6", "128K", false],
        ["mistralai/mistral-nemo", "Mistral Nemo", ["fast"], "$0.13 / $0.13", "128K", false],
        ["mistralai/codestral", "Codestral", ["text"], "$0.30 / $0.90", "32K", false],
        ["deepseek/deepseek-r1", "DeepSeek R1", ["reasoning", "cn"], "¥4 / ¥16", "64K", false],
        ["deepseek/deepseek-chat", "DeepSeek Chat", ["cn", "fast"], "¥1 / ¥2", "64K", false],
        ["qwen/qwen-2.5-72b", "Qwen 2.5 72B", ["cn", "long"], "$0.35 / $0.40", "131K", false],
        ["qwen/qwen-2.5-coder-32b", "Qwen 2.5 Coder 32B", ["text"], "$0.18 / $0.18", "33K", false],
        ["x-ai/grok-2", "Grok 2", ["text"], "$2 / $10", "128K", false],
        ["x-ai/grok-2-vision", "Grok 2 Vision", ["vision"], "$2 / $10", "8K", false],
        ["nousresearch/hermes-3-llama-3.1-70b", "Hermes 3 70B", ["rpg"], "$0.40 / $0.40", "131K", true],
        ["nousresearch/hermes-3-llama-3.1-405b", "Hermes 3 405B", ["rpg"], "$1.79 / $2.49", "131K", false],
        ["cohere/command-r-plus", "Command R+", ["tool-use"], "$2.50 / $10", "128K", false],
        ["cohere/command-r", "Command R", ["fast"], "$0.15 / $0.60", "128K", false],
        ["perplexity/llama-3.1-sonar-large", "Sonar Large", ["text"], "$1 / $1", "127K", false],
        ["microsoft/phi-3.5-mini", "Phi-3.5 mini", ["fast"], "$0.10 / $0.10", "128K", false],
        ["amazon/nova-pro", "Amazon Nova Pro", ["vision"], "$0.80 / $3.20", "300K", false],
        ["amazon/nova-lite", "Amazon Nova Lite", ["fast", "vision"], "$0.06 / $0.24", "300K", false],
        ["01-ai/yi-large", "Yi Large", ["cn"], "$3 / $3", "32K", false],
        ["zhipu/glm-4-plus", "GLM-4 Plus", ["cn"], "¥0.05 / ¥0.05", "128K", false],
        ["moonshot/kimi-k1.5", "Kimi K1.5", ["cn", "long", "reasoning"], "¥0.30 / ¥3", "200K", false],
        ["minimax/abab-7-preview", "MiniMax abab-7", ["cn"], "¥10 / ¥10", "245K", false],
        ["aetherwiing/mn-starcannon-12b", "Starcannon 12B", ["rpg"], "$0.80 / $1.20", "8K", false],
        ["sao10k/l3-euryale-70b", "Euryale 70B", ["rpg"], "$1.48 / $1.48", "16K", false],
      ];
      const _h = ["ok","ok","ok","ok","degraded","err","ok","ok","untested","ok","ok","ok","ok","err","ok","ok","ok","ok","ok","degraded","ok","ok","ok","ok","ok","ok","err","ok","untested","ok","ok","ok","ok","ok","ok","ok"];
      return data.map(([rn, disp, caps, price, ctx, en], i) => ({
        id: rn, real_name: rn, display: disp, capabilities: caps, price, context: ctx, enabled: en,
        health: _h[i % _h.length], visible: true,
      }));
    })()),
  },
  {
    id: "local", name: "本地 vLLM", base_url: "http://127.0.0.1:8000/v1",
    enabled: false, status: "未启动", key_set: false, proxy: "局域网",
    models: [
      { id: "qwen-72b", real_name: "Qwen2.5-72B-Instruct", display: "Qwen2.5-72B · 本地", capabilities: ["cn", "long"], enabled: false, price: "本地", context: "128K", health: "ok", visible: true },
    ]
  },
];

// Wave 11-C: 10 provider typed 配置表
// /** @type {Array<{id: import("../types/rust/catalog/ProviderId").ProviderId, name: string, kind: "openai_compat"|"native", defaultBase: string, keyEnv: string, note?: string, special?: "agent_platform"|"alibaba_qwen"|"openrouter"}>} */
const PROVIDERS_CONFIG = [
  {
    id: "openai",       name: "OpenAI",         kind: "openai_compat",
    defaultBase: "https://api.openai.com/v1",
    keyEnv: "OPENAI_API_KEY",
  },
  {
    id: "openrouter",   name: "OpenRouter",     kind: "openai_compat",
    defaultBase: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY",
    special: "openrouter",
    noteKey: "settings.more.providers.note_openrouter",
  },
  {
    id: "deepseek",     name: "DeepSeek",       kind: "openai_compat",
    defaultBase: "https://api.deepseek.com/v1",
    keyEnv: "DEEPSEEK_API_KEY",
  },
  {
    id: "xai",          name: "xAI (Grok)",     kind: "openai_compat",
    defaultBase: "https://api.x.ai/v1",
    keyEnv: "XAI_API_KEY",
  },
  {
    id: "xiaomi_mimo",   name: "MiMo (Xiaomi)",  kind: "openai_compat",
    defaultBase: "https://chat.d.xiaomi.net/ai/api/v1",
    keyEnv: "XIAOMI_MIMO_API_KEY",
  },
  {
    id: "hunyuan", name: "Hunyuan (Tencent)", kind: "openai_compat",
    defaultBase: "https://api.hunyuan.cloud.tencent.com/v1",
    keyEnv: "TENCENT_HUNYUAN_API_KEY",
  },
  {
    id: "anthropic",    name: "Anthropic",      kind: "native",
    defaultBase: "https://api.anthropic.com",
    keyEnv: "ANTHROPIC_API_KEY",
  },
  {
    id: "google_ai_studio", name: "Google AI Studio", kind: "native",
    // Gemini 的 OpenAI 兼容端点在 /v1beta/openai;少了这段路径会 404「找不到」。
    defaultBase: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GOOGLE_API_KEY",
    // 下架:Google 从 2026-07-04 起封禁本服务器机房 IP(User location is not supported),
    // AI Studio 连不通。从默认候选(添加下拉 + provider 卡片)移除;仅存量已配置用户仍见其卡片
    // (带下架提示,引导改用 Agent Platform)。Gemini 统一走 Vertex。
    hidden_in_edit_modal: true,
    deprecated: true,
  },
  {
    id: "AgentPlatform", name: "Agent Platform (Service Account)", kind: "native",
    defaultBase: "",
    keyEnv: "",
    special: "agent_platform",
    // 用户级 SA 已真接通 (vertex.py / embedding.py / model_probe 全部走用户 SA)
    // EditApiModal 检测 special === 'agent_platform' 时自动隐藏 base_url + api_key 改 SA JSON textarea
    noteKey: "settings.more.providers.note_agent_platform",
  },
  {
    id: "dashscope",  name: "DashScope (Qwen)", kind: "openai_compat",
    defaultBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    keyEnv: "DASHSCOPE_API_KEY",
    special: "alibaba_qwen",
    noteKey: "settings.more.providers.note_dashscope",
  },
];

/**
 * Wave 11-C: 10 provider 配置卡片
 * 每家 provider 独立一卡:API Key 输入 + base_url 可改(中转站)
 * Agent Platform:JSON 文件上传, 解析验证字段后 POST credentials.set
 * 阿里 DashScope:mode toggle (OpenAI-compat vs native)
 */
function ProviderConfigSection() {
  const { t } = useTranslation();
  const isAdminUser = !!(window.RPG_AUTH && window.RPG_AUTH.authed && window.MOCK_PLATFORM?.user?.role === "admin");
  const [creds, setCreds] = useStatePL({});
  const [saving, setSaving] = useStatePL({});
  const [agentPlatformJson, setAgentPlatformJson] = useStatePL(null);
  const [agentPlatformError, setAgentPlatformError] = useStatePL("");
  const [alibabaMode, setAlibabaMode] = useStatePL("openai_compat");

  useEffectPL(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await window.api.credentials.list().catch(() => ({ items: [] }));
        if (cancelled) return;
        const map = {};
        for (const c of (r?.items || r?.credentials || [])) {
          const pid = normalizeApiId(c.api_id || c.id);
          map[pid] = { has_key: !!c.has_credential || !!c.has_key, key_hint: c.key_hint || "", base_url: c.base_url_override || "" };
        }
        setCreds(map);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const saveKey = async (providerId, apiKey, baseUrl) => {
    setSaving(s => ({ ...s, [providerId]: true }));
    try {
      if (apiKey && apiKey.trim()) {
        await window.api.credentials.set({ api_id: providerId, api_key: apiKey.trim() });
      }
      if (baseUrl !== undefined) {
        if (isAdminUser) {
          const cfg = PROVIDERS_CONFIG.find((p) => p.id === providerId);
          const kind = providerId === "AgentPlatform" ? "vertex_ai" : providerId === "anthropic" ? "anthropic" : "openai_compat";
          await window.api.models.upsertApi({ api_id: catalogApiIdForCredential(providerId), base_url: baseUrl, kind, display_name: cfg?.name || providerId });
        } else {
          window.__apiToast?.(t('settings_extra.admin_base_url_only'), { kind: "warn", duration: 3000 });
        }
      }
      window.__apiToast?.(t('settings.providers.save_ok'), { kind: "ok", duration: 1800 });
      setCreds(s => ({ ...s, [providerId]: { ...s[providerId], has_key: !!(apiKey?.trim() || s[providerId]?.has_key), base_url: baseUrl ?? s[providerId]?.base_url } }));
    } catch (e) {
      window.__apiToast?.(t('settings.providers.save_fail'), { kind: "danger", detail: e?.message });
    } finally {
      setSaving(s => ({ ...s, [providerId]: false }));
    }
  };

  const handleAgentPlatformFile = async (file) => {
    setAgentPlatformError("");
    setAgentPlatformJson(null);
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const missing = ["client_email", "private_key", "project_id"].filter(k => !json[k]);
      if (missing.length > 0) {
        setAgentPlatformError(`JSON missing required fields: ${missing.join(", ")}`);
        return;
      }
      setAgentPlatformJson(json);
    } catch (e) {
      setAgentPlatformError("JSON parse error: " + (e?.message || "unknown"));
    }
  };

  const saveAgentPlatform = async () => {
    if (!agentPlatformJson) return;
    setSaving(s => ({ ...s, AgentPlatform: true }));
    try {
      await window.api.credentials.set({
        api_id: "AgentPlatform",
        api_key: JSON.stringify(agentPlatformJson),
      });
      window.__apiToast?.(t('settings.providers.save_cred_ok'), { kind: "ok", duration: 2000 });
      setCreds(s => ({ ...s, AgentPlatform: { ...s.AgentPlatform, has_key: true } }));
      setAgentPlatformJson(null);
    } catch (e) {
      window.__apiToast?.(t('settings.providers.save_fail'), { kind: "danger", detail: e?.message });
    } finally {
      setSaving(s => ({ ...s, AgentPlatform: false }));
    }
  };

  return (
    <SetGroup
      title={t('settings.providers.title')}
      description={t('settings.providers.description')}
      data-cap-anchor="settings.providers"
    >
      <CSSpaceBetween size="m">
        {PROVIDERS_CONFIG.filter(p => !p.deprecated || creds[p.id]?.has_key).map(p => {
          const cred = creds[p.id] || {};
          const isSaving = !!saving[p.id];
          return (
            <ProviderCard
              key={p.id}
              provider={p}
              cred={cred}
              isSaving={isSaving}
              agentPlatformJson={agentPlatformJson}
              agentPlatformError={agentPlatformError}
              alibabaMode={alibabaMode}
              onSaveKey={saveKey}
              onAgentPlatformFile={handleAgentPlatformFile}
              onSaveAgentPlatform={saveAgentPlatform}
              onAlibabaMode={(v) => { setAlibabaMode(v); window.api.models.upsertApi({ api_id: "dashscope", kind: "openai_compat", base_url: v === "openai_compat" ? "https://dashscope.aliyuncs.com/compatible-mode/v1" : "https://dashscope.aliyuncs.com/api/v1" }).catch(() => {}); }}
            />
          );
        })}
      </CSSpaceBetween>
    </SetGroup>
  );
}

function ProviderCard({ provider: p, cred, isSaving, agentPlatformJson, agentPlatformError, alibabaMode, onSaveKey, onAgentPlatformFile, onSaveAgentPlatform, onAlibabaMode }) {
  const { t } = useTranslation();
  const [keyVal, setKeyVal] = useStatePL("");
  const [baseVal, setBaseVal] = useStatePL(cred.base_url || p.defaultBase || "");
  useEffectPL(() => { setBaseVal(cred.base_url || p.defaultBase || ""); }, [cred.base_url, p.defaultBase]);

  // Agent Platform 走专用 UI
  if (p.special === "agent_platform") {
    return (
      <CSContainer>
        <CSSpaceBetween size="s">
          {p.unavailable && (
            <CSAlert type="warning" header={t('settings.providers.sa.unavailable_title')}>
              {t('settings.providers.sa.unavailable_desc')}
            </CSAlert>
          )}
          <CSSpaceBetween direction="horizontal" size="xs" alignItems="center">
            <div>
              <CSBox fontWeight="bold">{p.name}</CSBox>
              <CSBox color="text-body-secondary" fontSize="body-s">{p.noteKey ? t(p.noteKey) : p.note}</CSBox>
            </div>
            {cred.has_key && <CSStatusIndicator type="success">{t('settings.providers.configured')}</CSStatusIndicator>}
          </CSSpaceBetween>
          <CSSpaceBetween direction="horizontal" size="xs" alignItems="center">
            <label className="btn ghost" style={{cursor: "pointer", position: "relative"}}>
              <Icon name="upload" size={12} /> {t('settings.providers.select_json')}
              <input
                type="file"
                accept="application/json,.json"
                style={{position: "absolute", opacity: 0, width: 0, height: 0}}
                onChange={(e) => onAgentPlatformFile(e.target.files?.[0] || null)}
              />
            </label>
            {agentPlatformJson && (
              <CSBox color="text-status-success" fontSize="body-s">
                <Icon name="check" size={11} /> {agentPlatformJson.client_email}
              </CSBox>
            )}
          </CSSpaceBetween>
          {agentPlatformError && (
            <CSAlert type="error">{agentPlatformError}</CSAlert>
          )}
          {agentPlatformJson && !agentPlatformError && (
            <CSSpaceBetween direction="horizontal" size="xs" alignItems="center">
              <CSBox color="text-body-secondary" fontSize="body-s">
                project_id: <span className="mono">{agentPlatformJson.project_id}</span>
              </CSBox>
              <CSButton variant="primary" loading={isSaving} disabled={isSaving} onClick={onSaveAgentPlatform}>
                {t('settings.providers.save_cred')}
              </CSButton>
            </CSSpaceBetween>
          )}
        </CSSpaceBetween>
      </CSContainer>
    );
  }

  // 阿里 DashScope 带 mode toggle
  if (p.special === "alibaba_qwen") {
    return (
      <CSContainer>
        <CSSpaceBetween size="s">
          <CSSpaceBetween direction="horizontal" size="xs" alignItems="center">
            <div>
              <CSBox fontWeight="bold">{p.name}</CSBox>
              <CSBox color="text-body-secondary" fontSize="body-s">{p.noteKey ? t(p.noteKey) : p.note}</CSBox>
            </div>
            {cred.has_key && <CSStatusIndicator type="success">{t('settings.providers.configured')}</CSStatusIndicator>}
          </CSSpaceBetween>
          <CSSpaceBetween direction="horizontal" size="xs" alignItems="center">
            <div className="seg" style={{display: "flex"}}>
              <button className={alibabaMode === "openai_compat" ? "active" : ""} onClick={() => onAlibabaMode("openai_compat")}>OpenAI-compat</button>
              <button className={alibabaMode === "native" ? "active" : ""} onClick={() => onAlibabaMode("native")}>Native DashScope</button>
            </div>
            <CSBox color="text-status-inactive" fontSize="body-s">
              <span className="mono">{alibabaMode === "openai_compat" ? "/compatible-mode/v1" : "/api/v1"}</span>
            </CSBox>
          </CSSpaceBetween>
          <CSSpaceBetween direction="horizontal" size="xs" alignItems="flex-end">
            <CSFormField label={t('settings.edit_api.api_key')} stretch>
              <CSInput
                type="password"
                value={keyVal}
                onChange={({ detail }) => setKeyVal(detail.value)}
                placeholder={cred.has_key ? t('settings.providers.keep_key') : "sk-…"}
                autoComplete="new-password"
              />
            </CSFormField>
            <CSButton
              variant="primary"
              loading={isSaving}
              disabled={isSaving || (!keyVal.trim() && !baseVal)}
              onClick={() => onSaveKey(p.id, keyVal, baseVal)}
            >
              {t('common.save')}
            </CSButton>
          </CSSpaceBetween>
        </CSSpaceBetween>
      </CSContainer>
    );
  }

  // OpenRouter 带 base_url hint（及其它普通 provider）
  return (
    <CSContainer>
      <CSSpaceBetween size="s">
        {p.deprecated && (
          <CSAlert key="deprecated" type="warning" header={t('settings.providers.deprecated_geo_title')}>
            {t('settings.providers.deprecated_geo_desc')}
          </CSAlert>
        )}
        <CSSpaceBetween key="hdr" direction="horizontal" size="xs" alignItems="center">
          <div>
            <CSBox fontWeight="bold">{p.name}</CSBox>
            {(p.note || p.noteKey) && <CSBox color="text-body-secondary" fontSize="body-s">{p.noteKey ? t(p.noteKey) : p.note}</CSBox>}
          </div>
          {cred.has_key && <CSStatusIndicator type="success">{t('settings.providers.configured')}</CSStatusIndicator>}
        </CSSpaceBetween>
        <CSSpaceBetween key="form" direction="horizontal" size="xs" alignItems="flex-end">
          <CSFormField label={t('settings.edit_api.api_key')} stretch>
            <CSInput
              type="password"
              value={keyVal}
              onChange={({ detail }) => setKeyVal(detail.value)}
              placeholder={cred.has_key ? t('settings.providers.keep_key') : (p.keyEnv ? p.keyEnv : "sk-…")}
              autoComplete="new-password"
            />
          </CSFormField>
          <CSFormField
            label={p.special === "openrouter" ? t('settings.providers.base_url_relay') : t('settings.providers.base_url')}
            stretch
          >
            <CSInput
              value={baseVal}
              onChange={({ detail }) => setBaseVal(detail.value)}
              placeholder={p.defaultBase || "https://…"}
            />
          </CSFormField>
          <CSButton
            variant="primary"
            loading={isSaving}
            disabled={isSaving || (!keyVal.trim() && baseVal === (cred.base_url || p.defaultBase || ""))}
            onClick={() => onSaveKey(p.id, keyVal, baseVal)}
          >
            {t('common.save')}
          </CSButton>
        </CSSpaceBetween>
      </CSSpaceBetween>
    </CSContainer>
  );
}

export {
  ModelsSection,
  ApiModelsList,
  AddModelModal,
  EditApiModal,
  ValidateModal,
  VisibilityModal,
  ProviderCard,
  ProviderConfigSection,
  ModelNameCell,
  HealthDot,
  MODELS_DATA,
  PROVIDERS_CONFIG,
  normalizeApiId,
};
