import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getLocalizedLabel } from '../i18n/helpers';
import { authFetch } from '../utils/authFetch';
import OperationsLayout from './OperationsLayout';

const API_BASE_URL = 'http://127.0.0.1:8000';

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
  const [form, setForm] = useState(emptyCalendar);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

    const [calendarsRes, departmentsRes, processesRes, shiftsRes] = await Promise.all([
      authFetch(`${API_BASE_URL}/api/operations/calendars/`),
      authFetch(`${API_BASE_URL}/api/departments/`),
      authFetch(`${API_BASE_URL}/api/processes/`),
      authFetch(`${API_BASE_URL}/api/shifts/`),
    ]);

    if (calendarsRes.ok) setCalendars(normalizeList(await calendarsRes.json()));
    if (departmentsRes.ok) setDepartments(normalizeList(await departmentsRes.json()));
    if (processesRes.ok) setProcesses(normalizeList(await processesRes.json()));
    if (shiftsRes.ok) setShifts(normalizeList(await shiftsRes.json()));

    if (!calendarsRes.ok || !departmentsRes.ok || !processesRes.ok || !shiftsRes.ok) {
      setStatusMessage(t('operations.loadError'));
      setIsError(true);
    } else {
      setStatusMessage('');
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

    const res = await authFetch(`${API_BASE_URL}/api/operations/calendars/`, {
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
                        <Link className="inventory-small-button" to={`/operations/calendars/${calendar.id}/print`}>
                          {t('operations.print')}
                        </Link>
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
