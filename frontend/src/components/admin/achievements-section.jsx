/* Admin — AdminAchievementsPage — 成就目录管理。从 pages/admin.jsx 纯机械拆出,JSX / props / fetch 路径零变化。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import CSHeader from '@cloudscape-design/components/header';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSTable from '@cloudscape-design/components/table';
import CSButton from '@cloudscape-design/components/button';
import CSBox from '@cloudscape-design/components/box';
import CSBadge from '@cloudscape-design/components/badge';
import CSAlert from '@cloudscape-design/components/alert';
import CSInput from '@cloudscape-design/components/input';
import CSSelect from '@cloudscape-design/components/select';
import CSToggle from '@cloudscape-design/components/toggle';
import CSColumnLayout from '@cloudscape-design/components/column-layout';
import CSStatusIndicator from '@cloudscape-design/components/status-indicator';
import CSModal from '@cloudscape-design/components/modal';
import CSFormField from '@cloudscape-design/components/form-field';
import CSTextarea from '@cloudscape-design/components/textarea';

/* ─────────────────────────────────────────────────────────────────
   页面：AdminAchievementsPage — 成就目录管理(见 docs/design/I_achievements.md)
   规则走后端 engine.validate_rule 白名单校验;此处为录入/展示。
   ───────────────────────────────────────────────────────────────── */
const ACHV_METRIC_KEYS = [
  'saves_count', 'total_rounds', 'branches', 'branch_nodes', 'max_branch_depth',
  'scripts', 'words', 'chapters', 'login_streak', 'longest_login_streak',
];
const ACHV_CAT_KEYS = ['achv_cat_start', 'achv_cat_narrative', 'achv_cat_explore', 'achv_cat_collect', 'achv_cat_persist', 'achv_cat_hidden'];
const ACHV_TIER_VALS = ['', 'bronze', 'silver', 'gold'];

function achvSummarizeRule(rule, t) {
  try {
    if (rule && rule.all) return t('admin_page.more.achv_rule_all', { count: rule.all.length });
    if (rule && rule.metric) return `${rule.metric} ${rule.op} ${rule.target}`;
  } catch (_) {}
  return '—';
}

export function AdminAchievementsPage() {
  const { t } = useTranslation();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [editing, setEditing] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { const r = await window.api.admin.achievements.list(); setItems((r && r.items) || []); }
    catch (e) { setError(String((e && e.message) || e)); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const onDisable = async (id) => {
    if (!window.confirm(t('admin_page.more.achv_disable_confirm', { id }))) return;
    try { await window.api.admin.achievements.remove(id); await load(); }
    catch (e) { setError(String((e && e.message) || e)); }
  };

  return (
    <CSSpaceBetween size="l">
      {error && <CSAlert type="error" dismissible onDismiss={() => setError(null)}>{error}</CSAlert>}
      <CSTable
        loading={loading}
        items={items}
        variant="container"
        header={<CSHeader variant="h1" counter={`(${items.length})`}
          actions={<CSButton variant="primary" iconName="add-plus"
            onClick={() => setEditing({ __new: true, category: ACHV_CAT_KEYS[0], tier: 'bronze', enabled: true, hidden: false, sort_order: 0, rule: { metric: 'total_rounds', op: '>=', target: 100 } })}>{t('admin_page.more.achv_create_btn')}</CSButton>}>
          {t('admin_page.more.achv_catalog_title')}</CSHeader>}
        columnDefinitions={[
          { id: 'id', header: 'ID', cell: (a) => <span className="mono">{a.id}</span> },
          { id: 'name', header: t('admin_page.more.achv_col_name'), cell: (a) => <>{a.icon ? a.icon + ' ' : ''}{a.name}</> },
          { id: 'category', header: t('admin_page.more.achv_col_category'), cell: (a) => a.category },
          { id: 'tier', header: t('admin_page.more.achv_col_tier'), cell: (a) => a.tier || '—' },
          { id: 'rule', header: t('admin_page.more.achv_col_rule'), cell: (a) => <span className="mono" style={{ fontSize: 11 }}>{achvSummarizeRule(a.rule, t)}</span> },
          { id: 'hidden', header: t('admin_page.more.achv_col_hidden'), cell: (a) => a.hidden ? <CSBadge>{t('admin_page.more.achv_badge_hidden')}</CSBadge> : '—' },
          { id: 'enabled', header: t('admin_page.more.achv_col_status'), cell: (a) => a.enabled ? <CSStatusIndicator type="success">{t('common.enabled')}</CSStatusIndicator> : <CSStatusIndicator type="stopped">{t('common.disabled')}</CSStatusIndicator> },
          {
            id: 'actions', header: t('admin_page.common.actions'), cell: (a) => (
              <CSSpaceBetween direction="horizontal" size="xs">
                <CSButton variant="inline-link" onClick={() => setEditing({ ...a })}>{t('common.edit')}</CSButton>
                {a.enabled && <CSButton variant="inline-link" onClick={() => onDisable(a.id)}>{t('admin_page.more.achv_disable_btn')}</CSButton>}
              </CSSpaceBetween>
            ),
          },
        ]}
        empty={<CSBox textAlign="center" color="text-body-secondary" padding="l">{t('admin_page.more.achv_empty')}</CSBox>}
      />
      {editing && <AchvEditModal editing={editing} onClose={() => setEditing(null)} reload={load} />}
    </CSSpaceBetween>
  );
}

function AchvEditModal({ editing, onClose, reload }) {
  const { t } = useTranslation();
  const isNew = !!editing.__new;
  const rule0 = editing.rule || {};

  const achvCatOptions = ACHV_CAT_KEYS.map(k => ({ value: k, label: t(`admin_page.more.${k}`) }));
  const achvTierOptions = ACHV_TIER_VALS.map(v => ({ value: v, label: v ? v : t('admin_page.more.achv_tier_none') }));
  const achvMetricOptions = ACHV_METRIC_KEYS.map(k => ({ value: k, label: t(`admin_page.more.metric_${k}`) }));

  const [f, setF] = React.useState({
    id: editing.id || '',
    name: editing.name || '',
    description: editing.description || '',
    icon: editing.icon || '',
    category: editing.category || ACHV_CAT_KEYS[0],
    tier: editing.tier || '',
    hidden: !!editing.hidden,
    enabled: editing.enabled !== false,
    sort_order: editing.sort_order || 0,
    advanced: !!rule0.all,
    metric: rule0.metric || 'total_rounds',
    op: rule0.op || '>=',
    target: rule0.target != null ? rule0.target : 0,
    ruleJson: rule0.all ? JSON.stringify(editing.rule, null, 2) : '',
  });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const [err, setErr] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setErr(null);
    let rule;
    if (f.advanced) {
      try { rule = JSON.parse(f.ruleJson); }
      catch (e) { setErr(t('admin_page.more.achv_rule_json_parse_fail') + ': ' + e.message); return; }
    } else {
      rule = { metric: f.metric, op: f.op, target: Number(f.target) };
    }
    const body = {
      name: f.name.trim(), description: f.description.trim(), icon: f.icon.trim() || null,
      category: f.category, tier: f.tier || null, hidden: f.hidden, enabled: f.enabled,
      sort_order: Number(f.sort_order) || 0, rule,
    };
    setSaving(true);
    try {
      if (isNew) { body.id = f.id.trim(); await window.api.admin.achievements.create(body); }
      else { await window.api.admin.achievements.update(editing.id, body); }
      onClose(); await reload();
    } catch (e) { setErr(String((e && e.message) || e)); }
    finally { setSaving(false); }
  };

  const metricLabel = (achvMetricOptions.find(m => m.value === f.metric) || { label: f.metric }).label;
  return (
    <CSModal visible onDismiss={onClose} header={isNew ? t('admin_page.more.achv_modal_create') : t('admin_page.more.achv_modal_edit', { id: editing.id })}
      footer={<CSBox float="right"><CSSpaceBetween direction="horizontal" size="xs">
        <CSButton variant="link" onClick={onClose}>{t('admin_page.common.cancel')}</CSButton>
        <CSButton variant="primary" loading={saving} onClick={save}>{t('common.save')}</CSButton>
      </CSSpaceBetween></CSBox>}>
      <CSSpaceBetween size="m">
        {err && <CSAlert type="error">{err}</CSAlert>}
        {isNew && <CSFormField label={t('admin_page.more.achv_field_id')} description={t('admin_page.more.achv_field_id_desc')}>
          <CSInput value={f.id} onChange={e => set('id', e.detail.value)} placeholder="turns_500" /></CSFormField>}
        <CSColumnLayout columns={2}>
          <CSFormField label={t('admin_page.more.achv_field_name')}><CSInput value={f.name} onChange={e => set('name', e.detail.value)} /></CSFormField>
          <CSFormField label={t('admin_page.more.achv_field_icon')}><CSInput value={f.icon} onChange={e => set('icon', e.detail.value)} placeholder="🏆" /></CSFormField>
        </CSColumnLayout>
        <CSFormField label={t('admin_page.more.achv_field_desc')}><CSInput value={f.description} onChange={e => set('description', e.detail.value)} /></CSFormField>
        <CSColumnLayout columns={3}>
          <CSFormField label={t('admin_page.more.achv_field_category')}><CSSelect selectedOption={achvCatOptions.find(o => o.value === f.category) || { value: f.category, label: f.category }}
            options={achvCatOptions} onChange={e => set('category', e.detail.selectedOption.value)} /></CSFormField>
          <CSFormField label={t('admin_page.more.achv_field_tier')}><CSSelect selectedOption={achvTierOptions.find(o => o.value === f.tier) || { value: f.tier, label: f.tier || t('admin_page.more.achv_tier_none') }}
            options={achvTierOptions} onChange={e => set('tier', e.detail.selectedOption.value)} /></CSFormField>
          <CSFormField label={t('admin_page.more.achv_field_sort')}><CSInput type="number" value={String(f.sort_order)} onChange={e => set('sort_order', e.detail.value)} /></CSFormField>
        </CSColumnLayout>
        <CSFormField label={t('admin_page.more.achv_field_rule_mode')}><CSToggle checked={f.advanced} onChange={e => set('advanced', e.detail.checked)}>{t('admin_page.more.achv_rule_advanced')}</CSToggle></CSFormField>
        {!f.advanced ? (
          <CSColumnLayout columns={3}>
            <CSFormField label={t('admin_page.more.achv_field_metric')}><CSSelect selectedOption={{ value: f.metric, label: metricLabel }}
              options={achvMetricOptions} onChange={e => set('metric', e.detail.selectedOption.value)} /></CSFormField>
            <CSFormField label={t('admin_page.more.achv_field_op')}><CSSelect selectedOption={{ value: f.op, label: f.op }}
              options={[{ value: '>=', label: '≥' }, { value: '>', label: '>' }, { value: '==', label: '=' }]} onChange={e => set('op', e.detail.selectedOption.value)} /></CSFormField>
            <CSFormField label={t('admin_page.more.achv_field_target')}><CSInput type="number" value={String(f.target)} onChange={e => set('target', e.detail.value)} /></CSFormField>
          </CSColumnLayout>
        ) : (
          <CSFormField label={t('admin_page.more.achv_field_rule_json')} description='{"all":[{"metric":"scripts","op":">=","target":10},{"metric":"words","op":">=","target":10000000}]}'>
            <CSTextarea value={f.ruleJson} onChange={e => set('ruleJson', e.detail.value)} rows={6} /></CSFormField>
        )}
        <CSColumnLayout columns={2}>
          <CSFormField label={t('admin_page.more.achv_field_hidden')}><CSToggle checked={f.hidden} onChange={e => set('hidden', e.detail.checked)}>{t('admin_page.more.achv_hidden_hint')}</CSToggle></CSFormField>
          <CSFormField label={t('admin_page.more.achv_field_enabled')}><CSToggle checked={f.enabled} onChange={e => set('enabled', e.detail.checked)}>{t('admin_page.more.achv_enabled_hint')}</CSToggle></CSFormField>
        </CSColumnLayout>
      </CSSpaceBetween>
    </CSModal>
  );
}
