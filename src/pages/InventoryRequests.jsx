import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../utils/authFetch';
import InventoryLayout from './InventoryLayout';

const API_BASE_URL = 'http://127.0.0.1:8000';

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

const statusLabels = {
  pending: 'Pendente',
  approved: 'Aprovado',
  separated: 'Separado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const requestTypeLabels = {
  donation: 'Doação',
  purchase: 'Compra',
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

function employeeLabel(employee) {
  return employee.name_en || employee.internal_name || employee.name_jp || employee.employee_id;
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
    const separated = requests.filter((request) => request.status === 'separated').length;

    return [
      { label: 'Solicitações', value: requests.length, detail: 'Registros carregados' },
      { label: 'Pendentes', value: pending, detail: 'Aguardando aprovação' },
      { label: 'Separadas', value: separated, detail: 'Prontas para entrega' },
    ];
  }, [requests]);

  const loadData = async () => {
    setLoading(true);
    setIsError(false);
    const [requestsRes, itemsRes, employeesRes] = await Promise.all([
      authFetch(`${API_BASE_URL}/api/inventory/requests/`),
      authFetch(`${API_BASE_URL}/api/inventory/items/`),
      authFetch(`${API_BASE_URL}/api/employees/`),
    ]);

    if (requestsRes.ok) setRequests(normalizeList(await requestsRes.json()));
    if (itemsRes.ok) setItems(normalizeList(await itemsRes.json()));
    if (employeesRes.ok) setEmployees(normalizeList(await employeesRes.json()));

    if (!requestsRes.ok || !itemsRes.ok || !employeesRes.ok) {
      setStatusMessage('Alguns dados não puderam ser carregados.');
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

    const res = await authFetch(`${API_BASE_URL}/api/inventory/requests/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Sem permissão ou dados inválidos para criar solicitação.'));
      setIsError(true);
      setSubmitting(false);
      return;
    }

    setForm(getEmptyRequest());
    setStatusMessage('Solicitação criada com sucesso.');
    await loadData();
    setSubmitting(false);
  };

  const runAction = async (requestId, action) => {
    setStatusMessage('');
    setIsError(false);
    setActioning(`${requestId}-${action}`);

    const res = await authFetch(`${API_BASE_URL}/api/inventory/requests/${requestId}/${action}/`, {
      method: 'POST',
      body: JSON.stringify({ note: `Ação ${action} executada pela tela web` }),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Sem permissão ou transição inválida.'));
      setIsError(true);
      setActioning('');
      return;
    }

    setStatusMessage('Solicitação atualizada.');
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
              <p className="inventory-eyebrow">Nova solicitação</p>
              <h2>Pedido simples</h2>
            </div>
            {statusMessage ? (
              <span className={`inventory-status ${isError ? 'error' : ''}`}>{statusMessage}</span>
            ) : null}
          </div>

          <form className="inventory-form" onSubmit={handleSubmit}>
            <div className="inventory-form-grid">
              <label className="inventory-field full">
                <span>Funcionário</span>
                <select name="employee" value={form.employee} onChange={updateField} required>
                  <option value="">Selecione</option>
                  {employees.map((employee) => (
                    <option key={employee.employee_id} value={employee.employee_id}>
                      {employee.employee_id} - {employeeLabel(employee)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inventory-field">
                <span>Tipo</span>
                <select name="request_type" value={form.request_type} onChange={updateField}>
                  {Object.entries(requestTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="inventory-field">
                <span>Item</span>
                <select name="item" value={form.item} onChange={updateField} required>
                  <option value="">Selecione</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} - {item.name} / {item.size} - {item.unit_cost}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inventory-field">
                <span>Quantidade</span>
                <input
                  min="1"
                  name="quantity"
                  type="number"
                  value={form.quantity}
                  onChange={updateField}
                />
              </label>

              <label className="inventory-field">
                <span>Data</span>
                <input
                  name="request_date"
                  type="date"
                  value={form.request_date}
                  onChange={updateField}
                  required
                />
              </label>

              <label className="inventory-field">
                <span>Motivo</span>
                <input
                  name="reason"
                  value={form.reason}
                  onChange={updateField}
                  required={form.request_type === 'donation'}
                />
              </label>

              <div className="inventory-cost-preview">
                <span>Custo estimado</span>
                <strong>{estimatedTotal.toFixed(2)}</strong>
                <small>
                  {selectedItem ? `${selectedItem.unit_cost} x ${form.quantity || 0}` : 'Selecione um item'}
                </small>
              </div>

              <label className="inventory-field full">
                <span>Observações</span>
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
                Limpar
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
              <p className="inventory-eyebrow">Workflow</p>
              <h2>Solicitações cadastradas</h2>
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
            <p className="inventory-empty-state">Carregando solicitações...</p>
          ) : requests.length === 0 ? (
            <p className="inventory-empty-state">Nenhuma solicitação cadastrada.</p>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table compact">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Funcionário</th>
                    <th>Tipo</th>
                    <th>Itens</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Ações</th>
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
                          {employeeMap[request.employee] || 'Funcionário'}
                        </span>
                      </td>
                      <td>{requestTypeLabels[request.request_type] || request.request_type}</td>
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
                          {statusLabels[request.status] || request.status}
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
          )}
        </div>
      </section>
    </InventoryLayout>
  );
}
