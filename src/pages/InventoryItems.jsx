import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../utils/authFetch';
import InventoryLayout from './InventoryLayout';

const API_BASE_URL = 'http://127.0.0.1:8000';

const emptyItem = {
  sku: '',
  name: '',
  category: '',
  size: '',
  color: '',
  stock_quantity: 0,
  minimum_stock: 0,
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
      { label: 'Itens cadastrados', value: items.length, detail: 'Uniformes ativos no cadastro' },
      { label: 'Peças em estoque', value: totalStock, detail: 'Soma das quantidades atuais' },
      { label: 'Estoque mínimo', value: lowStock, detail: 'Itens em ponto de atenção' },
    ];
  }, [items]);

  const loadData = async () => {
    setLoading(true);
    setIsError(false);
    const [itemsRes, categoriesRes] = await Promise.all([
      authFetch(`${API_BASE_URL}/api/inventory/items/`),
      authFetch(`${API_BASE_URL}/api/inventory/categories/`),
    ]);

    if (!itemsRes.ok || !categoriesRes.ok) {
      setStatusMessage('Não foi possível carregar os dados de uniformes.');
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
    };

    const res = await authFetch(`${API_BASE_URL}/api/inventory/items/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Sem permissão ou dados inválidos para cadastrar item.'));
      setIsError(true);
      setSubmitting(false);
      return;
    }

    setForm(emptyItem);
    setStatusMessage('Item cadastrado com sucesso.');
    await loadData();
    setSubmitting(false);
  };

  const categoryName = (item) => item.category_detail?.name || item.category || '-';
  const isSubmitDisabled = submitting || loading || categories.length === 0;

  return (
    <InventoryLayout
      title="Uniformes e estoque"
      subtitle="Cadastro inicial de peças, tamanhos, cores e níveis mínimos para o fluxo de solicitações."
      summary={summary}
    >
      <section className="inventory-workspace">
        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">Novo item</p>
              <h2>Cadastro de uniforme</h2>
            </div>
            {statusMessage ? (
              <span className={`inventory-status ${isError ? 'error' : ''}`}>{statusMessage}</span>
            ) : null}
          </div>

          <form className="inventory-form" onSubmit={handleSubmit}>
            <div className="inventory-form-grid">
              <label className="inventory-field">
                <span>SKU/código</span>
                <input name="sku" value={form.sku} onChange={updateField} required />
              </label>
              <label className="inventory-field">
                <span>Nome</span>
                <input name="name" value={form.name} onChange={updateField} required />
              </label>
              <label className="inventory-field">
                <span>Categoria</span>
                <select name="category" value={form.category} onChange={updateField} required>
                  <option value="">Selecione</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <label className="inventory-field">
                <span>Tamanho</span>
                <input name="size" value={form.size} onChange={updateField} required />
              </label>
              <label className="inventory-field">
                <span>Cor</span>
                <input name="color" value={form.color} onChange={updateField} required />
              </label>
              <label className="inventory-field">
                <span>Quantidade</span>
                <input
                  min="0"
                  name="stock_quantity"
                  type="number"
                  value={form.stock_quantity}
                  onChange={updateField}
                />
              </label>
              <label className="inventory-field">
                <span>Estoque mínimo</span>
                <input
                  min="0"
                  name="minimum_stock"
                  type="number"
                  value={form.minimum_stock}
                  onChange={updateField}
                />
              </label>
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
                onClick={() => setForm(emptyItem)}
              >
                Limpar
              </button>
              <button className="inventory-primary-button" type="submit" disabled={isSubmitDisabled}>
                {submitting ? 'Salvando...' : 'Salvar item'}
              </button>
            </div>
          </form>
        </div>

        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">Estoque</p>
              <h2>Itens cadastrados</h2>
            </div>
            <div className="inventory-panel-tools">
              <button
                className="inventory-secondary-button"
                type="button"
                disabled={loading}
                onClick={loadData}
              >
                {loading ? 'Atualizando...' : 'Atualizar lista'}
              </button>
              <span className="inventory-status">{loading ? '...' : items.length}</span>
            </div>
          </div>

          {loading ? (
            <p className="inventory-empty-state">Carregando itens...</p>
          ) : items.length === 0 ? (
            <p className="inventory-empty-state">Nenhum item de uniforme cadastrado.</p>
          ) : (
            <div className="inventory-table-wrap">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Item</th>
                    <th>Categoria</th>
                    <th>Tamanho</th>
                    <th>Cor</th>
                    <th>Estoque</th>
                    <th>Mínimo</th>
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
