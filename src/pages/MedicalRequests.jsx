import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedName } from '../i18n/helpers';
import { authFetch } from '../utils/authFetch';
import MedicalLayout from './MedicalLayout';

const API_BASE_URL = 'http://127.0.0.1:8000';

function getEmptyRequest() {
  return {
    employee: '',
    reason: '',
    symptoms: [],
    severity: 'low',
    started_at: '',
    has_vehicle: false,
    needs_transport: false,
    destination: '',
    description: '',
    notes: '',
  };
}

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

function formatApiMessage(data, fallback, permissionMessage) {
  if (!data) return fallback;
  if (typeof data.detail === 'string') {
    if (data.detail.includes('permission')) {
      return permissionMessage;
    }
    return data.detail;
  }

  const firstError = Object.entries(data)[0];
  if (!firstError) return fallback;

  const [field, messages] = firstError;
  const message = Array.isArray(messages) ? messages[0] : messages;
  return `${field}: ${message}`;
}

function employeeLabel(employee) {
  return employee.name_en || employee.internal_name || employee.name_jp || employee.employee_id;
}

function canRunAction(status, action) {
  const allowed = {
    triage: ['requested'],
    start: ['triaged'],
    complete: ['in_progress'],
    cancel: ['requested', 'triaged'],
  };

  return allowed[action]?.includes(status);
}

function toApiDateTime(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function MedicalRequests() {
  const { i18n, t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [form, setForm] = useState(getEmptyRequest());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const summary = useMemo(() => {
    const requested = requests.filter((request) => request.status === 'requested').length;
    const urgent = requests.filter((request) => request.severity === 'urgent').length;

    return [
      { label: t('medical.requests'), value: requests.length, detail: t('medical.loadedRecords') },
      { label: t('medical.statuses.requested'), value: requested, detail: t('medical.waitingTriage') },
      { label: t('medical.severities.urgent'), value: urgent, detail: t('medical.operationalAttention') },
    ];
  }, [requests, t]);

  const loadData = async () => {
    setLoading(true);
    setIsError(false);
    const [requestsRes, employeesRes, reasonsRes, symptomsRes, destinationsRes] = await Promise.all([
      authFetch(`${API_BASE_URL}/api/medical/requests/`),
      authFetch(`${API_BASE_URL}/api/employees/`),
      authFetch(`${API_BASE_URL}/api/medical/reasons/`),
      authFetch(`${API_BASE_URL}/api/medical/symptoms/`),
      authFetch(`${API_BASE_URL}/api/medical/destinations/`),
    ]);

    if (requestsRes.ok) setRequests(normalizeList(await requestsRes.json()));
    if (employeesRes.ok) setEmployees(normalizeList(await employeesRes.json()));
    if (reasonsRes.ok) setReasons(normalizeList(await reasonsRes.json()).filter((item) => item.is_active));
    if (symptomsRes.ok) setSymptoms(normalizeList(await symptomsRes.json()).filter((item) => item.is_active));
    if (destinationsRes.ok) {
      setDestinations(normalizeList(await destinationsRes.json()).filter((item) => item.is_active));
    }

    if (!requestsRes.ok || !employeesRes.ok || !reasonsRes.ok || !symptomsRes.ok || !destinationsRes.ok) {
      setStatusMessage(t('medical.someDataLoadError'));
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
    const { checked, name, type, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleSymptom = (symptomId) => {
    setForm((current) => {
      const exists = current.symptoms.includes(symptomId);
      return {
        ...current,
        symptoms: exists
          ? current.symptoms.filter((id) => id !== symptomId)
          : [...current.symptoms, symptomId],
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage('');
    setIsError(false);
    setSubmitting(true);

    const payload = {
      employee: form.employee,
      reason: Number(form.reason),
      symptoms: form.symptoms,
      description: form.description,
      started_at: toApiDateTime(form.started_at),
      severity: form.severity,
      has_vehicle: form.has_vehicle,
      needs_transport: form.needs_transport,
      destination: form.destination ? Number(form.destination) : null,
      requested_at: new Date().toISOString(),
      notes: form.notes,
    };

    const res = await authFetch(`${API_BASE_URL}/api/medical/requests/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('medical.requestCreateError'), t('messages.permissionDenied')));
      setIsError(true);
      setSubmitting(false);
      return;
    }

    setForm(getEmptyRequest());
    setStatusMessage(t('medical.requestCreated'));
    await loadData();
    setSubmitting(false);
  };

  const runAction = async (requestId, action) => {
    setStatusMessage('');
    setIsError(false);
    setActioning(`${requestId}-${action}`);

    const res = await authFetch(`${API_BASE_URL}/api/medical/requests/${requestId}/${action}/`, {
      method: 'POST',
      body: JSON.stringify({ note: action }),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('medical.invalidTransition'), t('messages.permissionDenied')));
      setIsError(true);
      setActioning('');
      return;
    }

    setStatusMessage(t('medical.requestUpdated'));
    await loadData();
    setActioning('');
  };

  const isSubmitDisabled = submitting || loading || employees.length === 0 || reasons.length === 0;

  return (
    <MedicalLayout
      title={t('medical.requestsTitle')}
      subtitle={t('medical.requestsSubtitle')}
      summary={summary}
    >
      <section className="inventory-workspace">
        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">{t('medical.newRequest')}</p>
              <h2>{t('medical.requestData')}</h2>
            </div>
            {statusMessage ? (
              <span className={`inventory-status ${isError ? 'error' : ''}`}>{statusMessage}</span>
            ) : null}
          </div>

          <form className="inventory-form" onSubmit={handleSubmit}>
            <div className="inventory-form-grid">
              <label className="inventory-field full">
                <span>{t('medical.employee')}</span>
                <select name="employee" value={form.employee} onChange={updateField} required>
                  <option value="">{t('common.select')}</option>
                  {employees.map((employee) => (
                    <option key={employee.employee_id} value={employee.employee_id}>
                      {employee.employee_id} - {employeeLabel(employee)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inventory-field">
                <span>{t('medical.reason')}</span>
                <select name="reason" value={form.reason} onChange={updateField} required>
                  <option value="">{t('common.select')}</option>
                  {reasons.map((reason) => (
                    <option key={reason.id} value={reason.id}>{getLocalizedName(reason, i18n)}</option>
                  ))}
                </select>
              </label>

              <label className="inventory-field">
                <span>{t('medical.severity')}</span>
                <select name="severity" value={form.severity} onChange={updateField}>
                  {['low', 'medium', 'urgent'].map((value) => (
                    <option key={value} value={value}>{t(`medical.severities.${value}`)}</option>
                  ))}
                </select>
              </label>

              <label className="inventory-field full">
                <span>{t('medical.symptoms')}</span>
                <div className="inventory-choice-grid">
                  {symptoms.map((symptom) => (
                    <label className="inventory-choice" key={symptom.id}>
                      <input
                        checked={form.symptoms.includes(symptom.id)}
                        type="checkbox"
                        onChange={() => toggleSymptom(symptom.id)}
                      />
                      <span>{getLocalizedName(symptom, i18n)}</span>
                    </label>
                  ))}
                  {symptoms.length === 0 ? (
                    <p className="inventory-muted">{t('medical.noActiveSymptoms')}</p>
                  ) : null}
                </div>
              </label>

              <label className="inventory-field">
                <span>{t('medical.startedAt')}</span>
                <input
                  name="started_at"
                  type="datetime-local"
                  value={form.started_at}
                  onChange={updateField}
                />
              </label>

              <label className="inventory-field">
                <span>{t('medical.destination')}</span>
                <select name="destination" value={form.destination} onChange={updateField}>
                  <option value="">{t('medical.noDestination')}</option>
                  {destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>{destination.name}</option>
                  ))}
                </select>
              </label>

              <label className="inventory-check-field">
                <input
                  checked={form.has_vehicle}
                  name="has_vehicle"
                  type="checkbox"
                  onChange={updateField}
                />
                <span>{t('medical.hasVehicle')}</span>
              </label>

              <label className="inventory-check-field">
                <input
                  checked={form.needs_transport}
                  name="needs_transport"
                  type="checkbox"
                  onChange={updateField}
                />
                <span>{t('medical.needsTransport')}</span>
              </label>

              <label className="inventory-field full">
                <span>{t('medical.description')}</span>
                <textarea
                  name="description"
                  rows={3}
                  value={form.description}
                  onChange={updateField}
                />
              </label>

              <label className="inventory-field full">
                <span>{t('medical.notes')}</span>
                <textarea name="notes" rows={3} value={form.notes} onChange={updateField} />
              </label>
            </div>

            <div className="inventory-form-actions">
              <button
                className="inventory-secondary-button"
                type="button"
                disabled={submitting}
                onClick={() => setForm(getEmptyRequest())}
              >
                {t('common.clear')}
              </button>
              <button className="inventory-primary-button" type="submit" disabled={isSubmitDisabled}>
                {submitting ? t('common.creating') : t('medical.newRequest')}
              </button>
            </div>
          </form>
        </div>

        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">{t('medical.workflow')}</p>
              <h2>{t('medical.medicalRequests')}</h2>
            </div>
            <div className="inventory-panel-tools">
              <button
                className="inventory-secondary-button"
                type="button"
                disabled={loading}
                onClick={loadData}
              >
                {loading ? t('common.refreshing') : t('common.refresh')}
              </button>
              <span className="inventory-status">{loading ? '...' : requests.length}</span>
            </div>
          </div>

          <div className="inventory-flow" aria-label={t('medical.workflow')}>
            <span>{t('medical.flow.requested')}</span>
            <span>{t('medical.flow.triaged')}</span>
            <span>{t('medical.flow.inProgress')}</span>
            <span>{t('medical.flow.completed')}</span>
          </div>

          {loading ? (
            <p className="inventory-empty-state">{t('medical.loadingRequests')}</p>
          ) : requests.length === 0 ? (
            <p className="inventory-empty-state">{t('medical.emptyRequests')}</p>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table compact">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t('medical.employee')}</th>
                    <th>{t('medical.reason')}</th>
                    <th>{t('medical.severity')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.id}</td>
                      <td>
                        <strong>{request.employee}</strong>
                        <br />
                        <span className="inventory-muted">
                          {request.employee_display?.name_en || request.employee_display?.name_jp || t('medical.employee')}
                        </span>
                      </td>
                      <td>{getLocalizedName(request.reason_detail, i18n, request.reason)}</td>
                      <td>
                        <span className={`inventory-badge severity-${request.severity}`}>
                          {t(`medical.severities.${request.severity}`, request.severity)}
                        </span>
                      </td>
                      <td>
                        <span className={`inventory-badge status-${request.status}`}>
                          {t(`medical.statuses.${request.status}`, request.status)}
                        </span>
                      </td>
                      <td>
                        <div className="inventory-row-actions">
                          <button
                            className="inventory-small-button"
                            type="button"
                            disabled={!canRunAction(request.status, 'triage') || Boolean(actioning)}
                            onClick={() => runAction(request.id, 'triage')}
                          >
                            {actioning === `${request.id}-triage` ? `${t('medical.triage')}...` : t('medical.triage')}
                          </button>
                          <button
                            className="inventory-small-button"
                            type="button"
                            disabled={!canRunAction(request.status, 'start') || Boolean(actioning)}
                            onClick={() => runAction(request.id, 'start')}
                          >
                            {actioning === `${request.id}-start` ? `${t('medical.start')}...` : t('medical.start')}
                          </button>
                          <button
                            className="inventory-small-button"
                            type="button"
                            disabled={!canRunAction(request.status, 'complete') || Boolean(actioning)}
                            onClick={() => runAction(request.id, 'complete')}
                          >
                            {actioning === `${request.id}-complete` ? `${t('medical.complete')}...` : t('medical.complete')}
                          </button>
                          <button
                            className="inventory-danger-button"
                            type="button"
                            disabled={!canRunAction(request.status, 'cancel') || Boolean(actioning)}
                            onClick={() => runAction(request.id, 'cancel')}
                          >
                            {actioning === `${request.id}-cancel` ? `${t('medical.cancel')}...` : t('medical.cancel')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </MedicalLayout>
  );
}
