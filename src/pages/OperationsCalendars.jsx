import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import TemplatePanel from '../components/TemplatePanel';
import { getLocalizedLabel } from '../i18n/helpers';
import { authFetch } from '../utils/authFetch';
import OperationsLayout from './OperationsLayout';

import { apiUrl } from '../config/api';

const emptyCalendar = {
  department: '',
  process: '',
  shift: '',
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  title: '',
  notes: '',
};

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatApiMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;

  const firstError = Object.entries(data)[0];
  if (!firstError) return fallback;

  const [field, messages] = firstError;
  const message = Array.isArray(messages) ? messages[0] : messages;
  return `${field}: ${message}`;
}

export default function OperationsCalendars() {
  const { i18n, t } = useTranslation();
  const [calendars, setCalendars] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(emptyCalendar);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingCalendarId, setProcessingCalendarId] = useState(null);
  const [exportingCalendarId, setExportingCalendarId] = useState(null);
  const [templateDialogMode, setTemplateDialogMode] = useState('');
  const [templateDialogCalendar, setTemplateDialogCalendar] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateNeedsOverwrite, setTemplateNeedsOverwrite] = useState(false);
  const [templateTargetCounts, setTemplateTargetCounts] = useState({ assignments: 0, cells: 0 });
  const [generatedTargetCalendarId, setGeneratedTargetCalendarId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const summary = useMemo(() => {
    const draft = calendars.filter((calendar) => calendar.status === 'draft').length;
    const published = calendars.filter((calendar) => calendar.status === 'published').length;

    return [
      { label: t('operations.calendars'), value: calendars.length, detail: t('operations.loadedCalendars') },
      { label: t('operations.statuses.draft'), value: draft, detail: t('operations.draftDetail') },
      { label: t('operations.statuses.published'), value: published, detail: t('operations.publishedDetail') },
    ];
  }, [calendars, t]);

  const loadData = async () => {
    setLoading(true);
    setIsError(false);

    const [calendarsRes, departmentsRes, processesRes, shiftsRes, templatesRes] = await Promise.all([
      authFetch(`${apiUrl('/api/operations/calendars/')}`),
      authFetch(`${apiUrl('/api/departments/')}`),
      authFetch(`${apiUrl('/api/processes/')}`),
      authFetch(`${apiUrl('/api/shifts/')}`),
      authFetch(`${apiUrl('/api/operations/calendar-templates/')}`),
    ]);

    if (calendarsRes.ok) setCalendars(normalizeList(await calendarsRes.json()));
    if (departmentsRes.ok) setDepartments(normalizeList(await departmentsRes.json()));
    if (processesRes.ok) setProcesses(normalizeList(await processesRes.json()));
    if (shiftsRes.ok) setShifts(normalizeList(await shiftsRes.json()));
    if (templatesRes.ok) {
      setTemplates(normalizeList(await templatesRes.json()));
    } else {
      setTemplates([]);
    }

    if (!calendarsRes.ok || !departmentsRes.ok || !processesRes.ok || !shiftsRes.ok) {
      setStatusMessage(t('operations.loadError'));
      setIsError(true);
    } else {
      if (!templatesRes.ok) {
        setStatusMessage('Calendários carregados. Templates indisponíveis neste ambiente.');
      } else {
        setStatusMessage('');
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setIsError(false);
    setStatusMessage('');

    const payload = {
      ...form,
      department: Number(form.department),
      process: form.process ? Number(form.process) : null,
      shift: form.shift ? Number(form.shift) : null,
      year: Number(form.year),
      month: Number(form.month),
      title: form.title || `${form.year}-${String(form.month).padStart(2, '0')}`,
    };

    const res = await authFetch(`${apiUrl('/api/operations/calendars/')}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('operations.calendarCreateError')));
      setIsError(true);
      setSubmitting(false);
      return;
    }

    setForm(emptyCalendar);
    setStatusMessage(t('operations.calendarCreated'));
    await loadData();
    setSubmitting(false);
  };

  const duplicateFromPrevious = async (calendarId) => {
    if (processingCalendarId || loading) return;
    const firstConfirm = window.confirm(
      'Duplicar mês anterior para este calendário? Funcionários e base operacional serão copiados de forma conservadora.'
    );
    if (!firstConfirm) return;

    setProcessingCalendarId(calendarId);
    setIsError(false);
    setStatusMessage('');
    setGeneratedTargetCalendarId(null);

    let overwrite = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await authFetch(`${apiUrl(`/api/operations/calendars/${calendarId}/duplicate-from-previous/`)}`, {
        method: 'POST',
        body: JSON.stringify({ copy_base_cells: true, overwrite }),
      });
      const data = await readJson(res);

      if (res.ok) {
        setStatusMessage(
          `Duplicação concluída: ${data?.created_assignments || 0} linhas, ${data?.created_cells || 0} células (destino #${data?.target_calendar_id})`
        );
        await loadData();
        setProcessingCalendarId(null);
        return;
      }

      if (res.status === 409 && data?.requires_confirmation && !overwrite) {
        const overwriteConfirm = window.confirm(
          `Destino já possui dados (${data?.target_assignment_count || 0} linhas, ${
            data?.target_cell_count || 0
          } células). Deseja sobrescrever?`
        );
        if (!overwriteConfirm) {
          setStatusMessage('Operação cancelada pelo usuário.');
          setProcessingCalendarId(null);
          return;
        }
        overwrite = true;
        continue;
      }

      setStatusMessage(formatApiMessage(data, 'Falha ao duplicar mês anterior.'));
      setIsError(true);
      setProcessingCalendarId(null);
      return;
    }
    setProcessingCalendarId(null);
  };

  const generateNextMonth = async (calendarId) => {
    if (processingCalendarId || loading) return;
    const firstConfirm = window.confirm(
      'Gerar próximo mês com base no calendário atual? Isso pode criar novo calendário e copiar a estrutura.'
    );
    if (!firstConfirm) return;

    setProcessingCalendarId(calendarId);
    setIsError(false);
    setStatusMessage('');
    setGeneratedTargetCalendarId(null);

    let overwriteExisting = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await authFetch(`${apiUrl(`/api/operations/calendars/${calendarId}/generate-next-month/`)}`, {
        method: 'POST',
        body: JSON.stringify({
          copy_assignments: true,
          copy_base_cells: false,
          overwrite_existing: overwriteExisting,
        }),
      });
      const data = await readJson(res);

      if (res.ok) {
        setGeneratedTargetCalendarId(data?.target_calendar_id || null);
        setStatusMessage(
          `Próximo mês ${data?.target_year}-${String(data?.target_month || '').padStart(2, '0')} pronto: ${
            data?.created_assignments || 0
          } linhas, ${data?.created_cells || 0} células (destino #${data?.target_calendar_id})`
        );
        await loadData();
        setProcessingCalendarId(null);
        return;
      }

      if (res.status === 409 && data?.requires_confirmation && !overwriteExisting) {
        const overwriteConfirm = window.confirm(
          `Próximo mês já possui dados (${data?.target_assignment_count || 0} linhas, ${
            data?.target_cell_count || 0
          } células). Deseja sobrescrever?`
        );
        if (!overwriteConfirm) {
          setStatusMessage('Operação cancelada pelo usuário.');
          setProcessingCalendarId(null);
          return;
        }
        overwriteExisting = true;
        continue;
      }

      setStatusMessage(formatApiMessage(data, 'Falha ao gerar próximo mês.'));
      setIsError(true);
      setProcessingCalendarId(null);
      return;
    }
    setProcessingCalendarId(null);
  };

  const exportCalendarExcel = async (calendar) => {
    if (loading || processingCalendarId || exportingCalendarId) return;
    setExportingCalendarId(calendar.id);
    setIsError(false);
    setStatusMessage('');
    setGeneratedTargetCalendarId(null);
    try {
      const res = await authFetch(`${apiUrl(`/api/operations/calendars/${calendar.id}/export-excel/`)}`);
      if (!res.ok) {
        const data = await readJson(res);
        setStatusMessage(formatApiMessage(data, 'Falha ao exportar Excel.'));
        setIsError(true);
        setExportingCalendarId(null);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const fallbackName = `escala_${calendar.year}_${String(calendar.month).padStart(2, '0')}.xlsx`;
      const filename = match?.[1] || fallbackName;
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      setStatusMessage(`Excel exportado: calendário #${calendar.id}`);
    } catch {
      setStatusMessage('Falha ao exportar Excel.');
      setIsError(true);
    } finally {
      setExportingCalendarId(null);
    }
  };

  const openSaveTemplateDialog = (calendar) => {
    if (loading || processingCalendarId || exportingCalendarId) return;
    setTemplateDialogCalendar(calendar);
    setTemplateDialogMode('save');
    setTemplateNeedsOverwrite(false);
    setTemplateTargetCounts({ assignments: 0, cells: 0 });
    setTemplateName(`${calendar.year}-${String(calendar.month).padStart(2, '0')} ${calendar.title || 'Template'}`);
    setTemplateDescription('');
  };

  const openApplyTemplateDialog = (calendar) => {
    if (loading || processingCalendarId || exportingCalendarId) return;
    setTemplateDialogCalendar(calendar);
    setTemplateDialogMode('apply');
    setTemplateNeedsOverwrite(false);
    setTemplateTargetCounts({ assignments: 0, cells: 0 });
    setSelectedTemplateId(templates[0]?.id ? String(templates[0].id) : '');
  };

  const closeTemplateDialog = () => {
    setTemplateDialogMode('');
    setTemplateDialogCalendar(null);
    setTemplateNeedsOverwrite(false);
    setTemplateTargetCounts({ assignments: 0, cells: 0 });
  };

  const saveCalendarTemplate = async () => {
    const calendar = templateDialogCalendar;
    if (!calendar || !templateName.trim()) return;
    setProcessingCalendarId(calendar.id);
    setIsError(false);
    setStatusMessage('');
    try {
      const res = await authFetch(`${apiUrl(`/api/operations/calendars/${calendar.id}/save-template/`)}`, {
        method: 'POST',
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim(),
          scope_from_calendar: true,
          include_base_cells: true,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setStatusMessage(formatApiMessage(data, 'Falha ao salvar template.'));
        setIsError(true);
        setProcessingCalendarId(null);
        return;
      }
      setStatusMessage(
        `Template salvo: ${data?.template_name || templateName.trim()} (${data?.created_assignments || 0} linhas, ${data?.created_cells || 0} células)`
      );
      closeTemplateDialog();
      await loadData();
    } finally {
      setProcessingCalendarId(null);
    }
  };

  const applyTemplateToCalendar = async () => {
    const calendar = templateDialogCalendar;
    if (!calendar) return;
    if (!templates.length) {
      setStatusMessage('Nenhum template disponível.');
      setIsError(true);
      return;
    }
    const templateId = Number(selectedTemplateId);
    if (!templateId) return;

    setProcessingCalendarId(calendar.id);
    setIsError(false);
    setStatusMessage('');
    const res = await authFetch(`${apiUrl(`/api/operations/calendars/${calendar.id}/apply-template/`)}`, {
      method: 'POST',
      body: JSON.stringify({ template_id: templateId, overwrite: templateNeedsOverwrite }),
    });
    const data = await readJson(res);
    if (res.ok) {
      setStatusMessage(`Template aplicado: ${data?.created_assignments || 0} linhas, ${data?.created_cells || 0} células`);
      closeTemplateDialog();
      await loadData();
      setProcessingCalendarId(null);
      return;
    }
    if (res.status === 409 && data?.requires_confirmation && !templateNeedsOverwrite) {
      setTemplateNeedsOverwrite(true);
      setTemplateTargetCounts({
        assignments: data?.target_assignment_count || 0,
        cells: data?.target_cell_count || 0,
      });
      setStatusMessage('Destino possui dados. Confirme sobrescrita para aplicar o template.');
      setIsError(false);
      setProcessingCalendarId(null);
      return;
    }
    setStatusMessage(formatApiMessage(data, 'Falha ao aplicar template.'));
    setIsError(true);
    setProcessingCalendarId(null);
  };

  return (
    <OperationsLayout
      title={t('operations.calendarsTitle')}
      subtitle={t('operations.calendarsSubtitle')}
      summary={summary}
    >
      <section className="inventory-workspace">
        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">{t('operations.newCalendar')}</p>
              <h2>{t('operations.calendarData')}</h2>
            </div>
            {statusMessage ? (
              <span className={`inventory-status ${isError ? 'error' : ''}`}>{statusMessage}</span>
            ) : null}
            {generatedTargetCalendarId ? (
              <Link className="inventory-small-button" to={`/operations/calendars/${generatedTargetCalendarId}/grid`}>
                Abrir calendário gerado
              </Link>
            ) : null}
            {templateDialogMode && templateDialogCalendar ? (
              <TemplatePanel
                mode={templateDialogMode}
                templates={templates}
                selectedTemplateId={selectedTemplateId}
                onSelectedTemplateIdChange={setSelectedTemplateId}
                templateName={templateName}
                onTemplateNameChange={setTemplateName}
                templateDescription={templateDescription}
                onTemplateDescriptionChange={setTemplateDescription}
                scopeText={`${templateDialogCalendar.department_detail?.code || '-'} / ${
                  processes.find((item) => Number(item.id) === Number(templateDialogCalendar.process))?.code || '-'
                } / ${shifts.find((item) => Number(item.id) === Number(templateDialogCalendar.shift))?.code || '-'}`}
                templateNeedsOverwrite={templateNeedsOverwrite}
                templateTargetCounts={templateTargetCounts}
                processing={processingCalendarId === templateDialogCalendar.id}
                onSave={saveCalendarTemplate}
                onApply={applyTemplateToCalendar}
                onCancel={closeTemplateDialog}
                style={{ marginTop: '10px' }}
              />
            ) : null}
          </div>

          <form className="inventory-form" onSubmit={handleSubmit}>
            <div className="inventory-form-grid">
              <label className="inventory-field">
                <span>{t('employees.department')}</span>
                <select name="department" value={form.department} onChange={updateField} required>
                  <option value="">{t('common.select')}</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.code} - {getLocalizedLabel(department, i18n)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inventory-field">
                <span>{t('employees.process')}</span>
                <select name="process" value={form.process} onChange={updateField}>
                  <option value="">{t('common.none')}</option>
                  {processes.map((process) => (
                    <option key={process.id} value={process.id}>
                      {process.code} - {getLocalizedLabel(process, i18n)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inventory-field">
                <span>{t('employees.shift')}</span>
                <select name="shift" value={form.shift} onChange={updateField}>
                  <option value="">{t('common.none')}</option>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.code} - {getLocalizedLabel(shift, i18n)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inventory-field">
                <span>{t('operations.year')}</span>
                <input min="2000" max="2100" name="year" type="number" value={form.year} onChange={updateField} />
              </label>

              <label className="inventory-field">
                <span>{t('operations.month')}</span>
                <input min="1" max="12" name="month" type="number" value={form.month} onChange={updateField} />
              </label>

              <label className="inventory-field full">
                <span>{t('operations.title')}</span>
                <input name="title" value={form.title} onChange={updateField} />
              </label>

              <label className="inventory-field full">
                <span>{t('common.notes')}</span>
                <textarea name="notes" rows={3} value={form.notes} onChange={updateField} />
              </label>
            </div>

            <div className="inventory-form-actions">
              <button className="inventory-secondary-button" type="button" onClick={() => setForm(emptyCalendar)}>
                {t('common.clear')}
              </button>
              <button className="inventory-primary-button" type="submit" disabled={submitting || loading}>
                {submitting ? t('common.creating') : t('operations.createCalendar')}
              </button>
            </div>
          </form>
        </div>

        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">{t('common.list')}</p>
              <h2>{t('operations.registeredCalendars')}</h2>
            </div>
            <div className="inventory-panel-tools">
              <button className="inventory-secondary-button" type="button" disabled={loading} onClick={loadData}>
                {loading ? t('common.refreshing') : t('common.refresh')}
              </button>
              <span className="inventory-status">{loading ? '...' : calendars.length}</span>
            </div>
          </div>

          {loading ? (
            <p className="inventory-empty-state">{t('operations.loadingCalendars')}</p>
          ) : calendars.length === 0 ? (
            <p className="inventory-empty-state">{t('operations.emptyCalendars')}</p>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table compact">
                <thead>
                  <tr>
                    <th>{t('common.id')}</th>
                    <th>{t('operations.title')}</th>
                    <th>{t('employees.department')}</th>
                    <th>{t('operations.period')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {calendars.map((calendar) => (
                    <tr key={calendar.id}>
                      <td>{calendar.id}</td>
                      <td>{calendar.title}</td>
                      <td>{calendar.department_detail?.code || calendar.department}</td>
                      <td>{calendar.year}-{String(calendar.month).padStart(2, '0')}</td>
                      <td>{t(`operations.statuses.${calendar.status}`, calendar.status)}</td>
                      <td>
                        <Link className="inventory-small-button" to={`/operations/calendars/${calendar.id}/grid`}>
                          {t('operations.openGrid')}
                        </Link>
                        <Link
                          className="inventory-small-button"
                          to={`/operations/calendars/${calendar.id}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Imprimir / PDF
                        </Link>
                        <button
                          className="inventory-small-button"
                          type="button"
                          disabled={loading || processingCalendarId === calendar.id || exportingCalendarId === calendar.id}
                          onClick={() => duplicateFromPrevious(calendar.id)}
                        >
                          Duplicar mês anterior
                        </button>
                        <button
                          className="inventory-small-button"
                          type="button"
                          disabled={loading || processingCalendarId === calendar.id || exportingCalendarId === calendar.id}
                          onClick={() => generateNextMonth(calendar.id)}
                        >
                          Gerar próximo mês
                        </button>
                        <button
                          className="inventory-small-button"
                          type="button"
                          disabled={loading || processingCalendarId === calendar.id || exportingCalendarId === calendar.id}
                          onClick={() => exportCalendarExcel(calendar)}
                        >
                          {exportingCalendarId === calendar.id ? 'Exportando...' : 'Exportar Excel'}
                        </button>
                        <button
                          className="inventory-small-button"
                          type="button"
                          disabled={loading || processingCalendarId === calendar.id || exportingCalendarId === calendar.id}
                          onClick={() => openSaveTemplateDialog(calendar)}
                        >
                          Salvar template
                        </button>
                        <button
                          className="inventory-small-button"
                          type="button"
                          disabled={loading || processingCalendarId === calendar.id || exportingCalendarId === calendar.id}
                          onClick={() => openApplyTemplateDialog(calendar)}
                        >
                          Aplicar template
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </OperationsLayout>
  );
}
