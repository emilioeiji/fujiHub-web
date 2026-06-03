import { useEffect, useMemo, useState } from 'react';
import OperationsLayout from './OperationsLayout';
import { authFetch } from '../utils/authFetch';
import { apiUrl } from '../config/api';
import { useOperationPermissions } from '../hooks/useOperationPermissions';
import PermissionNotice from '../components/PermissionNotice';
import { forbiddenMessage, readonlyMessage, requestAccessMessage } from '../utils/apiErrors';

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function alertClass(level) {
  if (level === 'critical') return 'operations-monitor-alarm';
  return 'hikitsugui-badge priority-high';
}

function timecardAlertClass(level) {
  if (level === 'critical') return 'operations-monitor-alarm';
  if (level === 'warning') return 'hikitsugui-badge priority-high';
  return 'hikitsugui-badge category-neutral';
}

function timecardFilterButtonClass(active) {
  return `inventory-secondary-button operations-timecard-chip${active ? ' active' : ''}`;
}

function formatHours(value) {
  const numeric = Number(value ?? 0);
  if (Number.isNaN(numeric)) return '-';
  return `${numeric.toFixed(2)}h`;
}

function timecardTypeLabel(type) {
  const labels = {
    missing_timecard: 'Sem ponto',
    worked_on_day_off: 'Trabalho em folga',
    late: 'Atraso',
    early_leave: 'Saída antecipada',
    overtime_mismatch: 'HE divergente',
    work_minutes_mismatch: 'Jornada divergente',
    timecard_without_calendar_cell: 'Sem célula na escala',
  };
  return labels[type] || type || '-';
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function OperationsAttendanceDashboard() {
  const { flags } = useOperationPermissions();
  const [departments, setDepartments] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [settingsForm, setSettingsForm] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeDetail, setEmployeeDetail] = useState(null);
  const [employeeDetailLoading, setEmployeeDetailLoading] = useState(false);
  const [employeeDetailError, setEmployeeDetailError] = useState('');
  const [isEmployeeDrawerOpen, setIsEmployeeDrawerOpen] = useState(false);
  const [showAdminNoteForm, setShowAdminNoteForm] = useState(false);
  const [savingAdminNote, setSavingAdminNote] = useState(false);
  const [selectedTimecardIssue, setSelectedTimecardIssue] = useState(null);
  const [showTimecardImport, setShowTimecardImport] = useState(false);
  const [timecardImportFile, setTimecardImportFile] = useState(null);
  const [timecardImportEncoding, setTimecardImportEncoding] = useState('cp932');
  const [timecardImporting, setTimecardImporting] = useState(false);
  const [timecardImportMessage, setTimecardImportMessage] = useState('');
  const [adminNoteForm, setAdminNoteForm] = useState({
    category: 'assiduidade',
    severity: 'info',
    note: '',
  });
  const [filters, setFilters] = useState({
    month: new Date().toISOString().slice(0, 7),
    date_from: '',
    date_to: '',
    department: '',
    process: '',
    shift: '',
    group: '',
  });

  const load = async () => {
    if (!flags.can_view_attendance_dashboard) {
      setStatusMessage(forbiddenMessage());
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [depRes, procRes, shiftRes] = await Promise.all([
      authFetch(`${apiUrl('/api/departments/')}`),
      authFetch(`${apiUrl('/api/processes/')}`),
      authFetch(`${apiUrl('/api/shifts/')}`),
    ]);
    if (depRes.ok) setDepartments(normalizeList(await depRes.json()));
    if (procRes.ok) setProcesses(normalizeList(await procRes.json()));
    if (shiftRes.ok) setShifts(normalizeList(await shiftRes.json()));

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const res = await authFetch(`${apiUrl(`/api/operations/attendance-dashboard/${suffix}`)}`);
    if (!res.ok) {
      if (res.status === 403) {
        setStatusMessage(forbiddenMessage());
      } else {
      setStatusMessage('Falha ao carregar dashboard de presença.');
      }
      setData(null);
      setLoading(false);
      return;
    }
    const payload = await res.json();
    setData(payload);
    setSettingsForm(payload.settings || null);
    setStatusMessage('');
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filters.month, filters.date_from, filters.date_to, filters.department, filters.process, filters.shift, filters.group, flags.can_view_attendance_dashboard]);

  const summary = useMemo(() => {
    const k = data?.kpis || {};
    return [
      { label: 'Escalados', value: k.total_scheduled_employees || 0, detail: 'Funcionários no período' },
      { label: 'Presentes', value: k.present || 0, detail: 'Presença registrada' },
      { label: 'Faltas', value: k.absences || 0, detail: 'Ausências no período' },
      { label: 'Atrasos', value: k.lates || 0, detail: 'Ocorrências de atraso' },
      { label: 'Saídas antecipadas', value: k.early_leaves || 0, detail: 'Ocorrências de saída antecipada' },
      { label: 'Folgas', value: k.offs || 0, detail: 'Folgas registradas' },
      { label: 'HE do dia', value: `${k.overtime_day_hours || 0}h`, detail: 'Horas extras diárias' },
      { label: 'HE semana', value: `${k.overtime_week_hours || 0}h`, detail: 'Horas extras semanais' },
      { label: 'HE mês', value: `${k.overtime_month_hours || 0}h`, detail: 'Horas extras mensais' },
      { label: 'Em risco', value: k.risk_people || 0, detail: 'Pessoas com alertas' },
      { label: 'Divergências cartão ponto', value: data?.timecard_summary?.divergences_count || 0, detail: 'Diferenças ponto x escala' },
    ];
  }, [data]);

  const rankings = data?.employee_rankings || {};
  const overtime = data?.overtime_summary?.by_employee || [];
  const alerts = data?.risk_alerts || [];
  const timecardSummary = data?.timecard_summary || {};
  const timecardDivergences = data?.timecard_divergences || [];
  const [timecardTypeFilter, setTimecardTypeFilter] = useState('all');
  const activeSettings = data?.settings || settingsForm;

  const timecardFilterOptions = useMemo(() => {
    const base = [
      { key: 'all', label: 'Todas', types: [] },
      { key: 'missing_timecard', label: 'Sem ponto', types: ['missing_timecard'] },
      { key: 'worked_on_day_off', label: 'Trabalhou na folga', types: ['worked_on_day_off'] },
      { key: 'late', label: 'Atraso', types: ['late'] },
      { key: 'early_leave', label: 'Saída antecipada', types: ['early_leave'] },
      { key: 'overtime_mismatch', label: 'HE divergente', types: ['overtime_mismatch'] },
      { key: 'work_minutes_mismatch', label: 'Jornada divergente', types: ['work_minutes_mismatch'] },
      { key: 'timecard_without_calendar_cell', label: 'Ponto sem escala', types: ['timecard_without_calendar_cell'] },
    ];
    const counts = timecardDivergences.reduce((acc, item) => {
      const key = item.type || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return base.map((item) => {
      const count = item.key === 'all' ? timecardDivergences.length : (counts[item.key] || 0);
      return { ...item, count };
    });
  }, [timecardDivergences]);

  const filteredTimecardDivergences = useMemo(() => {
    if (timecardTypeFilter === 'all') return timecardDivergences;
    return timecardDivergences.filter((item) => item.type === timecardTypeFilter);
  }, [timecardDivergences, timecardTypeFilter]);

  const topTimecardDivergences = useMemo(() => {
    const counts = timecardDivergences.reduce((acc, item) => {
      const key = item.type || 'unknown';
      if (!acc[key]) {
        acc[key] = { type: key, count: 0, severity: item.severity || 'info' };
      }
      acc[key].count += 1;
      if (item.severity === 'critical') {
        acc[key].severity = 'critical';
      } else if (item.severity === 'warning' && acc[key].severity !== 'critical') {
        acc[key].severity = 'warning';
      }
      return acc;
    }, {});
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [timecardDivergences]);

  const timecardTopDivergenceClass = (severity) => {
    if (severity === 'critical') return 'operations-timecard-top-card critical';
    if (severity === 'warning') return 'operations-timecard-top-card warning';
    return 'operations-timecard-top-card info';
  };

  const saveSettings = async () => {
    if (!flags.can_edit_operations_settings) {
      setStatusMessage(forbiddenMessage());
      return;
    }
    if (!settingsForm) return;
    setSavingSettings(true);
    const res = await authFetch(`${apiUrl('/api/operations/settings/current/')}`, {
      method: 'PATCH',
      body: JSON.stringify({
        weekly_warning_hours: Number(settingsForm.weekly_warning_hours),
        weekly_critical_hours: Number(settingsForm.weekly_critical_hours),
        monthly_overtime_warning_hours: Number(settingsForm.monthly_overtime_warning_hours),
        monthly_overtime_critical_hours: Number(settingsForm.monthly_overtime_critical_hours),
        consecutive_absence_warning: Number(settingsForm.consecutive_absence_warning),
        recurrent_late_warning: Number(settingsForm.recurrent_late_warning),
        enable_kajuuroudou_alerts: Boolean(settingsForm.enable_kajuuroudou_alerts),
        notes: settingsForm.notes || '',
      }),
    });
    if (!res.ok) {
      setStatusMessage('Falha ao salvar configuração de limites.');
      setSavingSettings(false);
      return;
    }
    setStatusMessage('Configuração de limites atualizada.');
    await load();
    setSavingSettings(false);
  };

  const loadEmployeeDetail = async (employeeId, issue = null) => {
    if (!flags.can_view_employee_detail) {
      setStatusMessage(forbiddenMessage());
      return;
    }
    if (!employeeId) return;
    setSelectedEmployeeId(employeeId);
    setSelectedTimecardIssue(issue);
    setIsEmployeeDrawerOpen(true);
    setEmployeeDetailLoading(true);
    setEmployeeDetailError('');
    const params = new URLSearchParams();
    if (filters.month) params.set('month', filters.month);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const res = await authFetch(`${apiUrl(`/api/operations/attendance-dashboard/employees/${employeeId}/${suffix}`)}`);
    if (!res.ok) {
      setEmployeeDetail(null);
      setEmployeeDetailLoading(false);
      setEmployeeDetailError('Falha ao carregar detalhe do funcionário.');
      return;
    }
    setEmployeeDetail(await res.json());
    setEmployeeDetailLoading(false);
  };

  const exportEmployeeAttendance = () => {
    if (!flags.can_export_attendance) return;
    if (!employeeDetail) return;
    const code = employeeDetail.employee.employee_id || 'funcionario';
    const periodToken = (filters.month || new Date().toISOString().slice(0, 7)).replace('-', '_');
    const lines = [];
    lines.push(['Relatorio Individual de Assiduidade']);
    lines.push([`Funcionario`, `${code} - ${employeeDetail.employee.name || ''}`]);
    lines.push([`Periodo`, `${filters.date_from || filters.month || '-'} ate ${filters.date_to || '-'}`]);
    lines.push([`Processo`, employeeDetail.employee.process || '-']);
    lines.push([`Turno`, employeeDetail.employee.shift || '-']);
    lines.push([`Grupo`, employeeDetail.employee.group || '-']);
    lines.push([]);
    lines.push(['Resumo']);
    lines.push(['Faltas', employeeDetail.summary.absences]);
    lines.push(['Atrasos', employeeDetail.summary.lates]);
    lines.push(['Saidas antecipadas', employeeDetail.summary.early_leaves]);
    lines.push(['Folgas', employeeDetail.summary.offs]);
    lines.push(['HE semanal (h)', employeeDetail.summary.weekly_overtime_hours]);
    lines.push(['HE mensal (h)', employeeDetail.summary.monthly_overtime_hours]);
    lines.push(['Horas trabalhadas (h)', employeeDetail.summary.weekly_worked_hours]);
    lines.push([]);
    lines.push(['Alertas']);
    if (employeeDetail.risk_alerts?.length) {
      employeeDetail.risk_alerts.forEach((item) => lines.push([item]));
    } else {
      lines.push(['Sem alertas no periodo']);
    }
    lines.push([]);
    lines.push(['Historico diario']);
    lines.push(['Data', 'Status', 'Jornada (h)', 'HE (h)', 'Observacao']);
    (employeeDetail.daily_history || []).forEach((row) => {
      lines.push([row.date, row.status, row.actual_work_hours, row.overtime_hours, row.note || '']);
    });
    lines.push([]);
    lines.push(['Observacoes administrativas']);
    lines.push(['Data', 'Categoria', 'Severidade', 'Observacao', 'Autor']);
    if (employeeDetail.administrative_notes?.length) {
      employeeDetail.administrative_notes.forEach((item) => {
        lines.push([item.date, item.category, item.severity, item.note, item.created_by_username || '-']);
      });
    } else {
      lines.push(['-', '-', '-', 'Sem observacoes', '-']);
    }

    const csv = lines.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assiduidade_${code}_${periodToken}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const closeEmployeeDrawer = () => {
    setIsEmployeeDrawerOpen(false);
    setSelectedTimecardIssue(null);
  };

  const importTimecardFile = async () => {
    if (!flags.can_import_timecard) {
      setTimecardImportMessage(forbiddenMessage());
      return;
    }
    if (!timecardImportFile) {
      setTimecardImportMessage('Selecione um arquivo CSV/TXT do cartão ponto.');
      return;
    }
    setTimecardImporting(true);
    setTimecardImportMessage('');
    const formData = new FormData();
    formData.append('file', timecardImportFile);
    formData.append('encoding', timecardImportEncoding);
    formData.append('delimiter', 'auto');
    if (filters.month) formData.append('month', filters.month);

    const res = await authFetch(apiUrl('/api/operations/attendance-dashboard/import-timecard/'), {
      method: 'POST',
      body: formData,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTimecardImportMessage(payload.detail || 'Falha ao importar cartão ponto.');
      setTimecardImporting(false);
      return;
    }
    setTimecardImportMessage(
      `Importado: ${payload.rows_count || 0} linhas | criados ${payload.created || 0} | atualizados ${payload.updated || 0}`
    );
    setTimecardImportFile(null);
    await load();
    setTimecardImporting(false);
  };

  const saveAdministrativeNote = async () => {
    if (!flags.can_create_admin_notes) {
      setEmployeeDetailError(forbiddenMessage());
      return;
    }
    if (!employeeDetail || !adminNoteForm.note.trim()) return;
    setSavingAdminNote(true);
    const today = new Date().toISOString().slice(0, 10);
    const res = await authFetch(`${apiUrl('/api/operations/employee-admin-notes/')}`, {
      method: 'POST',
      body: JSON.stringify({
        employee: employeeDetail.employee.employee_pk || undefined,
        date: today,
        category: adminNoteForm.category,
        severity: adminNoteForm.severity,
        note: adminNoteForm.note.trim(),
        related_period_start: filters.date_from || `${filters.month}-01`,
        related_period_end: filters.date_to || today,
      }),
    });
    if (!res.ok) {
      setEmployeeDetailError('Falha ao salvar observação administrativa.');
      setSavingAdminNote(false);
      return;
    }
    setAdminNoteForm({ category: 'assiduidade', severity: 'info', note: '' });
    setShowAdminNoteForm(false);
    await loadEmployeeDetail(employeeDetail.employee.employee_id);
    setSavingAdminNote(false);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeEmployeeDrawer();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <OperationsLayout title="Dashboard de Presença" subtitle="Assiduidade, faltas, atrasos e horas extras" summary={summary}>
      <section className="inventory-panel">
        <div className="inventory-panel-header">
          <div>
            <p className="inventory-eyebrow">Filtros</p>
            <h2>Painel administrativo</h2>
          </div>
          <div className="inventory-panel-tools">
            <button className="inventory-secondary-button" type="button" onClick={load} disabled={loading}>
              {loading ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </div>
        {statusMessage ? <span className="inventory-status error">{statusMessage}</span> : null}
        <div className="inventory-form-grid" style={{ marginTop: '12px' }}>
          <label className="inventory-field"><span>Mês</span><input type="month" value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} /></label>
          <label className="inventory-field"><span>Data inicial</span><input type="date" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} /></label>
          <label className="inventory-field"><span>Data final</span><input type="date" value={filters.date_to} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} /></label>
          <label className="inventory-field"><span>Departamento</span><select value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}><option value="">Todos</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label className="inventory-field"><span>Processo</span><select value={filters.process} onChange={(event) => setFilters((current) => ({ ...current, process: event.target.value }))}><option value="">Todos</option>{processes.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label className="inventory-field"><span>Turno</span><select value={filters.shift} onChange={(event) => setFilters((current) => ({ ...current, shift: event.target.value }))}><option value="">Todos</option>{shifts.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label className="inventory-field"><span>Grupo</span><select value={filters.group} onChange={(event) => setFilters((current) => ({ ...current, group: event.target.value }))}><option value="">Todos</option><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></label>
        </div>
      </section>

      <section className="inventory-workspace" style={{ marginTop: '12px' }}>
        <article className="inventory-panel">
          <h2>Limites ativos</h2>
          {activeSettings ? (
            <div className="inventory-panel-tools" style={{ gap: '10px', flexWrap: 'wrap' }}>
              <span className="hikitsugui-badge priority-normal">Semanal alerta: {activeSettings.weekly_warning_hours}h</span>
              <span className="hikitsugui-badge priority-high">Semanal crítico: {activeSettings.weekly_critical_hours}h</span>
              <span className="hikitsugui-badge priority-normal">HE mensal alerta: {activeSettings.monthly_overtime_warning_hours}h</span>
              <span className="hikitsugui-badge priority-high">HE mensal crítico: {activeSettings.monthly_overtime_critical_hours}h</span>
              <span className="hikitsugui-badge category-neutral">Faltas consecutivas: {activeSettings.consecutive_absence_warning}</span>
              <span className="hikitsugui-badge category-neutral">Atrasos recorrentes: {activeSettings.recurrent_late_warning}</span>
              {!activeSettings.enable_kajuuroudou_alerts ? (
                <span className="hikitsugui-badge priority-low">Alertas de excesso desativados</span>
              ) : null}
            </div>
          ) : (
            <p className="inventory-empty-state">Sem dados de limites ativos.</p>
          )}
        </article>

        <article className="inventory-panel">
          <h2>Configuração de limites</h2>
          {flags.can_edit_operations_settings && settingsForm ? (
            <>
              <div className="inventory-form-grid">
                <label className="inventory-field"><span>Alerta semanal (h)</span><input type="number" value={settingsForm.weekly_warning_hours ?? 50} onChange={(event) => setSettingsForm((current) => ({ ...current, weekly_warning_hours: event.target.value }))} /></label>
                <label className="inventory-field"><span>Crítico semanal (h)</span><input type="number" value={settingsForm.weekly_critical_hours ?? 60} onChange={(event) => setSettingsForm((current) => ({ ...current, weekly_critical_hours: event.target.value }))} /></label>
                <label className="inventory-field"><span>Alerta mensal HE (h)</span><input type="number" value={settingsForm.monthly_overtime_warning_hours ?? 45} onChange={(event) => setSettingsForm((current) => ({ ...current, monthly_overtime_warning_hours: event.target.value }))} /></label>
                <label className="inventory-field"><span>Crítico mensal HE (h)</span><input type="number" value={settingsForm.monthly_overtime_critical_hours ?? 60} onChange={(event) => setSettingsForm((current) => ({ ...current, monthly_overtime_critical_hours: event.target.value }))} /></label>
                <label className="inventory-field"><span>Faltas consecutivas (alerta)</span><input type="number" value={settingsForm.consecutive_absence_warning ?? 2} onChange={(event) => setSettingsForm((current) => ({ ...current, consecutive_absence_warning: event.target.value }))} /></label>
                <label className="inventory-field"><span>Atrasos recorrentes (alerta)</span><input type="number" value={settingsForm.recurrent_late_warning ?? 3} onChange={(event) => setSettingsForm((current) => ({ ...current, recurrent_late_warning: event.target.value }))} /></label>
                <label className="inventory-field"><span>Ativar alertas kajuuroudou</span><select value={String(Boolean(settingsForm.enable_kajuuroudou_alerts))} onChange={(event) => setSettingsForm((current) => ({ ...current, enable_kajuuroudou_alerts: event.target.value === 'true' }))}><option value="true">Sim</option><option value="false">Não</option></select></label>
                <label className="inventory-field full"><span>Notas</span><textarea rows={2} value={settingsForm.notes || ''} onChange={(event) => setSettingsForm((current) => ({ ...current, notes: event.target.value }))} /></label>
              </div>
              <div className="inventory-form-actions">
                <button className="inventory-primary-button" type="button" onClick={saveSettings} disabled={savingSettings}>{savingSettings ? 'Salvando...' : 'Salvar limites'}</button>
              </div>
            </>
          ) : (
            <PermissionNotice compact title="Limites" message={`${readonlyMessage()} ${requestAccessMessage()}`} variant="info" />
          )}
        </article>

        <article className="inventory-panel">
          <h2>Assiduidade</h2>
          <div className="inventory-table-wrap">
            <table className="inventory-table compact">
              <thead><tr><th>Mais faltas (mês)</th><th>Qtd</th></tr></thead>
              <tbody>
                {(rankings.most_absences_month || []).slice(0, 10).map((row) => (
                  <tr
                    key={`abs-${row.assignment_id}`}
                    style={{ cursor: flags.can_view_employee_detail ? 'pointer' : 'default' }}
                    onClick={() => (flags.can_view_employee_detail ? loadEmployeeDetail(row.employee_id) : null)}
                  >
                    <td>{row.employee_id} - {row.employee_name}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="inventory-table-wrap" style={{ marginTop: '10px' }}>
            <table className="inventory-table compact">
              <thead><tr><th>Mais atrasos (mês)</th><th>Qtd</th></tr></thead>
              <tbody>
                {(rankings.most_lates_month || []).slice(0, 10).map((row) => (
                  <tr
                    key={`late-${row.assignment_id}`}
                    style={{ cursor: flags.can_view_employee_detail ? 'pointer' : 'default' }}
                    onClick={() => (flags.can_view_employee_detail ? loadEmployeeDetail(row.employee_id) : null)}
                  >
                    <td>{row.employee_id} - {row.employee_name}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="inventory-panel">
          <h2>Horas extras</h2>
          <div className="inventory-table-wrap">
            <table className="inventory-table compact">
              <thead><tr><th>Funcionário</th><th>HE acumulada</th></tr></thead>
              <tbody>
                {overtime.slice(0, 15).map((row) => (
                  <tr
                    key={`ot-${row.assignment_id}`}
                    style={{ cursor: flags.can_view_employee_detail ? 'pointer' : 'default' }}
                    onClick={() => (flags.can_view_employee_detail ? loadEmployeeDetail(row.employee_id) : null)}
                  >
                    <td>{row.employee_id} - {row.employee_name}</td>
                    <td>{row.overtime_hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="inventory-panel">
          <h2>Alertas de excesso de jornada</h2>
          {alerts.length === 0 ? <p className="inventory-empty-state">Sem alertas no filtro atual.</p> : null}
          <div style={{ display: 'grid', gap: '8px' }}>
            {alerts.slice(0, 20).map((alert) => (
              <div
                key={`risk-${alert.assignment_id}`}
                className={alertClass(alert.level)}
                style={{ width: '100%', cursor: flags.can_view_employee_detail ? 'pointer' : 'default' }}
                onClick={() => (flags.can_view_employee_detail ? loadEmployeeDetail(alert.employee_id) : null)}
              >
                <strong>{alert.employee_id} - {alert.employee_name}</strong> | {alert.actual_hours}h trabalhadas | {alert.overtime_hours}h extras
                <br />
                {alert.reasons.join(' | ')}
              </div>
            ))}
          </div>
        </article>

        <article className="inventory-panel">
          <div className="inventory-panel-header" style={{ alignItems: 'center' }}>
            <div>
              <p className="inventory-eyebrow">Ponto x escala</p>
              <h2>Cartão ponto x Escala</h2>
            </div>
            <div className="inventory-panel-tools" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <span className="hikitsugui-badge category-neutral">Registros: {timecardSummary.total_records || 0}</span>
              <span className="hikitsugui-badge category-neutral">Conciliados: {timecardSummary.matched_records || 0}</span>
              <span className="hikitsugui-badge category-neutral">Sem escala: {timecardSummary.unmatched_records || 0}</span>
              <span className="hikitsugui-badge priority-high">Divergências: {timecardSummary.divergences_count || 0}</span>
              {flags.can_import_timecard ? (
                <button className="inventory-primary-button" type="button" onClick={() => setShowTimecardImport((current) => !current)}>
                  Importar cartão ponto
                </button>
              ) : null}
            </div>
          </div>
          {showTimecardImport && flags.can_import_timecard ? (
            <div className="inventory-panel operations-timecard-import-panel">
              <div className="inventory-form-grid">
                <label className="inventory-field full">
                  <span>Arquivo CSV/TXT</span>
                  <input
                    key={timecardImportFile ? 'timecard-file-selected' : 'timecard-file-empty'}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={(event) => setTimecardImportFile(event.target.files?.[0] || null)}
                  />
                </label>
                <label className="inventory-field">
                  <span>Encoding</span>
                  <select value={timecardImportEncoding} onChange={(event) => setTimecardImportEncoding(event.target.value)}>
                    <option value="cp932">CP932 / Shift_JIS</option>
                    <option value="shift_jis">Shift_JIS</option>
                    <option value="utf-8">UTF-8</option>
                  </select>
                </label>
                <label className="inventory-field">
                  <span>Mês</span>
                  <input type="month" value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))} />
                </label>
              </div>
              <div className="inventory-form-actions">
                <button className="inventory-primary-button" type="button" onClick={importTimecardFile} disabled={timecardImporting || !timecardImportFile}>
                  {timecardImporting ? 'Importando...' : 'Importar arquivo'}
                </button>
                <button className="inventory-secondary-button" type="button" onClick={() => setShowTimecardImport(false)} disabled={timecardImporting}>
                  Fechar
                </button>
                {timecardImportMessage ? <span className="inventory-status">{timecardImportMessage}</span> : null}
              </div>
            </div>
          ) : null}
          <div className="inventory-panel" style={{ marginTop: '10px', padding: '10px 12px' }}>
            <h3 style={{ margin: '0 0 8px' }}>Top divergências</h3>
            {topTimecardDivergences.length === 0 ? (
              <p className="inventory-empty-state" style={{ margin: 0 }}>Sem divergências no período.</p>
            ) : (
              <div className="operations-timecard-top-grid">
                {topTimecardDivergences.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    className={timecardTopDivergenceClass(item.severity)}
                    onClick={() => setTimecardTypeFilter(item.type)}
                  >
                    <div className="operations-timecard-top-card-title">
                      <span>{timecardTypeLabel(item.type)}</span>
                      <span className={`hikitsugui-badge ${item.severity === 'critical' ? 'priority-high' : item.severity === 'warning' ? 'priority-normal' : 'category-neutral'}`}>
                        {item.severity}
                      </span>
                    </div>
                    <strong>{item.count}</strong>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="inventory-panel-tools operations-timecard-filters" style={{ marginTop: '8px', gap: '8px', flexWrap: 'wrap' }}>
            {timecardFilterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={timecardFilterButtonClass(timecardTypeFilter === option.key)}
                onClick={() => setTimecardTypeFilter(option.key)}
              >
                {option.label} ({option.count})
              </button>
            ))}
          </div>
          {filteredTimecardDivergences.length === 0 ? <p className="inventory-empty-state">Sem divergências de cartão ponto no filtro atual.</p> : null}
          {filteredTimecardDivergences.length ? (
            <div className="inventory-table-wrap">
              <table className="inventory-table compact">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Funcionário</th>
                    <th>Tipo</th>
                    <th>Esperado</th>
                    <th>Real</th>
                    <th>Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTimecardDivergences.slice(0, 20).map((item, index) => (
                    <tr
                      key={`timecard-${item.employee_code || 'x'}-${item.date || index}-${item.type || index}`}
                      className={selectedTimecardIssue?.date === item.date && selectedTimecardIssue?.type === item.type ? 'operations-timecard-row-selected' : ''}
                      style={{ cursor: flags.can_view_employee_detail && item.employee_id ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (flags.can_view_employee_detail && item.employee_id) {
                          loadEmployeeDetail(item.employee_id, { date: item.date, type: item.type });
                        }
                      }}
                    >
                      <td>{String(item.date || '').slice(0, 10)}</td>
                      <td>
                        <strong>{item.employee_id || item.employee_code || '-'}</strong>
                        <br />
                        <span>{item.employee_name || '-'}</span>
                      </td>
                      <td>
                        <span className={timecardAlertClass(item.severity)}>{timecardTypeLabel(item.type)}</span>
                      </td>
                      <td>{item.expected || '-'}</td>
                      <td>{item.actual || '-'}</td>
                      <td>{item.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>

      </section>

      {isEmployeeDrawerOpen ? <div className="operations-drawer-overlay" onClick={closeEmployeeDrawer} /> : null}
      <aside className={`operations-employee-drawer ${isEmployeeDrawerOpen ? 'open' : ''}`}>
        <div className="operations-employee-drawer-header">
          <h2>Visão individual</h2>
          <button className="inventory-secondary-button" type="button" onClick={closeEmployeeDrawer}>Fechar</button>
        </div>

        <div className="operations-employee-drawer-body">
          {!selectedEmployeeId ? <p className="inventory-empty-state">Clique em um funcionário nas listas para abrir o detalhe.</p> : null}
          {employeeDetailLoading ? <p className="inventory-empty-state">Carregando detalhe...</p> : null}
          {employeeDetailError ? <span className="inventory-status error">{employeeDetailError}</span> : null}
          {employeeDetail ? (
            <>
              <p>
                <strong>{employeeDetail.employee.employee_id} - {employeeDetail.employee.name}</strong>
                <br />
                Processo: {employeeDetail.employee.process || '-'} | Turno: {employeeDetail.employee.shift || '-'} | Grupo: {employeeDetail.employee.group || '-'}
              </p>
              <p>
                Faltas: {employeeDetail.summary.absences} | Atrasos: {employeeDetail.summary.lates} | Saídas antecipadas: {employeeDetail.summary.early_leaves} | Folgas: {employeeDetail.summary.offs}
                <br />
                HE semanal: {employeeDetail.summary.weekly_overtime_hours}h | HE mensal: {employeeDetail.summary.monthly_overtime_hours}h
              </p>
              <div className="inventory-panel-tools" style={{ marginBottom: '8px' }}>
                <button className="inventory-secondary-button" type="button" onClick={() => window.print()} disabled={!employeeDetail || employeeDetailLoading}>Imprimir relatório</button>
                {flags.can_export_attendance ? (
                  <button className="inventory-secondary-button" type="button" onClick={exportEmployeeAttendance} disabled={!employeeDetail || employeeDetailLoading}>Exportar Excel</button>
                ) : null}
                {flags.can_create_admin_notes ? (
                  <button className="inventory-secondary-button" type="button" onClick={() => setShowAdminNoteForm((current) => !current)}>Registrar observação</button>
                ) : null}
              </div>
              {showAdminNoteForm && flags.can_create_admin_notes ? (
                <div className="inventory-panel" style={{ marginBottom: '8px' }}>
                  <div className="inventory-form-grid">
                    <label className="inventory-field"><span>Categoria</span><select value={adminNoteForm.category} onChange={(event) => setAdminNoteForm((current) => ({ ...current, category: event.target.value }))}><option value="assiduidade">Assiduidade</option><option value="atraso">Atraso</option><option value="falta">Falta</option><option value="horas_extras">Horas extras</option><option value="kajuuroudou">Kajuuroudou</option><option value="orientacao">Orientação</option><option value="outros">Outros</option></select></label>
                    <label className="inventory-field"><span>Severidade</span><select value={adminNoteForm.severity} onChange={(event) => setAdminNoteForm((current) => ({ ...current, severity: event.target.value }))}><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
                    <label className="inventory-field full"><span>Observação</span><textarea rows={3} value={adminNoteForm.note} onChange={(event) => setAdminNoteForm((current) => ({ ...current, note: event.target.value }))} /></label>
                  </div>
                  <div className="inventory-form-actions">
                    <button className="inventory-primary-button" type="button" onClick={saveAdministrativeNote} disabled={savingAdminNote || !adminNoteForm.note.trim()}>{savingAdminNote ? 'Salvando...' : 'Salvar observação'}</button>
                    <button className="inventory-secondary-button" type="button" onClick={() => setShowAdminNoteForm(false)}>Cancelar</button>
                  </div>
                </div>
              ) : null}

              {flags.can_view_admin_notes ? <h3>Observações administrativas</h3> : null}
              {flags.can_view_admin_notes && !employeeDetail.administrative_notes?.length ? <p className="inventory-empty-state">Sem observações registradas.</p> : null}
              {flags.can_view_admin_notes && employeeDetail.administrative_notes?.length ? (
                <div className="inventory-table-wrap" style={{ marginBottom: '8px' }}>
                  <table className="inventory-table compact">
                    <thead><tr><th>Data</th><th>Categoria</th><th>Severidade</th><th>Observação</th><th>Autor</th></tr></thead>
                    <tbody>
                      {employeeDetail.administrative_notes.map((item) => (
                        <tr key={`note-${item.id}`}>
                          <td>{item.date}</td>
                          <td>{item.category}</td>
                          <td>{item.severity}</td>
                          <td>{String(item.note || '').slice(0, 140)}</td>
                          <td>{item.created_by_username || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <h3>Cartão ponto</h3>
              {employeeDetail.timecard_records?.length ? (
                <div className="inventory-table-wrap" style={{ marginBottom: '8px' }}>
                  <table className="inventory-table compact">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Entrada</th>
                        <th>Saída</th>
                        <th>Total</th>
                        <th>HE</th>
                        <th>Atraso</th>
                        <th>Saída antecipada</th>
                        <th>Divergência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeDetail.timecard_records.map((row) => (
                        <tr key={`timecard-row-${row.date}-${row.clock_in || ''}-${row.clock_out || ''}`}>
                          <td>{String(row.date || '').slice(0, 10)}</td>
                          <td>{row.clock_in || '-'}</td>
                          <td>{row.clock_out || '-'}</td>
                          <td>{formatHours(row.total_work_hours)}</td>
                          <td>{formatHours(row.overtime_hours)}</td>
                          <td>{row.late_minutes ? `${row.late_minutes}m` : '-'}</td>
                          <td>{row.early_leave_minutes ? `${row.early_leave_minutes}m` : '-'}</td>
                          <td>
                            {row.divergence_message ? (
                              <span className={timecardAlertClass(row.divergence_severity)}>{row.divergence_message}</span>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="inventory-empty-state">Sem registros de ponto no período.</p>
              )}
              {employeeDetail.risk_alerts?.length ? (
                <div style={{ display: 'grid', gap: '6px', marginBottom: '8px' }}>
                  {employeeDetail.risk_alerts.map((item) => (
                    <span key={item} className="hikitsugui-badge priority-high">{item}</span>
                  ))}
                </div>
              ) : null}
              <div className="inventory-table-wrap">
                <table className="inventory-table compact">
                  <thead><tr><th>Data</th><th>Status</th><th>Jornada</th><th>HE</th><th>Observação</th></tr></thead>
                  <tbody>
                    {(employeeDetail.daily_history || []).map((row) => (
                      <tr key={`${row.date}-${row.operational_code || ''}`}>
                        <td>{row.date}</td>
                        <td>{row.status}</td>
                        <td>{row.actual_work_hours}h</td>
                        <td>{row.overtime_hours}h</td>
                        <td>{row.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </aside>

      {employeeDetail ? (
        <section className="attendance-print-only">
          <header>
            <h1>Relatório individual de presença</h1>
            <p><strong>Funcionário:</strong> {employeeDetail.employee.employee_id} - {employeeDetail.employee.name}</p>
            <p><strong>Período:</strong> {filters.date_from || filters.month || '-'} até {filters.date_to || '-'}</p>
            <p>
              <strong>Processo:</strong> {employeeDetail.employee.process || '-'} | <strong>Turno:</strong> {employeeDetail.employee.shift || '-'} | <strong>Grupo:</strong> {employeeDetail.employee.group || '-'}
            </p>
          </header>

          <section>
            <h2>Resumo</h2>
            <p>
              Faltas: {employeeDetail.summary.absences} | Atrasos: {employeeDetail.summary.lates} | Saídas antecipadas: {employeeDetail.summary.early_leaves} | Folgas: {employeeDetail.summary.offs}
            </p>
            <p>
              Horas trabalhadas: {employeeDetail.summary.weekly_worked_hours}h | HE semanal: {employeeDetail.summary.weekly_overtime_hours}h | HE mensal: {employeeDetail.summary.monthly_overtime_hours}h
            </p>
          </section>

          <section>
            <h2>Alertas de risco</h2>
            {employeeDetail.risk_alerts?.length ? (
              <ul>
                {employeeDetail.risk_alerts.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p>Sem alertas no período.</p>
            )}
          </section>

          <section>
            <h2>Cartão ponto</h2>
            {employeeDetail.timecard_records?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Entrada</th>
                    <th>Saída</th>
                    <th>Total</th>
                    <th>HE</th>
                    <th>Atraso</th>
                    <th>Saída antecipada</th>
                    <th>Divergência</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeDetail.timecard_records.map((row) => (
                    <tr
                      key={`print-timecard-${row.date}-${row.clock_in || ''}-${row.clock_out || ''}`}
                      className={selectedTimecardIssue?.date === row.date ? 'operations-timecard-row-selected' : ''}
                    >
                      <td>{String(row.date || '').slice(0, 10)}</td>
                      <td>{row.clock_in || '-'}</td>
                      <td>{row.clock_out || '-'}</td>
                      <td>{formatHours(row.total_work_hours)}</td>
                      <td>{formatHours(row.overtime_hours)}</td>
                      <td>{row.late_minutes ? `${row.late_minutes}m` : '-'}</td>
                      <td>{row.early_leave_minutes ? `${row.early_leave_minutes}m` : '-'}</td>
                      <td>{row.divergence_message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Sem registros de ponto no período.</p>
            )}
          </section>

          <section>
            <h2>Observações administrativas</h2>
            {employeeDetail.administrative_notes?.length ? (
              <ul>
                {employeeDetail.administrative_notes.map((item) => (
                  <li key={`print-note-${item.id}`}>
                    {item.date} [{item.category}/{item.severity}] - {item.note} ({item.created_by_username || '-'})
                  </li>
                ))}
              </ul>
            ) : (
              <p>Sem observações no período.</p>
            )}
          </section>

          <section>
            <h2>Histórico diário</h2>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Jornada</th>
                  <th>HE</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {(employeeDetail.daily_history || []).map((row) => (
                  <tr key={`print-${row.date}-${row.operational_code || ''}`}>
                    <td>{row.date}</td>
                    <td>{row.status}</td>
                    <td>{row.actual_work_hours}h</td>
                    <td>{row.overtime_hours}h</td>
                    <td>{row.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      ) : null}
    </OperationsLayout>
  );
}
