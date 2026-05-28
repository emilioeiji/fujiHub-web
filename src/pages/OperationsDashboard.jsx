import { useEffect, useMemo, useState } from 'react';
import OperationsLayout from './OperationsLayout';
import { authFetch } from '../utils/authFetch';
import { apiUrl } from '../config/api';

const REFRESH_OPTIONS = [15, 30, 60];
const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'running', label: 'Rodando' },
  { value: 'stopped', label: 'Parado' },
  { value: 'idle', label: 'Idle' },
  { value: 'error', label: 'Erro' },
];

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function machineStatusLabel(status) {
  if (status === 'running') return 'Rodando';
  if (status === 'stopped') return 'Parado';
  if (status === 'idle') return 'Idle';
  if (status === 'error') return 'Erro';
  return status || '-';
}

function machineStatusClass(status) {
  if (status === 'running') return 'operations-monitor-status running';
  if (status === 'stopped') return 'operations-monitor-status stopped';
  if (status === 'idle') return 'operations-monitor-status idle';
  if (status === 'error') return 'operations-monitor-status error';
  return 'operations-monitor-status';
}

export default function OperationsDashboard() {
  const [processes, setProcesses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [data, setData] = useState({ snapshot: null, kpis: {}, machines: [], is_mock: false });
  const [filters, setFilters] = useState({ process: '', area: '', shift: '', status: '' });
  const [refreshSeconds, setRefreshSeconds] = useState(30);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    setIsError(false);
    const [processesRes, shiftsRes] = await Promise.all([
      authFetch(`${apiUrl('/api/processes/')}`),
      authFetch(`${apiUrl('/api/shifts/')}`),
    ]);
    if (processesRes.ok) setProcesses(normalizeList(await processesRes.json()));
    if (shiftsRes.ok) setShifts(normalizeList(await shiftsRes.json()));

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const dashboardRes = await authFetch(`${apiUrl(`/api/operations/production-snapshots/dashboard/${suffix}`)}`);
    if (!dashboardRes.ok) {
      setIsError(true);
      setStatusMessage('Falha ao carregar monitor operacional.');
      setLoading(false);
      return;
    }
    const dashboardData = await dashboardRes.json();
    setData(dashboardData);
    setStatusMessage(dashboardData?.is_mock ? 'Monitor em modo mock/fixture.' : '');
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [filters.process, filters.area, filters.shift, filters.status]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadData();
    }, refreshSeconds * 1000);
    return () => clearInterval(timer);
  }, [refreshSeconds, filters.process, filters.area, filters.shift, filters.status]);

  const summary = useMemo(() => {
    const k = data.kpis || {};
    return [
      { label: 'Produção total', value: k.production_total ?? 0, detail: 'Real acumulado' },
      { label: 'Meta total', value: k.target_total ?? 0, detail: 'Meta planejada' },
      { label: 'Kadouritsu médio', value: `${k.average_kadouritsu ?? 0}%`, detail: 'Eficiência média' },
      { label: 'Máquinas rodando', value: k.running_count ?? 0, detail: 'Status running' },
      { label: 'Máquinas paradas', value: k.stopped_count ?? 0, detail: 'Status stopped' },
      { label: 'Alarmes ativos', value: k.alarms_active ?? 0, detail: 'Atenção imediata' },
    ];
  }, [data.kpis]);

  return (
    <OperationsLayout title="Dashboard Operacional" subtitle="Monitor em tempo real da produção" summary={summary}>
      <section className="inventory-panel operations-monitor-panel">
        <div className="inventory-panel-header">
          <div>
            <p className="inventory-eyebrow">Monitor</p>
            <h2>Painel industrial</h2>
          </div>
          <div className="inventory-panel-tools">
            <button className="inventory-secondary-button" type="button" onClick={loadData} disabled={loading}>
              {loading ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </div>

        {statusMessage ? <span className={`inventory-status ${isError ? 'error' : ''}`}>{statusMessage}</span> : null}

        <div className="inventory-form-grid" style={{ marginTop: '12px' }}>
          <label className="inventory-field">
            <span>Processo</span>
            <select value={filters.process} onChange={(event) => setFilters((current) => ({ ...current, process: event.target.value }))}>
              <option value="">Todos</option>
              {processes.map((item) => (
                <option key={item.id} value={item.id}>{item.code}</option>
              ))}
            </select>
          </label>
          <label className="inventory-field">
            <span>Área</span>
            <input value={filters.area} onChange={(event) => setFilters((current) => ({ ...current, area: event.target.value }))} placeholder="Linha A, Célula 2..." />
          </label>
          <label className="inventory-field">
            <span>Turno</span>
            <select value={filters.shift} onChange={(event) => setFilters((current) => ({ ...current, shift: event.target.value }))}>
              <option value="">Todos</option>
              {shifts.map((item) => (
                <option key={item.id} value={item.id}>{item.code}</option>
              ))}
            </select>
          </label>
          <label className="inventory-field">
            <span>Status</span>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value || 'all'} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="inventory-field">
            <span>Auto refresh</span>
            <select value={refreshSeconds} onChange={(event) => setRefreshSeconds(Number(event.target.value))}>
              {REFRESH_OPTIONS.map((seconds) => (
                <option key={seconds} value={seconds}>{seconds}s</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="operations-monitor-grid">
        {(data.machines || []).map((machine) => (
          <article key={`${machine.machine_code}-${machine.id}`} className="operations-monitor-card">
            <header>
              <h3>{machine.equipment_name}</h3>
              <span className={machineStatusClass(machine.status)}>{machineStatusLabel(machine.status)}</span>
            </header>
            <p className="operations-monitor-code">{machine.machine_code}</p>
            <div className="operations-monitor-metrics">
              <span>Produção: <strong>{machine.production_actual ?? 0}</strong></span>
              <span>Meta: <strong>{machine.production_target ?? 0}</strong></span>
              <span>Diferença: <strong>{machine.difference ?? 0}</strong></span>
              <span>Kadouritsu: <strong>{machine.kadouritsu ?? 0}%</strong></span>
              <span>Rodando: <strong>{machine.run_minutes ?? 0} min</strong></span>
              <span>Parado: <strong>{machine.stop_minutes ?? 0} min</strong></span>
              <span>Última atualização: <strong>{machine.last_update_at ? new Date(machine.last_update_at).toLocaleString() : '-'}</strong></span>
            </div>
            {machine.alarm_active ? <div className="operations-monitor-alarm">Alarme ativo</div> : null}
          </article>
        ))}
      </section>
    </OperationsLayout>
  );
}
