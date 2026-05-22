import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../utils/authFetch';
import MedicalLayout from './MedicalLayout';

const API_BASE_URL = 'http://127.0.0.1:8000';

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

function formatApiMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data.detail === 'string') {
    if (data.detail.includes('permission')) {
      return 'Seu perfil não tem permissão para alterar estes cadastros.';
    }
    return data.detail;
  }

  const firstError = Object.entries(data)[0];
  if (!firstError) return fallback;

  const [field, messages] = firstError;
  const message = Array.isArray(messages) ? messages[0] : messages;
  return `${field}: ${message}`;
}

function MasterDataTable({ columns, items, title }) {
  return (
    <div className="inventory-panel">
      <div className="inventory-panel-header">
        <div>
          <p className="inventory-eyebrow">Lista</p>
          <h2>{title}</h2>
        </div>
        <span className="inventory-status">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="inventory-empty-state">Nenhum cadastro encontrado.</p>
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
      authFetch(`${API_BASE_URL}/api/medical/reasons/`),
      authFetch(`${API_BASE_URL}/api/medical/symptoms/`),
      authFetch(`${API_BASE_URL}/api/medical/destinations/`),
    ]);

    if (reasonsRes.ok) setReasons(normalizeList(await reasonsRes.json()));
    if (symptomsRes.ok) setSymptoms(normalizeList(await symptomsRes.json()));
    if (destinationsRes.ok) setDestinations(normalizeList(await destinationsRes.json()));

    if (!reasonsRes.ok || !symptomsRes.ok || !destinationsRes.ok) {
      setStatusMessage('Não foi possível carregar todos os cadastros médicos.');
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

    const res = await authFetch(`${API_BASE_URL}/api/medical/${endpoint}/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, `Revise os campos para cadastrar ${label}.`));
      setIsError(true);
      setSubmitting('');
      return;
    }

    reset();
    setStatusMessage(`${label} cadastrado com sucesso.`);
    await loadData();
    setSubmitting('');
  };

  return (
    <MedicalLayout
      title={t('medical.masterTitle')}
      subtitle={t('medical.masterSubtitle')}
      summary={[
        { label: 'Motivos', value: reasons.length, detail: 'Tipos de solicitação' },
        { label: 'Sintomas', value: symptoms.length, detail: 'Lista selecionável' },
        { label: 'Destinos', value: destinations.length, detail: 'Locais de atendimento' },
      ]}
    >
      <section className="inventory-workspace">
        <div className="inventory-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">Novo cadastro</p>
              <h2>Master data</h2>
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
              submitMasterData(event, 'reasons', reasonForm, () => setReasonForm(emptyReason), 'motivo')
            }
          >
            <div className="inventory-form-grid">
              <label className="inventory-field">
                <span>Código do motivo</span>
                <input name="code" value={reasonForm.code} onChange={updateForm(setReasonForm)} required />
              </label>
              <label className="inventory-field">
                <span>Nome PT</span>
                <input name="name_pt" value={reasonForm.name_pt} onChange={updateForm(setReasonForm)} required />
              </label>
              <label className="inventory-field">
                <span>Nome JP</span>
                <input name="name_jp" value={reasonForm.name_jp} onChange={updateForm(setReasonForm)} required />
              </label>
            </div>
            <div className="inventory-form-actions">
              <button className="inventory-primary-button" type="submit" disabled={Boolean(submitting)}>
                {submitting === 'reasons' ? 'Salvando...' : 'Cadastrar motivo'}
              </button>
            </div>
          </form>

          <form
            className="inventory-form"
            onSubmit={(event) =>
              submitMasterData(event, 'symptoms', symptomForm, () => setSymptomForm(emptySymptom), 'sintoma')
            }
          >
            <div className="inventory-form-grid">
              <label className="inventory-field">
                <span>Código do sintoma</span>
                <input name="code" value={symptomForm.code} onChange={updateForm(setSymptomForm)} required />
              </label>
              <label className="inventory-field">
                <span>Nome PT</span>
                <input name="name_pt" value={symptomForm.name_pt} onChange={updateForm(setSymptomForm)} required />
              </label>
              <label className="inventory-field">
                <span>Nome JP</span>
                <input name="name_jp" value={symptomForm.name_jp} onChange={updateForm(setSymptomForm)} required />
              </label>
            </div>
            <div className="inventory-form-actions">
              <button className="inventory-primary-button" type="submit" disabled={Boolean(submitting)}>
                {submitting === 'symptoms' ? 'Salvando...' : 'Cadastrar sintoma'}
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
                'destino'
              )
            }
          >
            <div className="inventory-form-grid">
              <label className="inventory-field">
                <span>Código do destino</span>
                <input
                  name="code"
                  value={destinationForm.code}
                  onChange={updateForm(setDestinationForm)}
                  required
                />
              </label>
              <label className="inventory-field">
                <span>Nome</span>
                <input name="name" value={destinationForm.name} onChange={updateForm(setDestinationForm)} required />
              </label>
              <label className="inventory-field">
                <span>Endereço</span>
                <input name="address" value={destinationForm.address} onChange={updateForm(setDestinationForm)} />
              </label>
              <label className="inventory-field">
                <span>Telefone</span>
                <input name="phone" value={destinationForm.phone} onChange={updateForm(setDestinationForm)} />
              </label>
            </div>
            <div className="inventory-form-actions">
              <button className="inventory-primary-button" type="submit" disabled={Boolean(submitting)}>
                {submitting === 'destinations' ? 'Salvando...' : 'Cadastrar destino'}
              </button>
            </div>
          </form>
        </div>

        <div className="inventory-stack">
          <MasterDataTable
            title="Motivos"
            items={reasons}
            columns={[
              { key: 'code', label: 'Código' },
              { key: 'name_pt', label: 'Nome PT' },
              { key: 'name_jp', label: 'Nome JP' },
            ]}
          />
          <MasterDataTable
            title="Sintomas"
            items={symptoms}
            columns={[
              { key: 'code', label: 'Código' },
              { key: 'name_pt', label: 'Nome PT' },
              { key: 'name_jp', label: 'Nome JP' },
            ]}
          />
          <MasterDataTable
            title="Destinos"
            items={destinations}
            columns={[
              { key: 'code', label: 'Código' },
              { key: 'name', label: 'Nome' },
              { key: 'phone', label: 'Telefone' },
            ]}
          />
        </div>
      </section>
    </MedicalLayout>
  );
}
