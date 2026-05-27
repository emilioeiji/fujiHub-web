import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../utils/authFetch';
import OperationsLayout from './OperationsLayout';
import { apiUrl } from '../config/api';

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
  const first = Object.entries(data)[0];
  if (!first) return fallback;
  const [field, value] = first;
  const msg = Array.isArray(value) ? value[0] : value;
  return `${field}: ${msg}`;
}

const emptyForm = {
  calendar: '',
  report_date: '',
  shift: '',
  process: '',
  area_equipment: '',
  responsible_employee: '',
  responsible_assignment: '',
  status: 'open',
  priority: 'normal',
  description: '',
  action_taken: '',
  pending_for_next_shift: '',
};

const emptyQuickForm = {
  calendar: '',
  report_date: new Date().toISOString().slice(0, 10),
  shift: '',
  process: '',
  category: '',
  priority: 'normal',
  description: '',
  pending_for_next_shift: '',
  responsible_employee: '',
  responsible_assignment: '',
};

const emptyItem = {
  category: '',
  title: '',
  description: '',
  action_taken: '',
  pending_for_next_shift: '',
  responsible_employee: '',
  status: 'open',
  priority: 'normal',
};

const STATUS_OPTIONS = [
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'pending', label: 'Pendente' },
  { value: 'resolved', label: 'Resolvido' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

const CATEGORY_TONE_BY_CODE = {
  seguranca: 'danger',
  qualidade: 'info',
  equipamento: 'warning',
  material: 'neutral',
  pessoal: 'info',
  producao: 'success',
  manutencao: 'warning',
  '5s': 'purple',
  outros: 'neutral',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function statusRank(status) {
  if (status === 'pending') return 10;
  if (status === 'open') return 20;
  if (status === 'in_progress') return 30;
  if (status === 'resolved') return 90;
  return 80;
}

function priorityRank(priority) {
  if (priority === 'critical') return 10;
  if (priority === 'high') return 20;
  if (priority === 'normal') return 30;
  if (priority === 'low') return 40;
  return 50;
}

export default function OperationsHikitsugui() {
  const [reports, setReports] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, report_date: todayIso() });
  const [quickForm, setQuickForm] = useState({ ...emptyQuickForm });
  const [itemForm, setItemForm] = useState(emptyItem);
  const [filters, setFilters] = useState({ date_from: '', date_to: '', shift: '', process: '', status: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [groupByResolution, setGroupByResolution] = useState(true);
  const [showLegend, setShowLegend] = useState(false);

  const selectedReport = useMemo(
    () => reports.find((item) => Number(item.id) === Number(selectedReportId)) || null,
    [reports, selectedReportId]
  );

  const reportView = useMemo(() => {
    const withMeta = reports.map((report) => {
      const representativeItem = (report.items || [])[0];
      const categoryDetail = representativeItem?.category_detail || null;
      return {
        ...report,
        __categoryLabel: categoryDetail?.label_pt || '-',
        __categoryCode: categoryDetail?.code || '',
      };
    });

    const sorted = [...withMeta].sort((a, b) => {
      const statusDiff = statusRank(a.status) - statusRank(b.status);
      if (statusDiff !== 0) return statusDiff;
      const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return String(b.report_date || '').localeCompare(String(a.report_date || ''));
    });

    return {
      all: sorted,
      open: sorted.filter((item) => item.status !== 'resolved'),
      resolved: sorted.filter((item) => item.status === 'resolved'),
    };
  }, [reports]);

  const summary = useMemo(() => {
    const today = todayIso();
    const openCount = reports.filter((r) => r.status === 'open').length;
    const inProgressCount = reports.filter((r) => r.status === 'in_progress').length;
    const pendingCount = reports.filter((r) => r.status === 'pending').length;
    const criticalCount = reports.filter((r) => r.priority === 'critical' && r.status !== 'resolved').length;
    const resolvedTodayCount = reports.filter((r) => r.status === 'resolved' && (r.updated_at || '').slice(0, 10) === today).length;
    return [
      { label: 'Abertos', value: openCount, detail: 'Status aberto' },
      { label: 'Em andamento', value: inProgressCount, detail: 'Em tratamento' },
      { label: 'Pendentes', value: pendingCount, detail: 'Próximo turno' },
      { label: 'Críticos', value: criticalCount, detail: 'Prioridade crítica' },
      { label: 'Resolvidos hoje', value: resolvedTodayCount, detail: today },
    ];
  }, [reports]);

  const responsibleEmployeesForScope = useMemo(() => {
    const scoped = assignments
      .map((assignment) => assignment.employee_detail)
      .filter(Boolean)
      .map((employee) => ({
        employee_id: employee.employee_id,
        label: `${employee.employee_id} - ${employee.name_en || employee.internal_name || employee.name_jp || 'Sem nome'}`,
      }));
    return scoped;
  }, [assignments]);

  const loadReports = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const res = await authFetch(`${apiUrl(`/api/operations/hikitsugui-reports/${suffix}`)}`);
    if (!res.ok) return [];
    return normalizeList(await res.json());
  };

  const loadData = async () => {
    setLoading(true);
    setIsError(false);

    const [reportsData, calendarsRes, processRes, shiftRes, employeeRes, categoryRes] = await Promise.all([
      loadReports(),
      authFetch(`${apiUrl('/api/operations/calendars/')}`),
      authFetch(`${apiUrl('/api/processes/')}`),
      authFetch(`${apiUrl('/api/shifts/')}`),
      authFetch(`${apiUrl('/api/employees/')}`),
      authFetch(`${apiUrl('/api/operations/hikitsugui-categories/')}`),
    ]);

    setReports(reportsData);
    if (calendarsRes.ok) setCalendars(normalizeList(await calendarsRes.json()));
    if (processRes.ok) setProcesses(normalizeList(await processRes.json()));
    if (shiftRes.ok) setShifts(normalizeList(await shiftRes.json()));
    if (employeeRes.ok) setEmployees(normalizeList(await employeeRes.json()));
    if (categoryRes.ok) setCategories(normalizeList(await categoryRes.json()));

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const run = async () => {
      const data = await loadReports();
      setReports(data);
    };
    run();
  }, [filters.date_from, filters.date_to, filters.shift, filters.process, filters.status, filters.priority]);

  const activeCalendarId = quickForm.calendar || form.calendar;

  useEffect(() => {
    if (!activeCalendarId) {
      setAssignments([]);
      return;
    }
    const loadAssignments = async () => {
      const res = await authFetch(`${apiUrl(`/api/operations/calendars/${activeCalendarId}/assignments/`)}`);
      if (!res.ok) {
        setAssignments([]);
        return;
      }
      setAssignments(normalizeList(await res.json()));
    };
    loadAssignments();
  }, [activeCalendarId]);

  const applyCalendarScope = (calendarId, target) => {
    const calendar = calendars.find((item) => Number(item.id) === Number(calendarId));
    if (!calendar) return target;
    return {
      ...target,
      calendar: String(calendar.id),
      shift: calendar.shift ? String(calendar.shift) : target.shift,
      process: calendar.process ? String(calendar.process) : target.process,
    };
  };

  const updateForm = (event) => {
    const { name, value } = event.target;
    if (name === 'calendar' && value) {
      setForm((current) => applyCalendarScope(value, { ...current, [name]: value }));
      return;
    }
    setForm((current) => ({ ...current, [name]: value }));
  };

  const updateQuickForm = (event) => {
    const { name, value } = event.target;
    if (name === 'calendar' && value) {
      setQuickForm((current) => applyCalendarScope(value, { ...current, [name]: value }));
      return;
    }
    setQuickForm((current) => ({ ...current, [name]: value }));
  };

  const updateItemForm = (event) => {
    const { name, value } = event.target;
    setItemForm((current) => ({ ...current, [name]: value }));
  };

  const createReport = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setIsError(false);
    setStatusMessage('');

    const payload = {
      ...form,
      calendar: form.calendar ? Number(form.calendar) : null,
      shift: form.shift ? Number(form.shift) : null,
      process: form.process ? Number(form.process) : null,
      responsible_employee: form.responsible_employee || null,
      responsible_assignment: form.responsible_assignment ? Number(form.responsible_assignment) : null,
    };

    const res = await authFetch(`${apiUrl('/api/operations/hikitsugui-reports/')}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Falha ao criar hikitsugui.'));
      setIsError(true);
      setSubmitting(false);
      return;
    }

    setStatusMessage('Registro criado com sucesso.');
    setForm({ ...emptyForm, report_date: todayIso() });
    await loadData();
    setSelectedReportId(data?.id || null);
    setSubmitting(false);
  };

  const createQuickReport = async (event) => {
    event.preventDefault();
    setQuickSubmitting(true);
    setIsError(false);
    setStatusMessage('');

    const reportPayload = {
      calendar: quickForm.calendar ? Number(quickForm.calendar) : null,
      report_date: quickForm.report_date,
      shift: quickForm.shift ? Number(quickForm.shift) : null,
      process: quickForm.process ? Number(quickForm.process) : null,
      area_equipment: 'Registro rápido',
      responsible_employee: quickForm.responsible_employee || null,
      responsible_assignment: quickForm.responsible_assignment ? Number(quickForm.responsible_assignment) : null,
      status: quickForm.pending_for_next_shift ? 'pending' : 'open',
      priority: quickForm.priority,
      description: quickForm.description,
      action_taken: '',
      pending_for_next_shift: quickForm.pending_for_next_shift,
    };

    const reportRes = await authFetch(`${apiUrl('/api/operations/hikitsugui-reports/')}`, {
      method: 'POST',
      body: JSON.stringify(reportPayload),
    });
    const reportData = await readJson(reportRes);
    if (!reportRes.ok) {
      setStatusMessage(formatApiMessage(reportData, 'Falha ao criar registro rápido.'));
      setIsError(true);
      setQuickSubmitting(false);
      return;
    }

    if (quickForm.category || quickForm.description || quickForm.pending_for_next_shift) {
      const itemPayload = {
        report: reportData.id,
        category: quickForm.category ? Number(quickForm.category) : null,
        title: quickForm.description.slice(0, 80) || 'Item rápido',
        description: quickForm.description,
        action_taken: '',
        pending_for_next_shift: quickForm.pending_for_next_shift,
        responsible_employee: quickForm.responsible_employee || null,
        status: quickForm.pending_for_next_shift ? 'pending' : 'open',
        priority: quickForm.priority,
      };
      await authFetch(`${apiUrl('/api/operations/hikitsugui-items/')}`, {
        method: 'POST',
        body: JSON.stringify(itemPayload),
      });
    }

    setQuickForm({ ...emptyQuickForm, report_date: todayIso() });
    setStatusMessage('Registro rápido criado.');
    await loadData();
    setSelectedReportId(reportData?.id || null);
    setQuickSubmitting(false);
  };

  const saveSelectedReport = async () => {
    if (!selectedReport) return;
    setSaving(true);
    setIsError(false);
    setStatusMessage('');

    const payload = {
      calendar: selectedReport.calendar ? Number(selectedReport.calendar) : null,
      report_date: selectedReport.report_date,
      shift: selectedReport.shift ? Number(selectedReport.shift) : null,
      process: selectedReport.process ? Number(selectedReport.process) : null,
      area_equipment: selectedReport.area_equipment,
      responsible_employee: selectedReport.responsible_employee || null,
      responsible_assignment: selectedReport.responsible_assignment ? Number(selectedReport.responsible_assignment) : null,
      status: selectedReport.status,
      priority: selectedReport.priority,
      description: selectedReport.description,
      action_taken: selectedReport.action_taken || '',
      pending_for_next_shift: selectedReport.pending_for_next_shift || '',
    };

    const res = await authFetch(`${apiUrl(`/api/operations/hikitsugui-reports/${selectedReport.id}/`)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);
    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Falha ao salvar registro.'));
      setIsError(true);
      setSaving(false);
      return;
    }

    setStatusMessage('Registro atualizado.');
    await loadData();
    setSaving(false);
  };

  const quickUpdateReportStatus = async (reportId, status) => {
    setIsError(false);
    setStatusMessage('');
    const res = await authFetch(`${apiUrl(`/api/operations/hikitsugui-reports/${reportId}/`)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Falha ao atualizar status do registro.'));
      setIsError(true);
      return;
    }
    setReports((current) => current.map((item) => (item.id === reportId ? { ...item, status } : item)));
    setStatusMessage('Status atualizado.');
  };

  const quickUpdateItemStatus = async (itemId, status) => {
    setIsError(false);
    setStatusMessage('');
    const res = await authFetch(`${apiUrl(`/api/operations/hikitsugui-items/${itemId}/`)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Falha ao atualizar status do item.'));
      setIsError(true);
      return;
    }
    setReports((current) =>
      current.map((report) => {
        if (Number(report.id) !== Number(selectedReportId)) return report;
        return {
          ...report,
          items: (report.items || []).map((item) => (item.id === itemId ? { ...item, status } : item)),
        };
      })
    );
    setStatusMessage('Status do item atualizado.');
  };

  const addItem = async (event) => {
    event.preventDefault();
    if (!selectedReport) return;
    setSavingItem(true);
    setIsError(false);
    setStatusMessage('');

    const payload = {
      ...itemForm,
      report: selectedReport.id,
      category: itemForm.category ? Number(itemForm.category) : null,
      responsible_employee: itemForm.responsible_employee || null,
    };

    const res = await authFetch(`${apiUrl('/api/operations/hikitsugui-items/')}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);
    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Falha ao adicionar item.'));
      setIsError(true);
      setSavingItem(false);
      return;
    }

    setStatusMessage('Item adicionado.');
    setItemForm(emptyItem);
    await loadData();
    setSavingItem(false);
  };

  const updateSelectedField = (name, value) => {
    setReports((current) =>
      current.map((item) => (item.id === selectedReport.id ? { ...item, [name]: value } : item))
    );
  };

  const applyFilterPreset = (preset) => {
    const today = todayIso();
    if (preset === 'today') {
      setFilters((current) => ({ ...current, date_from: today, date_to: today }));
      return;
    }
    if (preset === 'yesterday') {
      const y = yesterdayIso();
      setFilters((current) => ({ ...current, date_from: y, date_to: y }));
      return;
    }
    if (preset === 'last7') {
      setFilters((current) => ({ ...current, date_from: daysAgoIso(6), date_to: today }));
      return;
    }
    if (preset === 'pending') {
      setFilters((current) => ({ ...current, status: 'pending' }));
      return;
    }
    if (preset === 'critical') {
      setFilters((current) => ({ ...current, priority: 'critical' }));
      return;
    }
    if (preset === 'myShift') {
      const suggestedShift = quickForm.shift || form.shift || filters.shift;
      if (!suggestedShift) {
        setIsError(true);
        setStatusMessage('Defina um turno no formulário para usar o preset Meu turno.');
        return;
      }
      setFilters((current) => ({ ...current, shift: suggestedShift, date_from: today, date_to: today }));
    }
  };

  const badgeClass = (type, value) => {
    if (type === 'status') return `hikitsugui-badge status-${value || 'default'}`;
    if (type === 'priority') return `hikitsugui-badge priority-${value || 'default'}`;
    if (type === 'category') return `hikitsugui-badge category-${CATEGORY_TONE_BY_CODE[value] || 'neutral'}`;
    return 'hikitsugui-badge';
  };

  const printFilterLabel = useMemo(() => {
    const shiftLabel = shifts.find((s) => String(s.id) === String(filters.shift))?.code || 'Todos';
    const processLabel = processes.find((p) => String(p.id) === String(filters.process))?.code || 'Todos';
    const statusLabel = STATUS_OPTIONS.find((s) => s.value === filters.status)?.label || 'Todos';
    const priorityLabel = PRIORITY_OPTIONS.find((p) => p.value === filters.priority)?.label || 'Todas';
    const periodLabel = filters.date_from || filters.date_to
      ? `${filters.date_from || '...'} até ${filters.date_to || '...'}`
      : 'Sem recorte';
    return { shiftLabel, processLabel, statusLabel, priorityLabel, periodLabel };
  }, [filters, shifts, processes]);

  return (
    <OperationsLayout title="Hikitsugui / Passagem de Turno" subtitle="Registro operacional por turno e processo" summary={summary}>
      <div className="inventory-panel">
        <div className="inventory-panel-header">
          <div>
            <p className="inventory-eyebrow">Hikitsugui</p>
            <h2>Painel operacional</h2>
          </div>
          <div className="inventory-panel-tools hikitsugui-no-print">
            <Link className="inventory-secondary-button" to="/operations/calendars">Voltar aos calendários</Link>
            <button className="inventory-secondary-button" type="button" onClick={loadData} disabled={loading}>Atualizar</button>
            <button className="inventory-secondary-button" type="button" onClick={() => window.print()}>Imprimir / PDF</button>
          </div>
        </div>

        {statusMessage ? <span className={`inventory-status ${isError ? 'error' : ''}`}>{statusMessage}</span> : null}
        <div className="inventory-panel-tools hikitsugui-no-print" style={{ marginTop: '10px' }}>
          <button className="inventory-secondary-button" type="button" onClick={() => setShowLegend((current) => !current)}>
            {showLegend ? 'Ocultar legenda' : 'Mostrar legenda'}
          </button>
        </div>
        {showLegend ? (
          <div className="inventory-panel" style={{ marginTop: '10px', padding: '10px 12px' }}>
            <p className="inventory-eyebrow" style={{ marginBottom: '6px' }}>Legenda</p>
            <div className="inventory-panel-tools">
              <strong style={{ fontSize: '0.78rem' }}>Status:</strong>
              <span className={badgeClass('status', 'open')}>Aberto</span>
              <span className={badgeClass('status', 'in_progress')}>Em andamento</span>
              <span className={badgeClass('status', 'pending')}>Pendente</span>
              <span className={badgeClass('status', 'resolved')}>Resolvido</span>
            </div>
            <div className="inventory-panel-tools" style={{ marginTop: '6px' }}>
              <strong style={{ fontSize: '0.78rem' }}>Prioridade:</strong>
              <span className={badgeClass('priority', 'low')}>Baixa</span>
              <span className={badgeClass('priority', 'normal')}>Normal</span>
              <span className={badgeClass('priority', 'high')}>Alta</span>
              <span className={badgeClass('priority', 'critical')}>Crítica</span>
            </div>
          </div>
        ) : null}

        <div className="inventory-form-grid hikitsugui-no-print" style={{ marginTop: '12px' }}>
          <label className="inventory-field"><span>Data inicial</span><input type="date" value={filters.date_from} onChange={(e) => setFilters((c) => ({ ...c, date_from: e.target.value }))} /></label>
          <label className="inventory-field"><span>Data final</span><input type="date" value={filters.date_to} onChange={(e) => setFilters((c) => ({ ...c, date_to: e.target.value }))} /></label>
          <label className="inventory-field"><span>Turno</span><select value={filters.shift} onChange={(e) => setFilters((c) => ({ ...c, shift: e.target.value }))}><option value="">Todos</option>{shifts.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></label>
          <label className="inventory-field"><span>Processo</span><select value={filters.process} onChange={(e) => setFilters((c) => ({ ...c, process: e.target.value }))}><option value="">Todos</option>{processes.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select></label>
          <label className="inventory-field"><span>Status</span><select value={filters.status} onChange={(e) => setFilters((c) => ({ ...c, status: e.target.value }))}><option value="">Todos</option>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          <label className="inventory-field"><span>Prioridade</span><select value={filters.priority} onChange={(e) => setFilters((c) => ({ ...c, priority: e.target.value }))}><option value="">Todas</option>{PRIORITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
        </div>

        <div className="inventory-panel-tools hikitsugui-no-print" style={{ marginTop: '10px' }}>
          <button className="inventory-secondary-button" type="button" onClick={() => applyFilterPreset('today')}>Hoje</button>
          <button className="inventory-secondary-button" type="button" onClick={() => applyFilterPreset('yesterday')}>Ontem</button>
          <button className="inventory-secondary-button" type="button" onClick={() => applyFilterPreset('last7')}>Últimos 7 dias</button>
          <button className="inventory-secondary-button" type="button" onClick={() => applyFilterPreset('pending')}>Apenas pendentes</button>
          <button className="inventory-secondary-button" type="button" onClick={() => applyFilterPreset('critical')}>Apenas críticos</button>
          <button className="inventory-secondary-button" type="button" onClick={() => applyFilterPreset('myShift')}>Meu turno</button>
          <button className="inventory-secondary-button" type="button" onClick={() => setGroupByResolution((current) => !current)}>
            {groupByResolution ? 'Ver lista única' : 'Agrupar pendências/resolvidos'}
          </button>
        </div>

        <div className="inventory-table-wrap" style={{ marginTop: '14px' }}>
          <table className="inventory-table compact">
            <thead><tr><th>Data</th><th>Turno</th><th>Processo</th><th>Área/Equip.</th><th>Categoria</th><th>Status</th><th>Prioridade</th><th>Pendências</th></tr></thead>
            <tbody>
              {groupByResolution ? (
                <tr>
                  <td colSpan={8} className="hikitsugui-group-row">Pendências abertas</td>
                </tr>
              ) : null}
              {(groupByResolution ? reportView.open : reportView.all).map((r) => (
                <tr key={r.id} onClick={() => setSelectedReportId(r.id)} style={{ cursor: 'pointer', background: Number(selectedReportId) === r.id ? '#eef7fb' : undefined }}>
                  <td>{r.report_date}</td>
                  <td>{shifts.find((s) => Number(s.id) === Number(r.shift))?.code || '-'}</td>
                  <td>{processes.find((p) => Number(p.id) === Number(r.process))?.code || '-'}</td>
                  <td>{r.area_equipment}</td>
                  <td><span className={badgeClass('category', r.__categoryCode)}>{r.__categoryLabel}</span></td>
                  <td>
                    <select
                      className={badgeClass('status', r.status)}
                      value={r.status}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => quickUpdateReportStatus(r.id, event.target.value)}
                    >
                      {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </td>
                  <td><span className={badgeClass('priority', r.priority)}>{PRIORITY_OPTIONS.find((item) => item.value === r.priority)?.label || r.priority}</span></td>
                  <td>{r.open_items_count || 0}</td>
                </tr>
              ))}
              {groupByResolution ? (
                <tr>
                  <td colSpan={8} className="hikitsugui-group-row">Resolvidos</td>
                </tr>
              ) : null}
              {groupByResolution ? reportView.resolved.map((r) => (
                <tr key={`resolved-${r.id}`} onClick={() => setSelectedReportId(r.id)} style={{ cursor: 'pointer', opacity: 0.82, background: Number(selectedReportId) === r.id ? '#eef7fb' : undefined }}>
                  <td>{r.report_date}</td>
                  <td>{shifts.find((s) => Number(s.id) === Number(r.shift))?.code || '-'}</td>
                  <td>{processes.find((p) => Number(p.id) === Number(r.process))?.code || '-'}</td>
                  <td>{r.area_equipment}</td>
                  <td><span className={badgeClass('category', r.__categoryCode)}>{r.__categoryLabel}</span></td>
                  <td>
                    <select
                      className={badgeClass('status', r.status)}
                      value={r.status}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => quickUpdateReportStatus(r.id, event.target.value)}
                    >
                      {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                  </td>
                  <td><span className={badgeClass('priority', r.priority)}>{PRIORITY_OPTIONS.find((item) => item.value === r.priority)?.label || r.priority}</span></td>
                  <td>{r.open_items_count || 0}</td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>

        <section className="hikitsugui-print-only">
          <h2>Passagem de turno</h2>
          <p>
            Período: {printFilterLabel.periodLabel} | Turno: {printFilterLabel.shiftLabel} | Processo: {printFilterLabel.processLabel} | Status: {printFilterLabel.statusLabel} | Prioridade: {printFilterLabel.priorityLabel}
          </p>

          <h3>Pendências abertas</h3>
          {reportView.open.length === 0 ? <p>Nenhuma pendência aberta no filtro.</p> : null}
          {reportView.open.map((report) => (
            <article key={`print-open-${report.id}`} className="hikitsugui-print-card">
              <header>
                <strong>{report.report_date} - {report.area_equipment}</strong>
                <span>{shifts.find((s) => Number(s.id) === Number(report.shift))?.code || '-'} / {processes.find((p) => Number(p.id) === Number(report.process))?.code || '-'}</span>
              </header>
              <p><strong>Status:</strong> {STATUS_OPTIONS.find((s) => s.value === report.status)?.label || report.status} | <strong>Prioridade:</strong> {PRIORITY_OPTIONS.find((p) => p.value === report.priority)?.label || report.priority}</p>
              <p><strong>Descrição:</strong> {report.description || '-'}</p>
              <p><strong>Ação tomada:</strong> {report.action_taken || '-'}</p>
              <p><strong>Pendência próximo turno:</strong> {report.pending_for_next_shift || '-'}</p>
              <p><strong>Responsável:</strong> {report.responsible_employee_detail?.name_en || report.responsible_employee_detail?.name_jp || report.responsible_employee_detail?.employee_id || '-'}</p>
              {(report.items || []).map((item) => (
                <div key={`print-item-open-${item.id}`} className="hikitsugui-print-item">
                  <p><strong>Item:</strong> {item.title}</p>
                  <p><strong>Categoria:</strong> {item.category_detail?.label_pt || '-'} | <strong>Status:</strong> {STATUS_OPTIONS.find((s) => s.value === item.status)?.label || item.status} | <strong>Prioridade:</strong> {PRIORITY_OPTIONS.find((p) => p.value === item.priority)?.label || item.priority}</p>
                  <p><strong>Descrição:</strong> {item.description || '-'}</p>
                  <p><strong>Ação tomada:</strong> {item.action_taken || '-'}</p>
                  <p><strong>Pendência próximo turno:</strong> {item.pending_for_next_shift || '-'}</p>
                </div>
              ))}
            </article>
          ))}

          <h3>Resolvidos</h3>
          {reportView.resolved.length === 0 ? <p>Nenhum registro resolvido no filtro.</p> : null}
          {reportView.resolved.map((report) => (
            <article key={`print-resolved-${report.id}`} className="hikitsugui-print-card">
              <header>
                <strong>{report.report_date} - {report.area_equipment}</strong>
                <span>{shifts.find((s) => Number(s.id) === Number(report.shift))?.code || '-'} / {processes.find((p) => Number(p.id) === Number(report.process))?.code || '-'}</span>
              </header>
              <p><strong>Status:</strong> {STATUS_OPTIONS.find((s) => s.value === report.status)?.label || report.status} | <strong>Prioridade:</strong> {PRIORITY_OPTIONS.find((p) => p.value === report.priority)?.label || report.priority}</p>
              <p><strong>Descrição:</strong> {report.description || '-'}</p>
              <p><strong>Ação tomada:</strong> {report.action_taken || '-'}</p>
              <p><strong>Pendência próximo turno:</strong> {report.pending_for_next_shift || '-'}</p>
              <p><strong>Responsável:</strong> {report.responsible_employee_detail?.name_en || report.responsible_employee_detail?.name_jp || report.responsible_employee_detail?.employee_id || '-'}</p>
            </article>
          ))}
        </section>
      </div>

      <div className="inventory-workspace hikitsugui-no-print" style={{ marginTop: '14px' }}>
        <div className="inventory-panel">
          <div className="inventory-panel-header"><div><p className="inventory-eyebrow">Novo registro rápido</p><h2>Lançamento mínimo</h2></div></div>
          <form className="inventory-form" onSubmit={createQuickReport}>
            <div className="inventory-form-grid">
              <label className="inventory-field"><span>Calendário (opcional)</span><select name="calendar" value={quickForm.calendar} onChange={updateQuickForm}><option value="">-</option>{calendars.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
              <label className="inventory-field"><span>Data</span><input name="report_date" type="date" value={quickForm.report_date} onChange={updateQuickForm} required /></label>
              <label className="inventory-field"><span>Turno</span><select name="shift" value={quickForm.shift} onChange={updateQuickForm}><option value="">-</option>{shifts.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></label>
              <label className="inventory-field"><span>Processo</span><select name="process" value={quickForm.process} onChange={updateQuickForm}><option value="">-</option>{processes.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select></label>
              <label className="inventory-field"><span>Categoria</span><select name="category" value={quickForm.category} onChange={updateQuickForm}><option value="">-</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.label_pt}</option>)}</select></label>
              <label className="inventory-field"><span>Prioridade</span><select name="priority" value={quickForm.priority} onChange={updateQuickForm}>{PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
              <label className="inventory-field"><span>Responsável (funcionário)</span><select name="responsible_employee" value={quickForm.responsible_employee} onChange={updateQuickForm}><option value="">-</option>{responsibleEmployeesForScope.length > 0 ? responsibleEmployeesForScope.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.label}</option>) : employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.employee_id} - {e.name_en || e.name_jp}</option>)}</select></label>
              <label className="inventory-field"><span>Responsável (assignment)</span><select name="responsible_assignment" value={quickForm.responsible_assignment} onChange={updateQuickForm}><option value="">-</option>{assignments.map((a) => <option key={a.id} value={a.id}>{a.employee_detail?.employee_id} - {a.employee_detail?.name_en || a.employee_detail?.name_jp}</option>)}</select></label>
              <label className="inventory-field full"><span>Descrição</span><textarea name="description" rows={2} value={quickForm.description} onChange={updateQuickForm} required /></label>
              <label className="inventory-field full"><span>Pendência para próximo turno</span><textarea name="pending_for_next_shift" rows={2} value={quickForm.pending_for_next_shift} onChange={updateQuickForm} /></label>
            </div>
            <div className="inventory-form-actions"><button className="inventory-primary-button" type="submit" disabled={quickSubmitting}>{quickSubmitting ? 'Salvando...' : 'Criar registro rápido'}</button></div>
          </form>
        </div>

        <div className="inventory-panel">
          <div className="inventory-panel-header"><div><p className="inventory-eyebrow">Novo registro</p><h2>Passagem de turno completa</h2></div></div>
          <form className="inventory-form" onSubmit={createReport}>
            <div className="inventory-form-grid">
              <label className="inventory-field"><span>Calendário (opcional)</span><select name="calendar" value={form.calendar} onChange={updateForm}><option value="">-</option>{calendars.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
              <label className="inventory-field"><span>Data</span><input name="report_date" type="date" value={form.report_date} onChange={updateForm} required /></label>
              <label className="inventory-field"><span>Turno</span><select name="shift" value={form.shift} onChange={updateForm}><option value="">-</option>{shifts.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></label>
              <label className="inventory-field"><span>Processo</span><select name="process" value={form.process} onChange={updateForm}><option value="">-</option>{processes.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select></label>
              <label className="inventory-field"><span>Responsável (funcionário)</span><select name="responsible_employee" value={form.responsible_employee} onChange={updateForm}><option value="">-</option>{employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.employee_id} - {e.name_en || e.name_jp}</option>)}</select></label>
              <label className="inventory-field"><span>Responsável (assignment)</span><select name="responsible_assignment" value={form.responsible_assignment} onChange={updateForm}><option value="">-</option>{assignments.map((a) => <option key={a.id} value={a.id}>{a.employee_detail?.employee_id} - {a.employee_detail?.name_en || a.employee_detail?.name_jp}</option>)}</select></label>
              <label className="inventory-field"><span>Status</span><select name="status" value={form.status} onChange={updateForm}>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
              <label className="inventory-field"><span>Prioridade</span><select name="priority" value={form.priority} onChange={updateForm}>{PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
              <label className="inventory-field full"><span>Área / Equipamento</span><input name="area_equipment" value={form.area_equipment} onChange={updateForm} required /></label>
              <label className="inventory-field full"><span>Descrição</span><textarea name="description" rows={3} value={form.description} onChange={updateForm} required /></label>
              <label className="inventory-field full"><span>Ação tomada</span><textarea name="action_taken" rows={2} value={form.action_taken} onChange={updateForm} /></label>
              <label className="inventory-field full"><span>Pendência para próximo turno</span><textarea name="pending_for_next_shift" rows={2} value={form.pending_for_next_shift} onChange={updateForm} /></label>
            </div>
            <div className="inventory-form-actions"><button className="inventory-primary-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Criar registro'}</button></div>
          </form>
        </div>

        <div className="inventory-panel">
          <div className="inventory-panel-header"><div><p className="inventory-eyebrow">Detalhe</p><h2>{selectedReport ? `Registro #${selectedReport.id}` : 'Selecione um registro'}</h2></div></div>
          {selectedReport ? (
            <>
              <div className="inventory-form-grid">
                <label className="inventory-field"><span>Status</span><select value={selectedReport.status} onChange={(e) => updateSelectedField('status', e.target.value)}>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
                <label className="inventory-field"><span>Prioridade</span><select value={selectedReport.priority} onChange={(e) => updateSelectedField('priority', e.target.value)}>{PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
                <label className="inventory-field full"><span>Descrição</span><textarea rows={3} value={selectedReport.description || ''} onChange={(e) => updateSelectedField('description', e.target.value)} /></label>
                <label className="inventory-field full"><span>Ação tomada</span><textarea rows={2} value={selectedReport.action_taken || ''} onChange={(e) => updateSelectedField('action_taken', e.target.value)} /></label>
                <label className="inventory-field full"><span>Pendência próximo turno</span><textarea rows={2} value={selectedReport.pending_for_next_shift || ''} onChange={(e) => updateSelectedField('pending_for_next_shift', e.target.value)} /></label>
              </div>
              <div className="inventory-form-actions"><button className="inventory-primary-button" type="button" onClick={saveSelectedReport} disabled={saving}>{saving ? 'Salvando...' : 'Salvar alterações'}</button></div>

              <div className="inventory-panel" style={{ marginTop: '12px', padding: '12px' }}>
                <p className="inventory-eyebrow">Itens do turno</p>
                <table className="inventory-table compact">
                  <thead><tr><th>Título</th><th>Categoria</th><th>Status</th><th>Prioridade</th></tr></thead>
                  <tbody>
                    {(selectedReport.items || []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td><span className={badgeClass('category', item.category_detail?.code)}>{item.category_detail?.label_pt || '-'}</span></td>
                        <td>
                          <select className={badgeClass('status', item.status)} value={item.status} onChange={(event) => quickUpdateItemStatus(item.id, event.target.value)}>
                            {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                          </select>
                        </td>
                        <td><span className={badgeClass('priority', item.priority)}>{PRIORITY_OPTIONS.find((entry) => entry.value === item.priority)?.label || item.priority}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <form className="inventory-form" style={{ marginTop: '10px' }} onSubmit={addItem}>
                  <div className="inventory-form-grid">
                    <label className="inventory-field"><span>Título</span><input name="title" value={itemForm.title} onChange={updateItemForm} required /></label>
                    <label className="inventory-field"><span>Categoria</span><select name="category" value={itemForm.category} onChange={updateItemForm}><option value="">-</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.label_pt}</option>)}</select></label>
                    <label className="inventory-field"><span>Status</span><select name="status" value={itemForm.status} onChange={updateItemForm}>{STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
                    <label className="inventory-field"><span>Prioridade</span><select name="priority" value={itemForm.priority} onChange={updateItemForm}>{PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
                    <label className="inventory-field full"><span>Descrição</span><textarea name="description" rows={2} value={itemForm.description} onChange={updateItemForm} /></label>
                  </div>
                  <div className="inventory-form-actions"><button className="inventory-secondary-button" type="submit" disabled={savingItem}>{savingItem ? 'Adicionando...' : 'Adicionar item'}</button></div>
                </form>
              </div>
            </>
          ) : (
            <p className="inventory-empty-state">Selecione um registro na lista para editar.</p>
          )}
        </div>
      </div>
    </OperationsLayout>
  );
}
