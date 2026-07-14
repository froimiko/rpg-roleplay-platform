/* AnchorEditorView — inline table editor for kb story anchors.
   Mechanically extracted from pages/script-edit-canon.jsx (zero behavior change). */

import React from 'react';
import { useTranslation } from 'react-i18next';

import CSHeader from '@cloudscape-design/components/header';
import CSTable from '@cloudscape-design/components/table';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSButton from '@cloudscape-design/components/button';
import CSBox from '@cloudscape-design/components/box';
import CSAlert from '@cloudscape-design/components/alert';
import CSInput from '@cloudscape-design/components/input';
import CSSelect from '@cloudscape-design/components/select';
import CSSegmentedControl from '@cloudscape-design/components/segmented-control';
import DetailDrawer from '../DetailDrawer.jsx';
import CSExpandableSection from '@cloudscape-design/components/expandable-section';
import CSFormField from '@cloudscape-design/components/form-field';
import CSTextarea from '@cloudscape-design/components/textarea';
import CSKeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import CSStatusIndicator from '@cloudscape-design/components/status-indicator';

import { snippet } from './helpers.js';

/* ------------------------------------------------------------------ */
/* Constants                                                             */
/* ------------------------------------------------------------------ */
const STORY_PHASES = ['开端', '发展', '高潮', '结局', '番外', '未明'];

/* ------------------------------------------------------------------ */
/* AnchorEditorView                                                      */
/* ------------------------------------------------------------------ */
export function AnchorEditorView({ scriptId, ownerId, currentUserId }) {
  const { t } = useTranslation();
  const readonly = ownerId != null && currentUserId != null && ownerId !== currentUserId;

  /* data */
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [reloadTick, setReloadTick] = React.useState(0);

  /* filters */
  const [phaseFilter, setPhaseFilter] = React.useState('all');
  const [chapterMin, setChapterMin] = React.useState('');
  const [chapterMax, setChapterMax] = React.useState('');

  /* selection / detail */
  const [selected, setSelected] = React.useState(null);
  const [splitOpen, setSplitOpen] = React.useState(false);
  const [detailEdit, setDetailEdit] = React.useState({});
  const [savingDetail, setSavingDetail] = React.useState(false);

  /* inline edit */
  const [editCell, setEditCell] = React.useState(null); // { id, field, value }

  /* add new */
  const [adding, setAdding] = React.useState(false);
  const [newForm, setNewForm] = React.useState({ story_phase: '开端', story_time_label: '', chapter_min: '', chapter_max: '', confidence: '0.8', sample_summary: '' });

  /* delete confirm inline */
  const [confirmDelete, setConfirmDelete] = React.useState(null); // anchor id

  /* ---- fetch ---- */
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (phaseFilter && phaseFilter !== 'all') params.set('phase', phaseFilter);
    if (chapterMin) params.set('chapter_min', chapterMin);
    if (chapterMax) params.set('chapter_max', chapterMax);
    const url = `${window.__API_BASE || ''}/api/scripts/${scriptId}/anchors?${params}`;
    fetch(url, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setItems(Array.isArray(j) ? j : (j?.items || j?.anchors || [])); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scriptId, phaseFilter, chapterMin, chapterMax, reloadTick]);

  /* ---- API ---- */
  async function apiPut(anchorId, body) {
    const r = await fetch(
      `${window.__API_BASE || ''}/api/scripts/${scriptId}/anchors/${encodeURIComponent(anchorId)}`,
      { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const j = await r.json();
    if (!r.ok || j.ok === false) throw new Error(j.error || j.detail || t('scripts.toast.save_fail'));
    return j;
  }

  async function apiPost(body) {
    const r = await fetch(
      `${window.__API_BASE || ''}/api/scripts/${scriptId}/anchors`,
      { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const j = await r.json();
    if (!r.ok || j.ok === false) throw new Error(j.error || j.detail || t('scripts.toast.save_fail'));
    return j;
  }

  async function apiDelete(anchorId) {
    const r = await fetch(
      `${window.__API_BASE || ''}/api/scripts/${scriptId}/anchors/${encodeURIComponent(anchorId)}`,
      { method: 'DELETE', credentials: 'include' }
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok && j.ok !== true) throw new Error(j.error || j.detail || t('scripts.toast.delete_fail'));
    return j;
  }

  /* ---- inline cell save ---- */
  async function saveCell(anchor, field, value) {
    if (readonly) return;
    const patch = { [field]: field === 'confidence' ? (parseFloat(value) || null) : value };
    try {
      await apiPut(anchor.id, patch);
      setItems((arr) => arr.map((a) => a.id === anchor.id ? { ...a, ...patch } : a));
      if (selected?.id === anchor.id) setSelected((s) => s ? { ...s, ...patch } : s);
      window.__apiToast?.(t('scripts.toast.saved'), { kind: 'ok', duration: 1500 });
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.save_fail'), { kind: 'danger', detail: e?.message });
    }
    setEditCell(null);
  }

  /* ---- add ---- */
  async function submitAdd() {
    if (readonly) return;
    const body = {
      ...newForm,
      chapter_min: parseInt(newForm.chapter_min, 10) || null,
      chapter_max: parseInt(newForm.chapter_max, 10) || null,
      confidence: parseFloat(newForm.confidence) || 0.8,
    };
    try {
      await apiPost(body);
      setAdding(false);
      setNewForm({ story_phase: '开端', story_time_label: '', chapter_min: '', chapter_max: '', confidence: '0.8', sample_summary: '' });
      setReloadTick((x) => x + 1);
      window.__apiToast?.(t('scripts.edit.anchors.add_ok'), { kind: 'ok' });
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.save_fail'), { kind: 'danger', detail: e?.message });
    }
  }

  /* ---- delete ---- */
  async function doDelete(anchorId) {
    if (readonly) return;
    try {
      await apiDelete(anchorId);
      setItems((arr) => arr.filter((a) => a.id !== anchorId));
      if (selected?.id === anchorId) { setSelected(null); setSplitOpen(false); }
      setConfirmDelete(null);
      window.__apiToast?.(t('scripts.edit.anchors.deleted'), { kind: 'ok' });
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.delete_fail'), { kind: 'danger', detail: e?.message });
    }
  }

  /* ---- detail panel save ---- */
  async function saveDetail() {
    if (!selected || readonly) return;
    const patch = { ...detailEdit };
    if ('confidence' in patch) patch.confidence = parseFloat(patch.confidence) || null;
    setSavingDetail(true);
    try {
      await apiPut(selected.id, patch);
      const updated = { ...selected, ...patch };
      setSelected(updated);
      setItems((arr) => arr.map((a) => a.id === selected.id ? updated : a));
      setDetailEdit({});
      window.__apiToast?.(t('scripts.toast.saved'), { kind: 'ok' });
    } catch (e) {
      window.__apiToast?.(t('scripts.toast.save_fail'), { kind: 'danger', detail: e?.message });
    } finally { setSavingDetail(false); }
  }

  /* ---- phase segment options ---- */
  const phaseOptions = [
    { id: 'all', text: t('scripts.edit.anchors.phase_all') },
    ...STORY_PHASES.map((p) => ({ id: p, text: p })),
  ];

  /* ---- inline editable cells ---- */
  function CellPhase({ anchor }) {
    const editing = editCell?.id === anchor.id && editCell?.field === 'story_phase';
    if (editing) {
      return (
        <CSSelect
          selectedOption={STORY_PHASES.map((p) => ({ value: p, label: p })).find((o) => o.value === editCell.value) || null}
          options={STORY_PHASES.map((p) => ({ value: p, label: p }))}
          onChange={({ detail }) => saveCell(anchor, 'story_phase', detail.selectedOption.value)}
          onBlur={() => setEditCell(null)}
        />
      );
    }
    return (
      <span
        style={{ cursor: readonly ? 'default' : 'pointer', borderBottom: readonly ? 'none' : '1px dashed var(--color-border-divider-default, #ccc)' }}
        onClick={() => !readonly && setEditCell({ id: anchor.id, field: 'story_phase', value: anchor.story_phase || '' })}
      >
        {anchor.story_phase || '—'}
      </span>
    );
  }

  function CellConfidence({ anchor }) {
    const editing = editCell?.id === anchor.id && editCell?.field === 'confidence';
    if (editing) {
      return (
        <CSInput
          autoFocus
          type="number"
          step="0.05"
          value={String(editCell.value)}
          onChange={({ detail }) => setEditCell((c) => ({ ...c, value: detail.value }))}
          onKeyDown={({ detail }) => {
            if (detail.key === 'Enter') saveCell(anchor, 'confidence', editCell.value);
            if (detail.key === 'Escape') setEditCell(null);
          }}
          onBlur={() => saveCell(anchor, 'confidence', editCell.value)}
        />
      );
    }
    const pct = anchor.confidence != null ? `${Math.round(anchor.confidence * 100)}%` : '—';
    const color = anchor.confidence >= 0.85 ? 'var(--color-text-status-success, #1d7649)' : anchor.confidence >= 0.7 ? 'var(--color-text-status-warning, #b55a00)' : 'var(--color-text-status-error, #d63f38)';
    return (
      <span
        style={{ cursor: readonly ? 'default' : 'pointer', borderBottom: readonly ? 'none' : '1px dashed var(--color-border-divider-default, #ccc)', color, fontVariantNumeric: 'tabular-nums' }}
        onClick={() => !readonly && setEditCell({ id: anchor.id, field: 'confidence', value: String(anchor.confidence ?? 0.8) })}
      >
        {pct}
      </span>
    );
  }

  function DeleteConfirmRow({ anchor }) {
    if (confirmDelete !== anchor.id) {
      return (
        <CSButton variant="inline-link" iconName="remove" disabled={readonly} onClick={() => setConfirmDelete(anchor.id)}>
          {t('common.delete')}
        </CSButton>
      );
    }
    return (
      <CSSpaceBetween direction="horizontal" size="xs">
        <CSStatusIndicator type="warning">{t('scripts.edit.anchors.confirm_delete')}</CSStatusIndicator>
        <CSButton variant="inline-link" iconName="check" onClick={() => doDelete(anchor.id)}>{t('common.confirm')}</CSButton>
        <CSButton variant="inline-link" iconName="close" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</CSButton>
      </CSSpaceBetween>
    );
  }

  /* ---- detail panel ---- */
  function DetailPanel({ anchor }) {
    const detailVal = (field) => (field in detailEdit ? detailEdit[field] : anchor[field]);
    const setDF = (field, val) => setDetailEdit((d) => ({ ...d, [field]: val }));
    const isDirty = Object.keys(detailEdit).length > 0;
    let metaDisplay = '—';
    try {
      const m = anchor.metadata;
      if (m && typeof m === 'object') metaDisplay = JSON.stringify(m, null, 2);
      else if (m) metaDisplay = String(m);
    } catch (_) {}

    return (
      <CSSpaceBetween size="m">
        {readonly && (
          <CSAlert type="info" header={t('scripts.edit.readonly_title')}>{t('scripts.edit.readonly_body')}</CSAlert>
        )}

        <CSKeyValuePairs columns={2} items={[
          { label: t('scripts.edit.anchors.field_id'), value: <span className="mono">{anchor.id}</span> },
          { label: t('scripts.edit.anchors.field_phase'), value: anchor.story_phase || '—' },
          { label: t('scripts.edit.anchors.field_time_label'), value: anchor.story_time_label || '—' },
          { label: t('scripts.edit.anchors.field_chapter_range'), value: `${anchor.chapter_min ?? '?'} – ${anchor.chapter_max ?? '?'}` },
          { label: t('scripts.edit.anchors.field_confidence'), value: anchor.confidence != null ? `${Math.round(anchor.confidence * 100)}%` : '—' },
        ]} />

        <CSFormField label={t('scripts.edit.anchors.field_sample_summary')}>
          <CSTextarea
            disabled={readonly}
            rows={5}
            value={detailVal('sample_summary') || ''}
            onChange={({ detail }) => setDF('sample_summary', detail.value)}
          />
        </CSFormField>

        <CSExpandableSection headerText={t('scripts.edit.anchors.field_metadata')} defaultExpanded={false}>
          <pre style={{
            margin: 0, padding: '10px 12px',
            background: 'var(--color-background-container-content)',
            border: '1px solid var(--color-border-divider-default)',
            borderRadius: 6, fontSize: 12, lineHeight: 1.6, overflow: 'auto', maxHeight: 200,
            fontFamily: 'var(--font-family-monospace, monospace)', whiteSpace: 'pre-wrap',
          }}>
            {metaDisplay}
          </pre>
        </CSExpandableSection>

        {!readonly && isDirty && (
          <CSSpaceBetween direction="horizontal" size="xs">
            <CSButton variant="primary" loading={savingDetail} onClick={saveDetail}>
              {t('common.save')}
            </CSButton>
            <CSButton variant="link" onClick={() => setDetailEdit({})}>
              {t('common.cancel')}
            </CSButton>
          </CSSpaceBetween>
        )}
      </CSSpaceBetween>
    );
  }

  /* ---- add form ---- */
  function AddAnchorForm() {
    return (
      <div style={{ padding: '12px 16px', background: 'var(--color-background-container-content)', border: '1px solid var(--color-border-container-top)', borderRadius: 8, marginBottom: 8 }}>
        <CSBox variant="h3" padding={{ bottom: 's' }}>{t('scripts.edit.anchors.add_title')}</CSBox>
        <CSSpaceBetween direction="horizontal" size="s">
          <CSFormField label={t('scripts.edit.anchors.field_phase')}>
            <CSSelect
              selectedOption={STORY_PHASES.map((p) => ({ value: p, label: p })).find((o) => o.value === newForm.story_phase) || null}
              options={STORY_PHASES.map((p) => ({ value: p, label: p }))}
              onChange={({ detail }) => setNewForm((f) => ({ ...f, story_phase: detail.selectedOption.value }))}
            />
          </CSFormField>
          <CSFormField label={t('scripts.edit.anchors.field_time_label')}>
            <CSInput
              placeholder={t('scripts.edit.anchors.time_label_ph')}
              value={newForm.story_time_label}
              onChange={({ detail }) => setNewForm((f) => ({ ...f, story_time_label: detail.value }))}
            />
          </CSFormField>
          <CSFormField label={t('scripts.edit.anchors.field_chapter_min')}>
            <CSInput
              type="number"
              value={newForm.chapter_min}
              onChange={({ detail }) => setNewForm((f) => ({ ...f, chapter_min: detail.value }))}
            />
          </CSFormField>
          <CSFormField label={t('scripts.edit.anchors.field_chapter_max')}>
            <CSInput
              type="number"
              value={newForm.chapter_max}
              onChange={({ detail }) => setNewForm((f) => ({ ...f, chapter_max: detail.value }))}
            />
          </CSFormField>
          <CSFormField label={t('scripts.edit.anchors.field_confidence')}>
            <CSInput
              type="number"
              step="0.05"
              value={newForm.confidence}
              onChange={({ detail }) => setNewForm((f) => ({ ...f, confidence: detail.value }))}
            />
          </CSFormField>
        </CSSpaceBetween>
        <CSFormField label={t('scripts.edit.anchors.field_sample_summary')}>
          <CSInput
            placeholder={t('scripts.edit.anchors.summary_ph')}
            value={newForm.sample_summary}
            onChange={({ detail }) => setNewForm((f) => ({ ...f, sample_summary: detail.value }))}
          />
        </CSFormField>
        <div style={{ marginTop: 10 }}>
          <CSSpaceBetween direction="horizontal" size="xs">
            <CSButton variant="primary" iconName="add-plus" onClick={submitAdd}>{t('scripts.edit.anchors.add_confirm')}</CSButton>
            <CSButton variant="link" onClick={() => setAdding(false)}>{t('common.cancel')}</CSButton>
          </CSSpaceBetween>
        </div>
      </div>
    );
  }

  /* ---- column definitions ---- */
  const columns = [
    {
      id: 'chapter_range',
      header: t('scripts.edit.anchors.col_chapter_range'),
      cell: (a) => (
        <span className="mono" style={{ fontSize: 12.5 }}>
          {a.chapter_min ?? '?'}–{a.chapter_max ?? '?'}
        </span>
      ),
    },
    {
      id: 'phase',
      header: t('scripts.edit.anchors.col_phase'),
      cell: (a) => <CellPhase anchor={a} />,
    },
    {
      id: 'time_label',
      header: t('scripts.edit.anchors.col_time_label'),
      cell: (a) => a.story_time_label || '—',
    },
    {
      id: 'summary',
      header: t('scripts.edit.anchors.col_summary'),
      cell: (a) => <CSBox color="text-body-secondary" fontSize="body-s">{snippet(a.sample_summary, 60)}</CSBox>,
    },
    {
      id: 'confidence',
      header: t('scripts.edit.anchors.col_confidence'),
      cell: (a) => <CellConfidence anchor={a} />,
    },
    {
      id: 'actions',
      header: '',
      cell: (a) => (
        <CSSpaceBetween direction="horizontal" size="xxs">
          <CSButton variant="inline-link" iconName="search" onClick={() => { setSelected(a); setDetailEdit({}); setSplitOpen(true); }}>
            {t('scripts.edit.anchors.view_detail')}
          </CSButton>
          <DeleteConfirmRow anchor={a} />
        </CSSpaceBetween>
      ),
    },
  ];

  /* ---- main render ---- */
  const tableEl = (
    <CSTable
      variant="container"
      loading={loading}
      loadingText={t('scripts.edit.anchors.loading')}
      items={items}
      trackBy="id"
      selectionType="single"
      selectedItems={selected ? [selected] : []}
      onSelectionChange={({ detail }) => {
        const a = detail.selectedItems[0];
        if (a) { setSelected(a); setDetailEdit({}); setSplitOpen(true); }
      }}
      columnDefinitions={columns}
      header={
        <CSHeader
          variant="h2"
          counter={`(${items.length})`}
          actions={
            <CSSpaceBetween direction="horizontal" size="xs">
              <CSButton iconName="refresh" variant="icon" ariaLabel={t('common.refresh')} onClick={() => setReloadTick((x) => x + 1)} />
              {!readonly && (
                <CSButton iconName="add-plus" variant="primary" onClick={() => setAdding((v) => !v)}>
                  {t('scripts.edit.anchors.add_btn')}
                </CSButton>
              )}
            </CSSpaceBetween>
          }
          description={t('scripts.edit.anchors.description')}
        >
          {t('scripts.edit.anchors.title')}
        </CSHeader>
      }
      filter={
        <CSSpaceBetween direction="horizontal" size="s">
          <CSSegmentedControl
            selectedId={phaseFilter}
            onChange={({ detail }) => setPhaseFilter(detail.selectedId)}
            options={phaseOptions}
          />
          <CSSpaceBetween direction="horizontal" size="xs">
            <CSInput
              type="number"
              placeholder={t('scripts.edit.anchors.filter_ch_min')}
              value={chapterMin}
              onChange={({ detail }) => setChapterMin(detail.value)}
              ariaLabel={t('scripts.edit.anchors.filter_ch_min')}
            />
            <CSInput
              type="number"
              placeholder={t('scripts.edit.anchors.filter_ch_max')}
              value={chapterMax}
              onChange={({ detail }) => setChapterMax(detail.value)}
              ariaLabel={t('scripts.edit.anchors.filter_ch_max')}
            />
          </CSSpaceBetween>
        </CSSpaceBetween>
      }
      empty={
        <CSBox textAlign="center" color="inherit" padding={{ vertical: 'l' }}>
          {t('scripts.edit.anchors.empty')}
        </CSBox>
      }
    />
  );

  return (
    <CSSpaceBetween size="m">
      {readonly && (
        <CSAlert type="info" header={t('scripts.edit.readonly_title')}>
          {t('scripts.edit.readonly_body')}
        </CSAlert>
      )}
      {adding && !readonly && <AddAnchorForm />}
      <DetailDrawer
        open={splitOpen && !!selected}
        title={`${selected?.story_phase || ''} · ${t('scripts.editor.chapter_range', { min: selected?.chapter_min ?? '?', max: selected?.chapter_max ?? '?' })}`}
        onClose={() => { setSelected(null); setSplitOpen(false); }}
        closeLabel={t('common.close')}
      >
        {selected && <DetailPanel anchor={selected} />}
      </DetailDrawer>
      {tableEl}
    </CSSpaceBetween>
  );
}
