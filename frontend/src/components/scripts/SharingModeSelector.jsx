/* 共享模式选择器(从 ScriptDetail.jsx 二次拆出,纯机械搬家零行为变化)。 */

import React from 'react';
import { useState as useStatePL, useEffect as useEffectPL } from 'react';
import { useTranslation } from 'react-i18next';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSButton from '@cloudscape-design/components/button';
import CSFormField from '@cloudscape-design/components/form-field';
import CSSelect from '@cloudscape-design/components/select';
import CSSegmentedControl from '@cloudscape-design/components/segmented-control';

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

export { SharingModeSelector };
