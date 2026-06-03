import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../utils/authFetch';
import MedicalLayout from './MedicalLayout';

import { apiUrl } from '../config/api';

const emptyReason = { code: '', name_pt: '', name_jp: '' };
const emptySymptom = { code: '', name_pt: '', name_jp: '' };
const emptyDestination = { code: '', name: '', address: '', phone: '' };

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

function MasterDataTable({ columns, emptyMessage, items, title, t }) {
  return (
    <div className="inventory-panel">
      <div className="inventory-panel-header">
        <div>
          <p className="inventory-eyebrow">{t('medical.master.list')}</p>
          <h2>{title}</h2>
        </div>
        <span className="inventory-status">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="inventory-empty-state">{emptyMessage}</p>
      ) : (
        <div className="inventory-table-wrap">
          <table className="inventory-table compact">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  {columns.map((column) => (
                    <td key={column.key}>{item[column.key] || '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function MedicalMasterData() {
  const { t } = useTranslation();
  const [reasons, setReasons] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [reasonForm, setReasonForm] = useState(emptyReason);
  const [symptomForm, setSymptomForm] = useState(emptySymptom);
  const [destinationForm, setDestinationForm] = useState(emptyDestination);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setIsError(false);
    const [reasonsRes, symptomsRes, destinationsRes] = await Promise.all([
      authFetch(`${apiUrl('/api/medical/reasons/')}`),
      authFetch(`${apiUrl('/api/medical/symptoms/')}`),
      authFetch(`${apiUrl('/api/medical/destinations/')}`),
    ]);

    if (reasonsRes.ok) setReasons(normalizeList(await reasonsRes.json()));
    if (symptomsRes.ok) setSymptoms(normalizeList(await symptomsRes.json()));
    if (destinationsRes.ok) setDestinations(normalizeList(await destinationsRes.json()));

    if (!reasonsRes.ok || !symptomsRes.ok || !destinationsRes.ok) {
      setStatusMessage(t('medical.master.loadError'));
      setIsError(true);
    } else {
      setStatusMessage('');
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateForm = (setter) => (event) => {
    const { name, value } = event.target;
    setter((current) => ({ ...current, [name]: value }));
  };

  const submitMasterData = async (event, endpoint, payload, reset, label) => {
    event.preventDefault();
    setStatusMessage('');
    setIsError(false);
    setSubmitting(endpoint);

    const res = await authFetch(`${apiUrl('/api/medical/${endpoint}/')}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(
        data,
        t('medical.master.createError', { label }),
        t('messages.permissionDeniedMasterData')
      ));
      setIsError(true);
      setSubmitting('');
      return;
    }

    reset();
    setStatusMessage(t('medical.master.created', { label }));
    await loadData();
    setSubmitting('');
  };

  return (
    <MedicalLayout
      title={t('medical.masterTitle')}
      subtitle={t('medical.masterSubtitle')}
      summary={[
        { label: t('medical.master.reasons'), value: reasons.length, detail: t('medical.master.requestTypes') },
        { label: t('medical.master.symptoms'), value: symptoms.length, detail: t('medical.master.selectableList') },
        { label: t('medical.master.destinations'), value: destinations.length, detail: t('medical.master.servicePlaces') },
      ]}
    >
      <section className="inventory-workspace">
        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">Cadastros</p>
              <h2>Motivos, sintomas e destinos</h2>
            </div>
            <div className="inventory-panel-tools">
              {statusMessage ? (
                <span className={`inventory-status ${isError ? 'error' : ''}`}>{statusMessage}</span>
              ) : null}
              <button className="inventory-secondary-button" type="button" disabled={loading} onClick={loadData}>
                {loading ? t('common.refreshing') : t('common.refresh')}
              </button>
            </div>
          </div>

          <form
            className="inventory-form"
            onSubmit={(event) =>
              submitMasterData(event, 'reasons', reasonForm, () => setReasonForm(emptyReason), t('medical.master.reason'))
            }
          >
            <div className="inventory-form-grid">
              <label className="inventory-field">
                <span>{t('medical.master.reasonCode')}</span>
                <input name="code" value={reasonForm.code} onChange={updateForm(setReasonForm)} required />
              </label>
              <label className="inventory-field">
                <span>{t('medical.master.namePt')}</span>
                <input name="name_pt" value={reasonForm.name_pt} onChange={updateForm(setReasonForm)} required />
              </label>
              <label className="inventory-field">
                <span>{t('medical.master.nameJp')}</span>
                <input name="name_jp" value={reasonForm.name_jp} onChange={updateForm(setReasonForm)} required />
              </label>
            </div>
            <div className="inventory-form-actions">
              <button className="inventory-primary-button" type="submit" disabled={Boolean(submitting)}>
                {submitting === 'reasons' ? t('common.saving') : t('medical.master.createReason')}
              </button>
            </div>
          </form>

          <form
            className="inventory-form"
            onSubmit={(event) =>
              submitMasterData(event, 'symptoms', symptomForm, () => setSymptomForm(emptySymptom), t('medical.master.symptom'))
            }
          >
            <div className="inventory-form-grid">
              <label className="inventory-field">
                <span>{t('medical.master.symptomCode')}</span>
                <input name="code" value={symptomForm.code} onChange={updateForm(setSymptomForm)} required />
              </label>
              <label className="inventory-field">
                <span>{t('medical.master.namePt')}</span>
                <input name="name_pt" value={symptomForm.name_pt} onChange={updateForm(setSymptomForm)} required />
              </label>
              <label className="inventory-field">
                <span>{t('medical.master.nameJp')}</span>
                <input name="name_jp" value={symptomForm.name_jp} onChange={updateForm(setSymptomForm)} required />
              </label>
            </div>
            <div className="inventory-form-actions">
              <button className="inventory-primary-button" type="submit" disabled={Boolean(submitting)}>
                {submitting === 'symptoms' ? t('common.saving') : t('medical.master.createSymptom')}
              </button>
            </div>
          </form>

          <form
            className="inventory-form"
            onSubmit={(event) =>
              submitMasterData(
                event,
                'destinations',
                destinationForm,
                () => setDestinationForm(emptyDestination),
                t('medical.master.destination')
              )
            }
          >
            <div className="inventory-form-grid">
              <label className="inventory-field">
                <span>{t('medical.master.destinationCode')}</span>
                <input
                  name="code"
                  value={destinationForm.code}
                  onChange={updateForm(setDestinationForm)}
                  required
                />
              </label>
              <label className="inventory-field">
                <span>{t('common.name')}</span>
                <input name="name" value={destinationForm.name} onChange={updateForm(setDestinationForm)} required />
              </label>
              <label className="inventory-field">
                <span>{t('medical.master.address')}</span>
                <input name="address" value={destinationForm.address} onChange={updateForm(setDestinationForm)} />
              </label>
              <label className="inventory-field">
                <span>{t('medical.master.phone')}</span>
                <input name="phone" value={destinationForm.phone} onChange={updateForm(setDestinationForm)} />
              </label>
            </div>
            <div className="inventory-form-actions">
              <button className="inventory-primary-button" type="submit" disabled={Boolean(submitting)}>
                {submitting === 'destinations' ? t('common.saving') : t('medical.master.createDestination')}
              </button>
            </div>
          </form>
        </div>

        <div className="inventory-stack">
          <div className="ops-master-tabs">
            <span>Motivos</span>
            <span>Sintomas</span>
            <span>Destinos</span>
          </div>
          <MasterDataTable
            title={t('medical.master.reasons')}
            emptyMessage={t('medical.master.empty')}
            t={t}
            items={reasons}
            columns={[
              { key: 'code', label: t('common.code') },
              { key: 'name_pt', label: t('medical.master.namePt') },
              { key: 'name_jp', label: t('medical.master.nameJp') },
            ]}
          />
          <MasterDataTable
            title={t('medical.master.symptoms')}
            emptyMessage={t('medical.master.empty')}
            t={t}
            items={symptoms}
            columns={[
              { key: 'code', label: t('common.code') },
              { key: 'name_pt', label: t('medical.master.namePt') },
              { key: 'name_jp', label: t('medical.master.nameJp') },
            ]}
          />
          <MasterDataTable
            title={t('medical.master.destinations')}
            emptyMessage={t('medical.master.empty')}
            t={t}
            items={destinations}
            columns={[
              { key: 'code', label: t('common.code') },
              { key: 'name', label: t('common.name') },
              { key: 'phone', label: t('medical.master.phone') },
            ]}
          />
        </div>
        <div className="inventory-panel full-width">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">Relatórios</p>
              <h2>Indicadores iniciais</h2>
            </div>
          </div>
          <div className="ops-report-grid">
            <article><span>Atendimentos por setor</span><strong>Em preparação</strong></article>
            <article><span>Sintomas recorrentes</span><strong>{symptoms.length}</strong></article>
            <article><span>Acidentes</span><strong>Filtro futuro</strong></article>
            <article><span>Urgências</span><strong>Fila médica</strong></article>
          </div>
        </div>
      </section>
    </MedicalLayout>
  );
}
