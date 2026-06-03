import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../utils/authFetch';
import InventoryLayout from './InventoryLayout';

import { apiUrl } from '../config/api';

function getEmptyRequest() {
  return {
    employee: '',
    item: '',
    quantity: 1,
    request_type: 'donation',
    reason: '',
    request_date: new Date().toISOString().slice(0, 10),
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

function formatApiMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;

  const firstError = Object.entries(data)[0];
  if (!firstError) return fallback;

  const [field, messages] = firstError;
  const message = Array.isArray(messages) ? messages[0] : messages;
  return `${field}: ${message}`;
}

function employeeLabel(employee) {
  return employee.name_en || employee.internal_name || employee.name_jp || employee.employee_id;
}

function employeeMeta(employee) {
  return [
    employee.shift_detail?.label_jp || employee.shift_detail?.code || employee.shift || '',
    employee.process_detail?.code || employee.process_detail?.label_jp || employee.process || '',
    employee.operational_category || employee.rank || '',
  ].filter(Boolean).join(' / ');
}

function EmployeeAutocomplete({ employees, selectedId, onSelect, placeholder }) {
  const [query, setQuery] = useState('');
  const selected = employees.find((employee) => String(employee.employee_id) === String(selectedId));
  const term = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (term.length < 2) return [];
    return employees
      .filter((employee) =>
        [
          employee.employee_id,
          employee.employee_cd,
          employee.name_en,
          employee.name_jp,
          employee.name_kana,
          employee.internal_name,
          employee.nickname,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      )
      .slice(0, 8);
  }, [employees, term]);

  return (
    <div className="ops-autocomplete">
      <input
        value={query || (selected ? `${selected.employee_id} - ${employeeLabel(selected)}` : '')}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!event.target.value) onSelect('');
        }}
        onFocus={() => {
          if (selected) setQuery('');
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && filtered[0]) {
            event.preventDefault();
            onSelect(filtered[0].employee_id);
            setQuery('');
          }
          if (event.key === 'Escape') setQuery('');
        }}
        placeholder={placeholder}
      />
      {filtered.length > 0 ? (
        <div className="ops-autocomplete-menu">
          {filtered.map((employee) => (
            <button
              key={employee.employee_id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(employee.employee_id);
                setQuery('');
              }}
            >
              <strong>{employee.employee_id} - {employeeLabel(employee)}</strong>
              <small>{employeeMeta(employee) || 'Sem turno/processo'}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function canRunAction(status, action) {
  const allowed = {
    approve: ['pending'],
    separate: ['approved'],
    deliver: ['separated'],
    cancel: ['pending', 'approved'],
  };

  return allowed[action]?.includes(status);
}

export default function InventoryRequests() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(getEmptyRequest());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const employeeMap = useMemo(() => {
    return employees.reduce((acc, employee) => {
      acc[employee.employee_id] = employeeLabel(employee);
      return acc;
    }, {});
  }, [employees]);

  const summary = useMemo(() => {
    const pending = requests.filter((request) => request.status === 'pending').length;
    const approved = requests.filter((request) => request.status === 'approved').length;
    const separated = requests.filter((request) => request.status === 'separated').length;
    const criticalStock = items.filter((item) => Number(item.stock_quantity || 0) <= Number(item.minimum_stock || 0)).length;

    return [
      { label: 'Pendentes', value: pending, detail: 'Aguardando aprovação' },
      { label: 'Separação', value: approved, detail: 'Aprovadas para separar' },
      { label: 'Entrega', value: separated, detail: 'Itens separados' },
      { label: 'Estoque crítico', value: criticalStock, detail: 'Itens no mínimo' },
    ];
  }, [requests, items]);

  const loadData = async () => {
    setLoading(true);
    setIsError(false);
    const [requestsRes, itemsRes, employeesRes] = await Promise.all([
      authFetch(`${apiUrl('/api/inventory/requests/')}`),
      authFetch(`${apiUrl('/api/inventory/items/')}`),
      authFetch(`${apiUrl('/api/employees/')}`),
    ]);

    if (requestsRes.ok) setRequests(normalizeList(await requestsRes.json()));
    if (itemsRes.ok) setItems(normalizeList(await itemsRes.json()));
    if (employeesRes.ok) setEmployees(normalizeList(await employeesRes.json()));

    if (!requestsRes.ok || !itemsRes.ok || !employeesRes.ok) {
      setStatusMessage(t('inventory.someDataLoadError'));
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
    setStatusMessage('');
    setIsError(false);
    setSubmitting(true);

    const payload = {
      employee: form.employee,
      request_type: form.request_type,
      reason: form.reason,
      request_date: form.request_date,
      notes: form.notes,
      items: [
        {
          item: Number(form.item),
          quantity: Number(form.quantity || 1),
        },
      ],
    };

    const res = await authFetch(`${apiUrl('/api/inventory/requests/')}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('inventory.requestCreateError')));
      setIsError(true);
      setSubmitting(false);
      return;
    }

    setForm(getEmptyRequest());
    setStatusMessage(t('inventory.requestCreated'));
    await loadData();
    setSubmitting(false);
  };

  const runAction = async (requestId, action) => {
    setStatusMessage('');
    setIsError(false);
    setActioning(`${requestId}-${action}`);

    const res = await authFetch(`${apiUrl('/api/inventory/requests/${requestId}/${action}/')}`, {
      method: 'POST',
      body: JSON.stringify({ note: action }),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('inventory.invalidTransition')));
      setIsError(true);
      setActioning('');
      return;
    }

    setStatusMessage(t('inventory.requestUpdated'));
    await loadData();
    setActioning('');
  };

  const isSubmitDisabled = submitting || loading || employees.length === 0 || items.length === 0;
  const selectedItem = items.find((item) => String(item.id) === String(form.item));
  const estimatedTotal = selectedItem
    ? Number(selectedItem.unit_cost || 0) * Number(form.quantity || 0)
    : 0;

  return (
    <InventoryLayout
      title={t('inventory.requestsTitle')}
      subtitle={t('inventory.requestsSubtitle')}
      summary={summary}
    >
      <section className="inventory-workspace">
        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">{t('inventory.newRequest')}</p>
              <h2>{t('inventory.simpleRequest')}</h2>
            </div>
            {statusMessage ? (
              <span className={`inventory-status ${isError ? 'error' : ''}`}>{statusMessage}</span>
            ) : null}
          </div>

          <form className="inventory-form" onSubmit={handleSubmit}>
            <div className="ops-workflow-steps">
              <span className={form.employee ? 'done' : 'active'}>1. Funcionário</span>
              <span className={form.item ? 'done' : form.employee ? 'active' : ''}>2. Item</span>
              <span className={form.employee && form.item ? 'active' : ''}>3. Confirmar</span>
            </div>
            <div className="inventory-form-grid">
              <label className="inventory-field full">
                <span>{t('inventory.employee')}</span>
                <EmployeeAutocomplete
                  employees={employees}
                  selectedId={form.employee}
                  placeholder="Digite matrícula, nome, nome JP ou apelido"
                  onSelect={(employeeId) => setForm((current) => ({ ...current, employee: employeeId }))}
                />
              </label>

              <label className="inventory-field">
                <span>{t('inventory.type')}</span>
                <select name="request_type" value={form.request_type} onChange={updateField}>
                  {['donation', 'purchase'].map((value) => (
                    <option key={value} value={value}>{t(`inventory.requestTypes.${value}`)}</option>
                  ))}
                </select>
              </label>

              <label className="inventory-field">
                <span>{t('inventory.item')}</span>
                <select name="item" value={form.item} onChange={updateField} required>
                  <option value="">{t('common.select')}</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} - {item.name} / {item.size} - {item.unit_cost}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inventory-field">
                <span>{t('inventory.quantity')}</span>
                <input
                  min="1"
                  name="quantity"
                  type="number"
                  value={form.quantity}
                  onChange={updateField}
                />
              </label>

              <label className="inventory-field">
                <span>{t('common.date')}</span>
                <input
                  name="request_date"
                  type="date"
                  value={form.request_date}
                  onChange={updateField}
                  required
                />
              </label>

              <label className="inventory-field">
                <span>{t('inventory.reason')}</span>
                <input
                  name="reason"
                  value={form.reason}
                  onChange={updateField}
                  required={form.request_type === 'donation'}
                />
              </label>

              <div className="inventory-cost-preview">
                <span>{t('inventory.estimatedCost')}</span>
                <strong>{estimatedTotal.toFixed(2)}</strong>
                <small>
                  {selectedItem ? `${selectedItem.unit_cost} x ${form.quantity || 0}` : t('inventory.selectItem')}
                </small>
              </div>

              <div className="ops-confirm-card">
                <span>Resumo</span>
                <strong>{form.employee ? employeeMap[form.employee] || form.employee : 'Funcionário não selecionado'}</strong>
                <small>{selectedItem ? `${selectedItem.sku} - ${selectedItem.name} x ${form.quantity}` : 'Item não selecionado'}</small>
              </div>

              <label className="inventory-field full">
                <span>{t('common.notes')}</span>
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
                {submitting ? t('common.creating') : t('inventory.createRequest')}
              </button>
            </div>
          </form>
        </div>

        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">{t('inventory.workflow')}</p>
              <h2>{t('inventory.registeredRequests')}</h2>
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

          {loading ? (
            <p className="inventory-empty-state">{t('inventory.loadingRequests')}</p>
          ) : requests.length === 0 ? (
            <p className="inventory-empty-state">{t('inventory.emptyRequests')}</p>
          ) : (
            <>
            <div className="ops-request-lane">
              {['pending', 'approved', 'separated'].map((statusKey) => (
                <section key={statusKey}>
                  <strong>{t(`inventory.statuses.${statusKey}`, statusKey)}</strong>
                  {requests.filter((request) => request.status === statusKey).slice(0, 4).map((request) => (
                    <article key={request.id} className="ops-request-card">
                      <div>
                        <span className={`inventory-badge status-${request.status}`}>{t(`inventory.statuses.${request.status}`, request.status)}</span>
                        <strong>{employeeMap[request.employee] || request.employee}</strong>
                        <small>{request.items?.[0]?.item_detail?.sku || request.items?.[0]?.item || '-'} x {request.items?.[0]?.quantity || 0}</small>
                      </div>
                      <div className="inventory-row-actions">
                        {canRunAction(request.status, 'approve') ? <button className="inventory-small-button" type="button" disabled={Boolean(actioning)} onClick={() => runAction(request.id, 'approve')}>Aprovar</button> : null}
                        {canRunAction(request.status, 'separate') ? <button className="inventory-small-button" type="button" disabled={Boolean(actioning)} onClick={() => runAction(request.id, 'separate')}>Separar</button> : null}
                        {canRunAction(request.status, 'deliver') ? <button className="inventory-small-button" type="button" disabled={Boolean(actioning)} onClick={() => runAction(request.id, 'deliver')}>Entregar</button> : null}
                      </div>
                    </article>
                  ))}
                </section>
              ))}
            </div>
            <div className="inventory-table-wrap">
              <table className="inventory-table compact">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t('inventory.employee')}</th>
                    <th>{t('inventory.type')}</th>
                    <th>{t('inventory.items')}</th>
                    <th>{t('common.total')}</th>
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
                          {employeeMap[request.employee] || t('inventory.employee')}
                        </span>
                      </td>
                      <td>{t(`inventory.requestTypes.${request.request_type}`, request.request_type)}</td>
                      <td>
                        {request.items?.map((requestItem) => (
                          <div key={requestItem.id || requestItem.item}>
                            {requestItem.item_detail?.sku || requestItem.item} x {requestItem.quantity}
                            <br />
                            <span className="inventory-muted">
                              {requestItem.unit_cost_snapshot} / {requestItem.total_cost}
                            </span>
                          </div>
                        ))}
                      </td>
                      <td>{request.total_cost}</td>
                      <td>
                        <span className={`inventory-badge status-${request.status}`}>
                          {t(`inventory.statuses.${request.status}`, request.status)}
                        </span>
                      </td>
                      <td>
                        <div className="inventory-row-actions">
                          <button
                            className="inventory-small-button"
                            type="button"
                            disabled={!canRunAction(request.status, 'approve') || Boolean(actioning)}
                            onClick={() => runAction(request.id, 'approve')}
                          >
                            {actioning === `${request.id}-approve` ? `${t('inventory.approve')}...` : t('inventory.approve')}
                          </button>
                          <button
                            className="inventory-small-button"
                            type="button"
                            disabled={!canRunAction(request.status, 'separate') || Boolean(actioning)}
                            onClick={() => runAction(request.id, 'separate')}
                          >
                            {actioning === `${request.id}-separate` ? `${t('inventory.separate')}...` : t('inventory.separate')}
                          </button>
                          <button
                            className="inventory-small-button"
                            type="button"
                            disabled={!canRunAction(request.status, 'deliver') || Boolean(actioning)}
                            onClick={() => runAction(request.id, 'deliver')}
                          >
                            {actioning === `${request.id}-deliver` ? `${t('inventory.deliver')}...` : t('inventory.deliver')}
                          </button>
                          <button
                            className="inventory-danger-button"
                            type="button"
                            disabled={!canRunAction(request.status, 'cancel') || Boolean(actioning)}
                            onClick={() => runAction(request.id, 'cancel')}
                          >
                            {actioning === `${request.id}-cancel` ? `${t('inventory.cancel')}...` : t('inventory.cancel')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </section>
    </InventoryLayout>
  );
}
