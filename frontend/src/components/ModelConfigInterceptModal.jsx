import React from 'react';
import CSModal from '@cloudscape-design/components/modal';
import CSBox from '@cloudscape-design/components/box';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSButton from '@cloudscape-design/components/button';
import CSAlert from '@cloudscape-design/components/alert';
import CSSegmentedControl from '@cloudscape-design/components/segmented-control';
import AgentModelPicker from './AgentModelPicker.jsx';
import { EditApiModal } from '../pages/settings.jsx';

/* config_card 能力 → 前端配置映射(后端契约里的 capability 字段)。
   一处定义,ConfirmStrip 的内联卡片与本拦截弹窗共用,避免两份各写一套。
     prefPrefix      : user_preferences 命名空间(后端各 agent resolve 读同名 key)
     capabilityFilter: AgentModelPicker 只展示含此 capability 的模型(null=不过滤,LLM)
     label           : 给用户看的能力名(中文) */
export const CAP_CONFIG = {
  image:     { prefPrefix: 'image_gen', capabilityFilter: 'image_gen', label: '生图' },
  embedding: { prefPrefix: 'embed',     capabilityFilter: 'embedding', label: '向量检索' },
  llm:       { prefPrefix: 'gm',        capabilityFilter: null,        label: '对话' },
};

export function capConfig(capability) {
  return CAP_CONFIG[capability] || CAP_CONFIG.llm;
}

/* ModelConfigInterceptModal —— config_card 的 hard 拦截弹窗(mode==="model_not_configured")。
   后端要求的模型「<item.model>」当前不可用 → 阻塞式弹窗,用户二选一:
     (a) 给该能力另选一个已配好的模型(内嵌 AgentModelPicker,选中即持久化偏好);或
     (b) 给该模型所属 provider 补一把 API Key(打开 EditApiModal,保存即 credentials.set + 广播刷新)。
   两条路都支持,用户自选。
   确认(继续)→ onResolve(chosenModel) 让父组件 clearQuestions(item) + startRun(`用 X 生成`) 重试。
   取消 → onCancel(item) 仍要 clearQuestions(别把卡片永久卡在 composer)+ 一个「已取消」toast。

   props:
     open        : boolean
     item        : config_card 条目(含 capability / model / api_id)
     onResolve   : (chosenModel:string) => void   选好模型/配好 key 后点「继续生成」
     onCancel    : () => void                       取消(父组件负责 clearQuestions + toast) */
export default function ModelConfigInterceptModal({ open, item, onResolve, onCancel }) {
  const { useState, useEffect } = React;
  const capability = (item && item.capability) || 'llm';
  const cap = capConfig(capability);
  // 用户在本能力下当前选定的模型(AgentModelPicker onChange 回填);默认沿用后端要求的 model。
  const [chosen, setChosen] = useState({ api_id: (item && item.api_id) || '', model: (item && item.model) || '' });
  const [tab, setTab] = useState('pick');     // pick = 选已有模型 / key = 补 provider key
  const [editKeyOpen, setEditKeyOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyError, setKeyError] = useState('');

  // 每次打开/换 item 时重置(避免上一个 config_card 的残留选择)。
  useEffect(() => {
    if (!open) return;
    setChosen({ api_id: (item && item.api_id) || '', model: (item && item.model) || '' });
    setTab('pick');
    setEditKeyOpen(false);
    setKeyError('');
  }, [open, item]);

  if (!open || !item) return null;

  const requestedModel = (item && item.model) || '';
  // EditApiModal 用 api 对象预填 provider(item.api_id 即 provider id);没有就走「新增」自由选。
  const prefillApi = item && item.api_id
    ? { id: item.api_id, name: item.api_id, base_url: '', kind: item.api_id === 'vertex_ai' ? 'vertex_ai' : undefined }
    : null;

  const onConfirmKey = async (form) => {
    setSaving(true); setKeyError('');
    try {
      await window.api.credentials.set({
        api_id: form.id,
        api_key: form.api_key,
        base_url_override: form.base_url || undefined,
      });
      // credentials.set 内部已广播 rpg-credentials-updated → AgentModelPicker 会重拉。
      setEditKeyOpen(false);
      setTab('pick');   // 配好 key 后切回「选模型」,让用户确认要用的模型
      window.__apiToast?.('已保存 API Key', { kind: 'ok', duration: 1800 });
    } catch (e) {
      setKeyError(String(e?.message || e || '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const canContinue = !!(chosen.api_id && chosen.model);

  return (
    <CSModal
      visible
      onDismiss={() => onCancel && onCancel()}
      header={`模型「${requestedModel || '?'}」尚未配置`}
      footer={
        <CSBox float="right">
          <CSSpaceBetween direction="horizontal" size="xs">
            <CSButton variant="link" onClick={() => onCancel && onCancel()}>取消</CSButton>
            <CSButton
              variant="primary"
              disabled={!canContinue}
              onClick={() => onResolve && onResolve(chosen.model || requestedModel)}
            >
              继续生成
            </CSButton>
          </CSSpaceBetween>
        </CSBox>
      }
    >
      <CSSpaceBetween size="m">
        <CSAlert type="info">
          本轮{cap.label}请求的模型「{requestedModel || '?'}」当前不可用。你可以给{cap.label}换一个已配好的模型，
          或为该模型所属服务商补一把 API Key，然后继续。
        </CSAlert>

        <CSSegmentedControl
          selectedId={tab}
          onChange={({ detail }) => setTab(detail.selectedId)}
          options={[
            { id: 'pick', text: '换一个模型' },
            { id: 'key', text: '补 API Key' },
          ]}
        />

        {tab === 'pick' && (
          <AgentModelPicker
            prefPrefix={cap.prefPrefix}
            capabilityFilter={cap.capabilityFilter}
            variant="bare"
            preferProvider={item.api_id || null}
            defaultModel={requestedModel || null}
            configHash="settings-models"
            onChange={(api_id, model) => setChosen({ api_id, model })}
          />
        )}

        {tab === 'key' && (
          <CSSpaceBetween size="s">
            {keyError && <CSAlert type="error">{keyError}</CSAlert>}
            <CSBox color="text-body-secondary" fontSize="body-s">
              {item.api_id
                ? `为服务商「${item.api_id}」添加 API Key。`
                : '添加一把 API Key（在弹窗里选择服务商）。'}
            </CSBox>
            <CSButton iconName="add-plus" loading={saving} onClick={() => setEditKeyOpen(true)}>
              添加 API Key
            </CSButton>
          </CSSpaceBetween>
        )}
      </CSSpaceBetween>

      {/* 复用设置页的 EditApiModal —— 不另造一套凭据表单 */}
      <EditApiModal
        open={editKeyOpen}
        api={prefillApi}
        isNew
        onClose={() => setEditKeyOpen(false)}
        onConfirm={onConfirmKey}
      />
    </CSModal>
  );
}
