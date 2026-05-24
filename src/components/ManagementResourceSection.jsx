import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../utils/authFetch';

const API_BASE_URL = 'http://127.0.0.1:8000';

function readErrorMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  const first = Object.entries(data)[0];
  if (!first) return fallback;
  const [field, value] = first;
  const msg = Array.isArray(value) ? value[0] : value;
  return `${field}: ${msg}`;
}

export default function ManagementResourceSection({
  title,
  endpoint,
  fields,
  createDefaults = {},
  createLabel,
  readOnly = false,
  allowCreate = true,
  reloadKey = 0,
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [createForm, setCreateForm] = useState(createDefaults);
  const [editForm, setEditForm] = useState({});

  const visibleFields = useMemo(() => fields.filter((field) => !field.readOnly), [fields]);
  const optionMaps = useMemo(() => {
    const maps = {};
    fields.forEach((field) => {
      if (field.type === 'select' && Array.isArray(field.options)) {
        maps[field.name] = new Map(field.options.map((opt) => [String(opt.value), opt.label]));
      }
    });
    return maps;
  }, [fields]);

  const loadItems = async () => {
    setLoading(true);
    setIsError(false);
    const res = await authFetch(`${API_BASE_URL}${endpoint}`);
    const text = await res.text();
    const data = text ? JSON.parse(text) : [];
    if (!res.ok) {
      setStatus(readErrorMessage(data, t('management.loadError')));
      setIsError(true);
      setLoading(false);
      return;
    }
    setItems(Array.isArray(data) ? data : data?.results || []);
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, [reloadKey]);

  const onCreateChange = (name, value) => {
    setCreateForm((current) => ({ ...current, [name]: value }));
  };

  const onEditChange = (name, value) => {
    setEditForm((current) => ({ ...current, [name]: value }));
  };

  const createItem = async (event) => {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setIsError(false);
    const res = await authFetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(createForm),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      setStatus(readErrorMessage(data, t('management.createError')));
      setIsError(true);
      setSaving(false);
      return;
    }
    setStatus(t('management.saved'));
    setCreateForm(createDefaults);
    await loadItems();
    setSaving(false);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    const values = {};
    visibleFields.forEach((field) => {
      values[field.name] = item[field.name] ?? '';
    });
    setEditForm(values);
  };

  const saveEdit = async (id) => {
    if (readOnly) return;
    setSaving(true);
    setIsError(false);
    const res = await authFetch(`${API_BASE_URL}${endpoint}${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(editForm),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      setStatus(readErrorMessage(data, t('management.updateError')));
      setIsError(true);
      setSaving(false);
      return;
    }
    setStatus(t('management.saved'));
    setEditingId(null);
    await loadItems();
    setSaving(false);
  };

  return (
    <div className="inventory-panel">
      <div className="inventory-panel-header">
        <div>
          <p className="inventory-eyebrow">{t('management.settings')}</p>
          <h2>{title}</h2>
        </div>
        <div className="inventory-panel-tools">
          <button className="inventory-secondary-button" type="button" onClick={loadItems} disabled={loading}>
            {loading ? t('common.loading') : t('common.refresh')}
          </button>
        </div>
      </div>

      {status ? <span className={`inventory-status ${isError ? 'error' : ''}`}>{status}</span> : null}

      {!readOnly && allowCreate ? (
        <form className="inventory-form" onSubmit={createItem}>
          <div className="inventory-form-grid">
            {visibleFields.map((field) => (
              <label className="inventory-field" key={field.name}>
                <span>{field.label}</span>
                {field.type === 'checkbox' ? (
                  <input
                    checked={Boolean(createForm[field.name])}
                    onChange={(event) => onCreateChange(field.name, event.target.checked)}
                    type="checkbox"
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={createForm[field.name] ?? ''}
                    onChange={(event) => onCreateChange(field.name, event.target.value)}
                    required={Boolean(field.required)}
                  >
                    <option value="">{t('common.select')}</option>
                    {(field.options || []).map((option) => (
                      <option key={String(option.value)} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'color' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '8px' }}>
                    <input
                      type="color"
                      value={createForm[field.name] || '#ffffff'}
                      onChange={(event) => onCreateChange(field.name, event.target.value)}
                    />
                    <input
                      type="text"
                      value={createForm[field.name] ?? ''}
                      onChange={(event) => onCreateChange(field.name, event.target.value)}
                      required={Boolean(field.required)}
                    />
                  </div>
                ) : (
                  <input
                    type={field.type || 'text'}
                    value={createForm[field.name] ?? ''}
                    onChange={(event) => onCreateChange(field.name, event.target.value)}
                    required={Boolean(field.required)}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="inventory-form-actions">
            <button className="inventory-primary-button" type="submit" disabled={saving}>
              {saving ? t('common.saving') : createLabel || t('management.create')}
            </button>
          </div>
        </form>
      ) : null}

      <div className="inventory-table-wrap">
        <table className="inventory-table compact">
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field.name}>{field.label}</th>
              ))}
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                {fields.map((field) => (
                  <td key={`${item.id}-${field.name}`}>
                    {editingId === item.id && !field.readOnly ? (
                      field.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={Boolean(editForm[field.name])}
                          onChange={(event) => onEditChange(field.name, event.target.checked)}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={editForm[field.name] ?? ''}
                          onChange={(event) => onEditChange(field.name, event.target.value)}
                        >
                          <option value="">{t('common.select')}</option>
                          {(field.options || []).map((option) => (
                            <option key={String(option.value)} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'color' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: '8px' }}>
                          <input
                            type="color"
                            value={editForm[field.name] || '#ffffff'}
                            onChange={(event) => onEditChange(field.name, event.target.value)}
                          />
                          <input
                            type="text"
                            value={editForm[field.name] ?? ''}
                            onChange={(event) => onEditChange(field.name, event.target.value)}
                          />
                        </div>
                      ) : (
                        <input
                          type={field.type || 'text'}
                          value={editForm[field.name] ?? ''}
                          onChange={(event) => onEditChange(field.name, event.target.value)}
                        />
                      )
                    ) : field.render ? (
                      field.render(item[field.name], item)
                    ) : field.type === 'color' ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '4px',
                            border: '1px solid #9fb3bc',
                            backgroundColor: item[field.name] || '#ffffff',
                            display: 'inline-block',
                          }}
                        />
                        <span>{String(item[field.name] ?? '')}</span>
                      </div>
                    ) : field.type === 'select' ? (
                      optionMaps[field.name]?.get(String(item[field.name] ?? '')) || String(item[field.name] ?? '')
                    ) : (
                      String(item[field.name] ?? '')
                    )}
                  </td>
                ))}
                <td>
                  {readOnly ? (
                    '-'
                  ) : editingId === item.id ? (
                    <div className="inventory-row-actions">
                      <button className="inventory-small-button" type="button" onClick={() => saveEdit(item.id)}>
                        {t('common.save')}
                      </button>
                      <button className="inventory-secondary-button" type="button" onClick={() => setEditingId(null)}>
                        {t('common.cancel')}
                      </button>
                    </div>
                  ) : (
                    <button className="inventory-small-button" type="button" onClick={() => startEdit(item)}>
                      {t('common.edit')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
