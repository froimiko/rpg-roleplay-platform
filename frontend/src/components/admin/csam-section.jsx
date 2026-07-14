/* Admin — AdminCsamReportsPage — CSAM 举报管理。从 pages/admin.jsx 纯机械拆出,JSX / props / fetch 路径零变化。 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import CSContainer from '@cloudscape-design/components/container';
import CSHeader from '@cloudscape-design/components/header';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSTable from '@cloudscape-design/components/table';
import CSButton from '@cloudscape-design/components/button';
import CSBox from '@cloudscape-design/components/box';
import CSBadge from '@cloudscape-design/components/badge';
import CSAlert from '@cloudscape-design/components/alert';
import CSSelect from '@cloudscape-design/components/select';
import CSModal from '@cloudscape-design/components/modal';
import CSFormField from '@cloudscape-design/components/form-field';
import CSTextarea from '@cloudscape-design/components/textarea';
import { fmtTime } from './shared.jsx';

/* ─────────────────────────────────────────────────────────────────
   页面 11：AdminCsamReportsPage — CSAM 举报管理
   ───────────────────────────────────────────────────────────────── */
export function AdminCsamReportsPage() {
  const { t } = useTranslation();
  const [reports, setReports] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState({ value: 'pending', label: t('admin_page.csam.status_pending') });
  const [decisionModal, setDecisionModal] = React.useState(null); // report item
  const [decisionForm, setDecisionForm] = React.useState({ decision: '', notes: '' });
  const [deciding, setDeciding] = React.useState(false);

  const statusOptions = [
    { value: 'pending', label: t('admin_page.csam.status_pending') },
    { value: 'decided', label: t('admin_page.csam.status_decided') },
    { value: 'all', label: t('admin_page.csam.status_all') },
  ];
  const decisionOptions = [
    { value: 'founded', label: t('admin_page.csam.decision_founded') },
    { value: 'escalate', label: t('admin_page.csam.decision_escalate') },
    { value: 'unfounded', label: t('admin_page.csam.decision_unfounded') },
  ];

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await window.api.admin.csamReports.list({ status: statusFilter.value });
      setReports(res.reports || []);
    } catch (e) {
      setErr(e?.message || t('admin_page.common.load_fail'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter.value]);

  React.useEffect(() => { load(); }, [load]);

  async function doDecision() {
    if (!decisionModal || !decisionForm.decision) return;
    setDeciding(true);
    try {
      await window.api.admin.csamReports.decision(decisionModal.id, decisionForm);
      window.toast?.(t('admin_page.csam.decided_ok'), { kind: 'ok' });
      setDecisionModal(null);
      setDecisionForm({ decision: '', notes: '' });
      load();
    } catch (e) {
      window.toast?.(t('admin_page.csam.op_fail') + ': ' + (e?.message || ''), { kind: 'danger' });
    } finally {
      setDeciding(false);
    }
  }

  function decisionBadge(d) {
    const map = {
      founded: ['red', t('admin_page.csam.badge_founded')],
      escalate: ['blue', t('admin_page.csam.badge_escalate')],
      unfounded: ['grey', t('admin_page.csam.badge_unfounded')],
    };
    const [color, label] = map[d] || ['grey', d || '—'];
    return <CSBadge color={color}>{label}</CSBadge>;
  }

  return (
    <CSSpaceBetween size="l">
      {err && <CSAlert type="error" header={t('admin_page.common.load_fail')}>{err}</CSAlert>}
      <CSAlert type="warning">{t('admin_page.csam.warning')}</CSAlert>
      <CSContainer
        header={
          <CSHeader
            variant="h2"
            description={t('admin_page.csam.description')}
            actions={
              <CSSpaceBetween direction="horizontal" size="xs">
                <CSSelect
                  selectedOption={statusFilter}
                  options={statusOptions}
                  onChange={({ detail }) => setStatusFilter(detail.selectedOption)}
                />
                <CSButton iconName="refresh" onClick={load} loading={loading}>{t('admin_page.common.refresh')}</CSButton>
              </CSSpaceBetween>
            }
          >
            {t('admin_page.csam.title')}
          </CSHeader>
        }
      >
        <CSTable
          loading={loading}
          loadingText={t('admin_page.common.loading')}
          trackBy="id"
          items={reports}
          empty={<CSBox textAlign="center" color="inherit">{t('admin_page.csam.empty')}</CSBox>}
          columnDefinitions={[
            { id: 'id', header: t('admin_page.csam.col_id'), cell: (r) => `#${r.id}`, width: 60 },
            { id: 'reported_user', header: t('admin_page.csam.col_reported_user'), cell: (r) => r.reported_username || `uid:${r.reported_user_id}` || '—' },
            { id: 'content_url', header: t('admin_page.csam.col_content'), cell: (r) => r.content_url || t('admin_page.csam.content_no_url') },
            { id: 'status', header: t('admin_page.csam.col_status'), cell: (r) => r.status === 'pending' ? <CSBadge color="red">{t('admin_page.csam.badge_pending')}</CSBadge> : <CSBadge color="grey">{t('admin_page.csam.badge_decided')}</CSBadge> },
            { id: 'decision', header: t('admin_page.csam.col_decision'), cell: (r) => r.decision ? decisionBadge(r.decision) : '—' },
            { id: 'cybertip', header: t('admin_page.csam.col_cybertip'), cell: (r) => r.cybertip_report_id || '—' },
            { id: 'created_at', header: t('admin_page.csam.col_created_at'), cell: (r) => fmtTime(r.created_at) },
            {
              id: 'actions', header: t('admin_page.common.actions'),
              cell: (r) => r.status === 'pending' && (
                <CSButton
                  variant="inline-link"
                  onClick={() => { setDecisionModal(r); setDecisionForm({ decision: '', notes: '' }); }}
                >
                  {t('admin_page.csam.btn_decide')}
                </CSButton>
              ),
            },
          ]}
        />
      </CSContainer>

      {decisionModal && (
        <CSModal
          visible
          onDismiss={() => !deciding && setDecisionModal(null)}
          header={t('admin_page.csam.decision_modal_title', { id: decisionModal.id })}
          footer={
            <CSBox float="right">
              <CSSpaceBetween direction="horizontal" size="xs">
                <CSButton variant="link" disabled={deciding} onClick={() => setDecisionModal(null)}>{t('admin_page.common.cancel')}</CSButton>
                <CSButton variant="primary" loading={deciding} disabled={!decisionForm.decision} onClick={doDecision}>{t('admin_page.common.confirm')}</CSButton>
              </CSSpaceBetween>
            </CSBox>
          }
        >
          <CSSpaceBetween size="m">
            <CSAlert type="warning">{t('admin_page.csam.decision_warning')}</CSAlert>
            <CSFormField label={t('admin_page.csam.decision_field')}>
              <CSSelect
                selectedOption={decisionOptions.find((o) => o.value === decisionForm.decision) || { value: '', label: t('admin_page.csam.decision_select_placeholder') }}
                options={decisionOptions}
                onChange={({ detail }) => setDecisionForm((f) => ({ ...f, decision: detail.selectedOption.value }))}
              />
            </CSFormField>
            <CSFormField label={t('admin_page.csam.notes_field')}>
              <CSTextarea
                value={decisionForm.notes}
                onChange={({ detail }) => setDecisionForm((f) => ({ ...f, notes: detail.value }))}
                rows={3}
                placeholder={t('admin_page.csam.notes_placeholder')}
              />
            </CSFormField>
          </CSSpaceBetween>
        </CSModal>
      )}
    </CSSpaceBetween>
  );
}
