import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedLabel } from '../i18n/helpers';
import { authFetch } from '../utils/authFetch';
import InventoryLayout from './InventoryLayout';

import { apiUrl } from '../config/api';

const emptyItem = {
  sku: '',
  name: '',
  category: '',
  size: '',
  color: '',
  stock_quantity: 0,
  minimum_stock: 0,
  unit_cost: 0,
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

export default function InventoryItems() {
  const { i18n, t } = useTranslation();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyItem);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const summary = useMemo(() => {
    const lowStock = items.filter((item) => item.stock_quantity <= item.minimum_stock).length;
    const totalStock = items.reduce((sum, item) => sum + Number(item.stock_quantity || 0), 0);

    return [
      { label: t('inventory.registeredItems'), value: items.length, detail: t('inventory.activeItems') },
      { label: t('inventory.totalPieces'), value: totalStock, detail: t('inventory.totalPiecesDetail') },
      { label: t('inventory.minimumStock'), value: lowStock, detail: t('inventory.minimumStockDetail') },
    ];
  }, [items, t]);

  const loadData = async () => {
    setLoading(true);
    setIsError(false);
    const [itemsRes, categoriesRes] = await Promise.all([
      authFetch(`${apiUrl('/api/inventory/items/')}`),
      authFetch(`${apiUrl('/api/inventory/categories/')}`),
    ]);

    if (!itemsRes.ok || !categoriesRes.ok) {
      setStatusMessage(t('inventory.loadError'));
      setIsError(true);
      setLoading(false);
      return;
    }

    const loadedItems = normalizeList(await itemsRes.json());
    const loadedCategories = normalizeList(await categoriesRes.json()).filter(
      (category) => category.is_active
    );
    setItems(loadedItems);
    setCategories(loadedCategories);
    setForm((current) => ({
      ...current,
      category: current.category || loadedCategories[0]?.id || '',
    }));
    setStatusMessage('');
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
      ...form,
      stock_quantity: Number(form.stock_quantity || 0),
      minimum_stock: Number(form.minimum_stock || 0),
      unit_cost: Number(form.unit_cost || 0),
    };

    const res = await authFetch(`${apiUrl('/api/inventory/items/')}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('inventory.itemCreateError')));
      setIsError(true);
      setSubmitting(false);
      return;
    }

    setForm(emptyItem);
    setStatusMessage(t('inventory.itemCreated'));
    await loadData();
    setSubmitting(false);
  };

  const categoryName = (item) => getLocalizedLabel(item.category_detail, i18n, item.category || '-');
  const isSubmitDisabled = submitting || loading || categories.length === 0;
  const stockStatus = (item) => {
    const current = Number(item.stock_quantity || 0);
    const minimum = Number(item.minimum_stock || 0);
    if (current <= 0) return { label: 'Crítico', className: 'danger' };
    if (current <= minimum) return { label: 'Baixo', className: 'warning' };
    return { label: 'OK', className: 'ok' };
  };

  return (
    <InventoryLayout
      title={t('inventory.itemsTitle')}
      subtitle={t('inventory.itemsSubtitle')}
      summary={summary}
    >
      <section className="inventory-workspace">
        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">Catálogo / Master</p>
              <h2>Cadastro técnico de uniformes</h2>
            </div>
            {statusMessage ? (
              <span className={`inventory-status ${isError ? 'error' : ''}`}>{statusMessage}</span>
            ) : null}
          </div>

          <form className="inventory-form" onSubmit={handleSubmit}>
            <div className="inventory-form-grid">
              <label className="inventory-field">
                <span>{t('inventory.sku')}</span>
                <input name="sku" value={form.sku} onChange={updateField} required />
              </label>
              <label className="inventory-field">
                <span>{t('common.name')}</span>
                <input name="name" value={form.name} onChange={updateField} required />
              </label>
              <label className="inventory-field">
                <span>{t('inventory.category')}</span>
                <select name="category" value={form.category} onChange={updateField} required>
                  <option value="">{t('common.select')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {getLocalizedLabel(category, i18n, category.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inventory-field">
                <span>{t('inventory.size')}</span>
                <input name="size" value={form.size} onChange={updateField} required />
              </label>
              <label className="inventory-field">
                <span>{t('inventory.color')}</span>
                <input name="color" value={form.color} onChange={updateField} required />
              </label>
              <label className="inventory-field">
                <span>{t('inventory.quantity')}</span>
                <input
                  min="0"
                  name="stock_quantity"
                  type="number"
                  value={form.stock_quantity}
                  onChange={updateField}
                />
              </label>
              <label className="inventory-field">
                <span>{t('inventory.minimumStock')}</span>
                <input
                  min="0"
                  name="minimum_stock"
                  type="number"
                  value={form.minimum_stock}
                  onChange={updateField}
                />
              </label>
              <label className="inventory-field">
                <span>{t('inventory.unitCost')}</span>
                <input
                  min="0"
                  name="unit_cost"
                  step="0.01"
                  type="number"
                  value={form.unit_cost}
                  onChange={updateField}
                />
              </label>
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
                onClick={() => setForm(emptyItem)}
              >
                {t('common.clear')}
              </button>
              <button className="inventory-primary-button" type="submit" disabled={isSubmitDisabled}>
                {submitting ? t('common.saving') : t('inventory.saveItem')}
              </button>
            </div>
          </form>
        </div>

        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">Estoque</p>
              <h2>Saldo operacional</h2>
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
              <span className="inventory-status">{loading ? '...' : items.length}</span>
            </div>
          </div>

          {loading ? (
            <p className="inventory-empty-state">{t('inventory.loadingItems')}</p>
          ) : items.length === 0 ? (
            <p className="inventory-empty-state">{t('inventory.emptyItems')}</p>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>{t('inventory.item')}</th>
                    <th>{t('inventory.category')}</th>
                    <th>{t('inventory.size')}</th>
                    <th>{t('inventory.color')}</th>
                    <th>{t('inventory.stock')}</th>
                    <th>{t('inventory.minimumStock')}</th>
                    <th>Status</th>
                    <th>{t('inventory.cost')}</th>
                    <th>{t('inventory.averageCost')}</th>
                    <th>{t('inventory.averagePrice')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.sku}</td>
                      <td>{item.name}</td>
                      <td>{categoryName(item)}</td>
                      <td>{item.size}</td>
                      <td>{item.color}</td>
                      <td>
                        <span
                          className={`inventory-badge ${
                            item.stock_quantity <= item.minimum_stock ? 'warning' : ''
                          }`}
                        >
                          {item.stock_quantity}
                        </span>
                      </td>
                      <td>{item.minimum_stock}</td>
                      <td>
                        <span className={`inventory-badge ${stockStatus(item).className}`}>
                          {stockStatus(item).label}
                        </span>
                      </td>
                      <td>{item.unit_cost}</td>
                      <td>{item.average_cost}</td>
                      <td>{item.average_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="inventory-panel full-width">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">Relatórios</p>
              <h2>Indicadores iniciais</h2>
            </div>
          </div>
          <div className="ops-report-grid">
            <article><span>Consumo por setor</span><strong>Em preparação</strong></article>
            <article><span>Custo mensal</span><strong>{items.reduce((sum, item) => sum + Number(item.stock_quantity || 0) * Number(item.unit_cost || 0), 0).toFixed(2)}</strong></article>
            <article><span>Itens críticos</span><strong>{items.filter((item) => stockStatus(item).className !== 'ok').length}</strong></article>
            <article><span>Doações</span><strong>Histórico futuro</strong></article>
          </div>
        </div>
      </section>
    </InventoryLayout>
  );
}
