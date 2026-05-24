import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { getLocalizedName } from '../i18n/helpers';
import { authFetch } from '../utils/authFetch';
import OperationsLayout from './OperationsLayout';

const API_BASE_URL = 'http://127.0.0.1:8000';

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

function daysInMonth(year, month) {
  const total = new Date(year, month, 0).getDate();
  return Array.from({ length: total }, (_, index) => {
    const day = index + 1;
    return {
      day,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  });
}

function employeeLabel(employee) {
  return employee?.name_en || employee?.internal_name || employee?.name_jp || employee?.employee_id || '-';
}

function employeeCode(employee) {
  return employee?.employee_cd || employee?.employee_id || '-';
}

function emptyCellForm() {
  return {
    assignment: '',
    date: '',
    position: '',
    attendance_status: '',
    work_time_code: '',
    operational_code: '',
    overtime_minutes: 0,
    start_time: '',
    end_time: '',
    break_minutes: 0,
    crosses_midnight: false,
    manual_time_override: false,
    leave_time: '',
    time_note: '',
    memo: '',
    raw_value: '',
  };
}

function emptyPositionForm(department = '') {
  return {
    department,
    code: '',
    name_pt: '',
    name_jp: '',
    building_floor: '',
    description: '',
  };
}

function emptyRequirementForm(defaultDate = '') {
  return {
    position: '',
    date: defaultDate,
    required_headcount: 0,
    notes: '',
  };
}

function emptyGenerateForm(year, month) {
  return {
    default_4x2_anchor_date: year && month ? `${year}-${String(month).padStart(2, '0')}-01` : '2026-05-30',
    overwrite: false,
  };
}

export default function OperationsCalendarGrid() {
  const { id } = useParams();
  const { i18n, t } = useTranslation();
  const [calendar, setCalendar] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [cells, setCells] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [assignmentTotals, setAssignmentTotals] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [buildingFloors, setBuildingFloors] = useState([]);
  const [attendanceStatuses, setAttendanceStatuses] = useState([]);
  const [workTimeCodes, setWorkTimeCodes] = useState([]);
  const [operationalCodes, setOperationalCodes] = useState([]);
  const [rotationStyles, setRotationStyles] = useState([]);
  const [visualCategories, setVisualCategories] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({
    employee: '',
    operational_category: 'normal',
    work_pattern: '4x2',
    shift_type: 'day',
    rotation_group: 'A',
    five_two_off_days: [5, 6],
    default_position: '',
    start_date: '',
    display_order: 0,
    notes: '',
  });
  const [positionForm, setPositionForm] = useState(emptyPositionForm());
  const [requirementForm, setRequirementForm] = useState(emptyRequirementForm());
  const [pasteText, setPasteText] = useState('');
  const [pasteResult, setPasteResult] = useState(null);
  const [showGeneratePanel, setShowGeneratePanel] = useState(false);
  const [generateForm, setGenerateForm] = useState(emptyGenerateForm());
  const [generateResult, setGenerateResult] = useState(null);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [cellForm, setCellForm] = useState(emptyCellForm());
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState(false);
  const [addingAssignment, setAddingAssignment] = useState(false);
  const [savingPosition, setSavingPosition] = useState(false);
  const [savingRequirement, setSavingRequirement] = useState(false);
  const [pastingCells, setPastingCells] = useState(false);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [importingEmployees, setImportingEmployees] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const days = useMemo(() => {
    if (!calendar) return [];
    return daysInMonth(calendar.year, calendar.month);
  }, [calendar]);

  const cellMap = useMemo(() => {
    return cells.reduce((acc, cell) => {
      acc[`${cell.assignment}-${cell.date}`] = cell;
      return acc;
    }, {});
  }, [cells]);

  const summary = useMemo(() => {
    const totalCells = cells.length;
    return [
      { label: t('operations.assignments'), value: assignments.length, detail: t('operations.gridRows') },
      { label: t('operations.cells'), value: totalCells, detail: t('operations.filledCells') },
      { label: t('operations.summary'), value: summaryRows.length, detail: t('operations.summaryRows') },
    ];
  }, [assignments.length, cells.length, summaryRows.length, t]);

  const assignmentTotalsMap = useMemo(
    () =>
      assignmentTotals.reduce((acc, item) => {
        acc[item.assignment_id] = item;
        return acc;
      }, {}),
    [assignmentTotals]
  );

  const rotationStyleByGroup = useMemo(() => {
    return rotationStyles.reduce((acc, style) => {
      acc[style.group_code] = style;
      return acc;
    }, {});
  }, [rotationStyles]);

  const visualCategoryByCode = useMemo(() => {
    return visualCategories.reduce((acc, item) => {
      acc[item.code] = item;
      return acc;
    }, {});
  }, [visualCategories]);

  const getAssignmentVisualCode = (assignment) => {
    if (assignment.employee_detail?.retired || assignment.employee_detail?.end_work) return 'retired';
    const category = assignment.operational_category;
    if (category === 'relief') return 'relief';
    if (category === 'koutei_leader') return 'koutei_leader';
    if (category === 'trainer') return 'trainer';
    if ((assignment.notes || '').toLowerCase().includes('trainee')) return 'trainee';
    return 'normal';
  };

  const assignmentsForGrid = useMemo(() => {
    const rank = (assignment) => {
      const visualCode = getAssignmentVisualCode(assignment);
      if (['manager', 'director', 'supervisor', 'gl', 'koutei_leader'].includes(assignment.operational_category)) return 300;
      if (visualCode === 'relief') return 280;
      if (visualCode === 'trainee') return 140;
      return 100;
    };
    return [...assignments].sort((a, b) => {
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
      return (a.display_order || 0) - (b.display_order || 0);
    });
  }, [assignments]);

  const loadData = async () => {
    setLoading(true);
    setIsError(false);
    let loadedCalendar = null;

    const [
      calendarRes,
      assignmentsRes,
      cellsRes,
      summaryRes,
      assignmentTotalsRes,
      employeesRes,
      positionsRes,
      buildingFloorsRes,
      statusesRes,
      workCodesRes,
      operationalCodesRes,
      rotationStylesRes,
      visualCategoriesRes,
    ] = await Promise.all([
      authFetch(`${API_BASE_URL}/api/operations/calendars/${id}/`),
      authFetch(`${API_BASE_URL}/api/operations/calendars/${id}/assignments/`),
      authFetch(`${API_BASE_URL}/api/operations/calendars/${id}/cells/`),
      authFetch(`${API_BASE_URL}/api/operations/calendars/${id}/summary/`),
      authFetch(`${API_BASE_URL}/api/operations/calendars/${id}/assignment-totals/`),
      authFetch(`${API_BASE_URL}/api/employees/`),
      authFetch(`${API_BASE_URL}/api/operations/positions/`),
      authFetch(`${API_BASE_URL}/api/buildingfloors/`),
      authFetch(`${API_BASE_URL}/api/operations/attendance-statuses/`),
      authFetch(`${API_BASE_URL}/api/operations/work-time-codes/`),
      authFetch(`${API_BASE_URL}/api/operations/operational-codes/`),
      authFetch(`${API_BASE_URL}/api/operations/rotation-group-styles/`),
      authFetch(`${API_BASE_URL}/api/operations/visual-categories/`),
    ]);

    if (calendarRes.ok) {
      loadedCalendar = await calendarRes.json();
      setCalendar(loadedCalendar);
      setAssignmentForm((current) => ({
        ...current,
        start_date: current.start_date || `${loadedCalendar.year}-${String(loadedCalendar.month).padStart(2, '0')}-01`,
      }));
      setPositionForm((current) => ({
        ...current,
        department: current.department || loadedCalendar.department,
      }));
      setRequirementForm((current) => ({
        ...current,
        date: current.date || `${loadedCalendar.year}-${String(loadedCalendar.month).padStart(2, '0')}-01`,
      }));
      setGenerateForm((current) => ({
        ...current,
        default_4x2_anchor_date: current.default_4x2_anchor_date || '2026-05-30',
      }));
    }
    if (assignmentsRes.ok) setAssignments(normalizeList(await assignmentsRes.json()));
    if (cellsRes.ok) setCells(normalizeList(await cellsRes.json()));
    if (summaryRes.ok) setSummaryRows(normalizeList(await summaryRes.json()));
    if (assignmentTotalsRes.ok) setAssignmentTotals(normalizeList(await assignmentTotalsRes.json()));
    if (employeesRes.ok) setEmployees(normalizeList(await employeesRes.json()));
    if (positionsRes.ok) {
      const loadedPositions = normalizeList(await positionsRes.json());
      setPositions(
        loadedCalendar
          ? loadedPositions.filter((position) => Number(position.department) === Number(loadedCalendar.department))
          : loadedPositions
      );
    }
    if (buildingFloorsRes.ok) setBuildingFloors(normalizeList(await buildingFloorsRes.json()));
    if (statusesRes.ok) setAttendanceStatuses(normalizeList(await statusesRes.json()));
    if (workCodesRes.ok) setWorkTimeCodes(normalizeList(await workCodesRes.json()));
    if (operationalCodesRes.ok) setOperationalCodes(normalizeList(await operationalCodesRes.json()));
    if (rotationStylesRes.ok) setRotationStyles(normalizeList(await rotationStylesRes.json()));
    if (visualCategoriesRes.ok) setVisualCategories(normalizeList(await visualCategoriesRes.json()));

    if (
      !calendarRes.ok ||
      !assignmentsRes.ok ||
      !cellsRes.ok ||
      !summaryRes.ok ||
      !assignmentTotalsRes.ok ||
      !employeesRes.ok ||
      !positionsRes.ok ||
      !buildingFloorsRes.ok ||
      !statusesRes.ok ||
      !workCodesRes.ok ||
      !operationalCodesRes.ok ||
      !rotationStylesRes.ok ||
      !visualCategoriesRes.ok
    ) {
      setStatusMessage(t('operations.gridLoadError'));
      setIsError(true);
    } else {
      setStatusMessage('');
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const updateAssignmentField = (event) => {
    const { name, value } = event.target;
    setAssignmentForm((current) => ({ ...current, [name]: value }));
  };

  const updateCellField = (event) => {
    const { name, value, checked, type } = event.target;
    setCellForm((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? checked
          : name === 'overtime_minutes' || name === 'break_minutes'
            ? Number(value || 0)
            : value,
    }));
  };

  const updatePositionField = (event) => {
    const { name, value } = event.target;
    setPositionForm((current) => ({ ...current, [name]: value }));
  };

  const updateRequirementField = (event) => {
    const { name, value } = event.target;
    setRequirementForm((current) => ({ ...current, [name]: value }));
  };

  const updateGenerateField = (event) => {
    const { name, value, checked, type } = event.target;
    setGenerateForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const updateFiveTwoOffDays = (event) => {
    const selected = Array.from(event.target.selectedOptions).map((option) => Number(option.value));
    setAssignmentForm((current) => ({ ...current, five_two_off_days: selected }));
  };

  const openCellEditor = (assignment, day) => {
    const existing = cellMap[`${assignment.id}-${day.date}`];
    const form = existing
      ? {
          assignment: existing.assignment,
          date: existing.date,
          position: existing.position || '',
          attendance_status: existing.attendance_status || '',
          work_time_code: existing.work_time_code || '',
          operational_code: existing.operational_code || '',
          overtime_minutes: existing.overtime_minutes || 0,
          start_time: existing.start_time || '',
          end_time: existing.end_time || '',
          break_minutes: existing.break_minutes ?? 0,
          crosses_midnight: Boolean(existing.crosses_midnight),
          manual_time_override: Boolean(existing.manual_time_override),
          leave_time: existing.leave_time || '',
          time_note: existing.time_note || '',
          memo: existing.memo || '',
          raw_value: existing.raw_value || '',
        }
      : {
          ...emptyCellForm(),
          assignment: assignment.id,
          date: day.date,
        };

    setSelectedCell({ assignment, day, existing });
    setCellForm(form);
  };

  const addAssignment = async (event) => {
    event.preventDefault();
    setAddingAssignment(true);
    setIsError(false);
    setStatusMessage('');

    const payload = {
      ...assignmentForm,
      display_order: Number(assignmentForm.display_order || 0),
      default_position: assignmentForm.default_position ? Number(assignmentForm.default_position) : null,
    };

    const res = await authFetch(`${API_BASE_URL}/api/operations/calendars/${id}/assignments/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('operations.assignmentCreateError')));
      setIsError(true);
      setAddingAssignment(false);
      return;
    }

    setAssignmentForm((current) => ({
      ...current,
      employee: '',
      notes: '',
      display_order: assignments.length + 1,
    }));
    setStatusMessage(t('operations.assignmentCreated'));
    await loadData();
    setAddingAssignment(false);
  };

  const generateSchedule = async (event) => {
    event.preventDefault();
    setGeneratingSchedule(true);
    setIsError(false);
    setStatusMessage('');
    setGenerateResult(null);

    const res = await authFetch(`${API_BASE_URL}/api/operations/calendars/${id}/generate-schedule/`, {
      method: 'POST',
      body: JSON.stringify(generateForm),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('operations.generateError')));
      setIsError(true);
      setGeneratingSchedule(false);
      return;
    }

    setGenerateResult(data);
    setStatusMessage(t('operations.generateDone'));
    await loadData();
    setGeneratingSchedule(false);
  };

  const importEmployees = async (event) => {
    event.preventDefault();
    setImportingEmployees(true);
    setIsError(false);
    setStatusMessage('');
    setImportResult(null);

    const res = await authFetch(`${API_BASE_URL}/api/operations/calendars/${id}/import-employees/`, {
      method: 'POST',
      body: JSON.stringify({ import_all: true }),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('operations.importError')));
      setIsError(true);
      setImportingEmployees(false);
      return;
    }

    setImportResult(data);
    setStatusMessage(t('operations.importDone'));
    await loadData();
    setImportingEmployees(false);
  };

  const createPosition = async (event) => {
    event.preventDefault();
    setSavingPosition(true);
    setIsError(false);
    setStatusMessage('');

    const payload = {
      ...positionForm,
      department: Number(positionForm.department || calendar?.department),
      building_floor: positionForm.building_floor ? Number(positionForm.building_floor) : null,
    };

    const res = await authFetch(`${API_BASE_URL}/api/operations/positions/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('operations.positionCreateError')));
      setIsError(true);
      setSavingPosition(false);
      return;
    }

    setPositionForm(emptyPositionForm(calendar?.department || ''));
    setStatusMessage(t('operations.positionCreated'));
    await loadData();
    setSavingPosition(false);
  };

  const saveRequirement = async (event) => {
    event.preventDefault();
    setSavingRequirement(true);
    setIsError(false);
    setStatusMessage('');

    const existing = summaryRows.find(
      (row) => String(row.position) === String(requirementForm.position) && row.date === requirementForm.date
    );
    const payload = {
      position: Number(requirementForm.position),
      date: requirementForm.date,
      required_headcount: Number(requirementForm.required_headcount || 0),
      notes: requirementForm.notes,
    };

    const url = existing?.requirement_id
      ? `${API_BASE_URL}/api/operations/calendars/${id}/requirements/${existing.requirement_id}/`
      : `${API_BASE_URL}/api/operations/calendars/${id}/requirements/`;
    const method = existing?.requirement_id ? 'PATCH' : 'POST';

    const res = await authFetch(url, {
      method,
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('operations.requirementSaveError')));
      setIsError(true);
      setSavingRequirement(false);
      return;
    }

    setRequirementForm((current) => ({ ...emptyRequirementForm(current.date), position: current.position }));
    setStatusMessage(t('operations.requirementSaved'));
    await loadData();
    setSavingRequirement(false);
  };

  const pasteCells = async (event) => {
    event.preventDefault();

    if (!selectedCell) {
      setStatusMessage(t('operations.selectPasteStart'));
      setIsError(true);
      return;
    }

    setPastingCells(true);
    setIsError(false);
    setStatusMessage('');
    setPasteResult(null);

    const res = await authFetch(`${API_BASE_URL}/api/operations/calendars/${id}/cells/paste/`, {
      method: 'POST',
      body: JSON.stringify({
        start_assignment: selectedCell.assignment.id,
        start_date: selectedCell.day.date,
        tsv: pasteText,
      }),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('operations.pasteError')));
      setIsError(true);
      setPastingCells(false);
      return;
    }

    setPasteResult(data);
    setPasteText('');
    setStatusMessage(t('operations.pasteDone'));
    await loadData();
    setPastingCells(false);
  };

  const saveCell = async (event) => {
    event.preventDefault();
    setSavingCell(true);
    setIsError(false);
    setStatusMessage('');

    const payload = {
      ...cellForm,
      position: cellForm.position ? Number(cellForm.position) : null,
      attendance_status: cellForm.attendance_status ? Number(cellForm.attendance_status) : null,
      work_time_code: cellForm.work_time_code ? Number(cellForm.work_time_code) : null,
      operational_code: cellForm.operational_code ? Number(cellForm.operational_code) : null,
      overtime_minutes: Number(cellForm.overtime_minutes || 0),
      start_time: cellForm.start_time || null,
      end_time: cellForm.end_time || null,
      break_minutes: Number(cellForm.break_minutes || 0),
      crosses_midnight: Boolean(cellForm.crosses_midnight),
      manual_time_override: Boolean(cellForm.manual_time_override),
      leave_time: cellForm.leave_time || null,
      time_note: cellForm.time_note || '',
    };

    const existingId = selectedCell?.existing?.id;
    const url = existingId
      ? `${API_BASE_URL}/api/operations/calendars/${id}/cells/${existingId}/`
      : `${API_BASE_URL}/api/operations/calendars/${id}/cells/`;
    const method = existingId ? 'PATCH' : 'POST';

    const res = await authFetch(url, {
      method,
      body: JSON.stringify(payload),
    });
    const data = await readJson(res);

    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, t('operations.cellSaveError')));
      setIsError(true);
      setSavingCell(false);
      return;
    }

    setStatusMessage(t('operations.cellSaved'));
    setSelectedCell(null);
    setCellForm(emptyCellForm());
    await loadData();
    setSavingCell(false);
  };

  const renderCellText = (cell) => {
    if (!cell) return '';
    if (cell.raw_value) return cell.raw_value;
    const parts = [
      cell.operational_code_detail?.label_jp,
      cell.position_detail?.code,
      cell.attendance_status_detail?.label_jp,
      cell.work_time_code_detail?.label_jp,
    ].filter(Boolean);
    return parts.join(' ');
  };

  return (
    <OperationsLayout
      title={calendar?.title || t('operations.gridTitle')}
      subtitle={calendar ? `${calendar.year}-${String(calendar.month).padStart(2, '0')}` : t('operations.gridSubtitle')}
      summary={summary}
    >
      <section className="operations-grid-shell">
        <div className="inventory-panel operations-assignment-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">{t('operations.assignments')}</p>
              <h2>{t('operations.addEmployee')}</h2>
            </div>
            <div className="inventory-panel-tools">
              <Link className="inventory-secondary-button" to="/operations/calendars">
                {t('operations.backToCalendars')}
              </Link>
              <Link className="inventory-secondary-button" to={`/operations/calendars/${id}/print`}>
                {t('operations.printView')}
              </Link>
              <button
                className="inventory-secondary-button"
                type="button"
                onClick={() => setShowGeneratePanel((current) => !current)}
              >
                {t('operations.generateSchedule')}
              </button>
              <button
                className="inventory-secondary-button"
                type="button"
                onClick={() => setShowImportPanel((current) => !current)}
              >
                {t('operations.importEmployees')}
              </button>
              <button className="inventory-secondary-button" type="button" disabled={loading} onClick={loadData}>
                {loading ? t('common.refreshing') : t('common.refresh')}
              </button>
            </div>
          </div>

          {statusMessage ? (
            <span className={`inventory-status ${isError ? 'error' : ''}`}>{statusMessage}</span>
          ) : null}

          <form className="operations-inline-form" onSubmit={addAssignment}>
            <label className="inventory-field">
              <span>{t('operations.employee')}</span>
              <select name="employee" value={assignmentForm.employee} onChange={updateAssignmentField} required>
                <option value="">{t('common.select')}</option>
                {employees.map((employee) => (
                  <option key={employee.employee_id} value={employee.employee_id}>
                    {employee.employee_id} - {employeeLabel(employee)}
                  </option>
                ))}
              </select>
            </label>

            <label className="inventory-field">
              <span>{t('operations.category')}</span>
              <select
                name="operational_category"
                value={assignmentForm.operational_category}
                onChange={updateAssignmentField}
              >
                {['normal', 'relief', 'trainer', 'koutei_leader', 'gl', 'supervisor', 'manager', 'director'].map(
                  (category) => (
                    <option key={category} value={category}>
                      {t(`operations.categories.${category}`)}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="inventory-field">
              <span>{t('operations.workPattern')}</span>
              <select name="work_pattern" value={assignmentForm.work_pattern} onChange={updateAssignmentField}>
                <option value="4x2">4x2</option>
                <option value="5x2">5x2</option>
                <option value="manual">{t('operations.manual')}</option>
              </select>
            </label>

            <label className="inventory-field">
              <span>{t('operations.shiftType')}</span>
              <select name="shift_type" value={assignmentForm.shift_type} onChange={updateAssignmentField}>
                <option value="day">{t('operations.shiftTypes.day')}</option>
                <option value="night">{t('operations.shiftTypes.night')}</option>
                <option value="flexible">{t('operations.shiftTypes.flexible')}</option>
              </select>
            </label>

            <label className="inventory-field">
              <span>{t('operations.rotationGroup')}</span>
              <select name="rotation_group" value={assignmentForm.rotation_group} onChange={updateAssignmentField}>
                <option value="">{t('common.none')}</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>

            <label className="inventory-field">
              <span>{t('operations.defaultPosition')}</span>
              <select name="default_position" value={assignmentForm.default_position} onChange={updateAssignmentField}>
                <option value="">{t('common.none')}</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.code} - {getLocalizedName(position, i18n)}
                  </option>
                ))}
              </select>
            </label>

            <label className="inventory-field">
              <span>{t('operations.fiveTwoOffDays')}</span>
              <select multiple value={assignmentForm.five_two_off_days.map(String)} onChange={updateFiveTwoOffDays}>
                {[
                  [0, t('operations.weekdays.mon')],
                  [1, t('operations.weekdays.tue')],
                  [2, t('operations.weekdays.wed')],
                  [3, t('operations.weekdays.thu')],
                  [4, t('operations.weekdays.fri')],
                  [5, t('operations.weekdays.sat')],
                  [6, t('operations.weekdays.sun')],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inventory-field">
              <span>{t('operations.startDate')}</span>
              <input name="start_date" type="date" value={assignmentForm.start_date} onChange={updateAssignmentField} required />
            </label>

            <label className="inventory-field">
              <span>{t('operations.order')}</span>
              <input name="display_order" type="number" value={assignmentForm.display_order} onChange={updateAssignmentField} />
            </label>

            <button className="inventory-primary-button" type="submit" disabled={addingAssignment || loading}>
              {addingAssignment ? t('common.creating') : t('operations.addEmployee')}
            </button>
          </form>

          {showGeneratePanel ? (
            <form className="operations-generate-panel" onSubmit={generateSchedule}>
              <div>
                <p className="inventory-eyebrow">{t('operations.generateSchedule')}</p>
                <h2>{t('operations.generateTitle')}</h2>
                <p>{t('operations.generateHint')}</p>
              </div>

              <label className="inventory-field">
                <span>{t('operations.anchorDate')}</span>
                <input
                  name="default_4x2_anchor_date"
                  type="date"
                  value={generateForm.default_4x2_anchor_date}
                  onChange={updateGenerateField}
                />
              </label>

              <label className="operations-checkbox-field">
                <input
                  name="overwrite"
                  type="checkbox"
                  checked={generateForm.overwrite}
                  onChange={updateGenerateField}
                />
                <span>{t('operations.overwriteExisting')}</span>
              </label>

              <div className="inventory-form-actions">
                <button className="inventory-primary-button" type="submit" disabled={generatingSchedule || loading}>
                  {generatingSchedule ? t('common.saving') : t('operations.confirmGenerate')}
                </button>
              </div>

              {generateResult ? (
                <div className="operations-paste-result">
                  <span>{t('operations.created')}: <strong>{generateResult.created}</strong></span>
                  <span>{t('operations.updated')}: <strong>{generateResult.updated}</strong></span>
                  <span>{t('operations.skipped')}: <strong>{generateResult.skipped}</strong></span>
                  <span>{t('operations.totalDays')}: <strong>{generateResult.total_days}</strong></span>
                </div>
              ) : null}
            </form>
          ) : null}

          {showImportPanel ? (
            <form className="operations-generate-panel" onSubmit={importEmployees}>
              <div>
                <p className="inventory-eyebrow">{t('operations.importEmployees')}</p>
                <h2>{t('operations.importTitle')}</h2>
                <p>{t('operations.importHint')}</p>
              </div>

              <div className="operations-import-summary">
                <span>{t('employees.department')}</span>
                <strong>{calendar?.department_detail?.code || calendar?.department || '-'}</strong>
              </div>

              <div className="operations-import-summary">
                <span>{t('operations.availableEmployees')}</span>
                <strong>{employees.length}</strong>
              </div>

              <div className="inventory-form-actions">
                <button className="inventory-primary-button" type="submit" disabled={importingEmployees || loading}>
                  {importingEmployees ? t('common.saving') : t('operations.confirmImport')}
                </button>
              </div>

              {importResult ? (
                <div className="operations-paste-result">
                  <span>{t('operations.created')}: <strong>{importResult.created}</strong></span>
                  <span>{t('operations.skipped')}: <strong>{importResult.skipped}</strong></span>
                  <span>{t('operations.totalCandidates')}: <strong>{importResult.total_candidates}</strong></span>
                </div>
              ) : null}
            </form>
          ) : null}
        </div>

        <div className="inventory-panel operations-grid-panel">
          <div className="inventory-panel-header">
            <div>
              <p className="inventory-eyebrow">{t('operations.grid')}</p>
              <h2>{t('operations.monthlyGrid')}</h2>
            </div>
            <span className="inventory-status">{loading ? t('common.loading') : `${assignments.length} ${t('operations.rows')}`}</span>
          </div>

          {loading ? (
            <p className="inventory-empty-state">{t('operations.loadingGrid')}</p>
          ) : assignments.length === 0 ? (
            <p className="inventory-empty-state">{t('operations.emptyAssignments')}</p>
          ) : (
            <div className="operations-grid-wrap">
              <table className="operations-calendar-table">
                <thead>
                  <tr>
                    <th className="sticky-col scd">SCD</th>
                    <th className="sticky-col name">{t('operations.name')}</th>
                    <th className="sticky-col jp">和名</th>
                    <th className="sticky-col code">{t('operations.code')}</th>
                    <th className="sticky-col category">{t('operations.category')}</th>
                    <th className="sticky-col regular">所定</th>
                    <th className="sticky-col overtime">残業</th>
                    <th className="sticky-col overload">過重</th>
                    {days.map((day) => (
                      <th className={`day-col ${new Date(day.date).getDay() === 0 ? 'sunday-head' : ''}`} key={day.date}>
                        {day.day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignmentsForGrid.map((assignment) => {
                    const groupStyle = rotationStyleByGroup[assignment.rotation_group];
                    const visualCode = getAssignmentVisualCode(assignment);
                    const visual = visualCategoryByCode[visualCode];
                    const rowClass = visual?.target_column === 'row' || visualCode === 'trainee' ? 'row-trainee' : '';
                    const totals = assignmentTotalsMap[assignment.id];
                    return (
                    <tr key={assignment.id} className={rowClass}>
                      <td className="sticky-col scd">{assignment.display_order}</td>
                      <td
                        className="sticky-col name"
                        style={{
                          backgroundColor: groupStyle?.background_color || undefined,
                          color: groupStyle?.text_color || undefined,
                        }}
                      >
                        {employeeLabel(assignment.employee_detail)}
                      </td>
                      <td
                        className="sticky-col jp"
                        style={{
                          backgroundColor: visualCode === 'relief' ? visual?.background_color : undefined,
                          color: visualCode === 'relief' ? visual?.text_color : undefined,
                        }}
                      >
                        {assignment.employee_detail?.name_jp || '-'}
                      </td>
                      <td
                        className="sticky-col code"
                        style={{
                          backgroundColor: ['koutei_leader', 'trainer', 'retired'].includes(visualCode)
                            ? visual?.background_color
                            : undefined,
                          color: ['koutei_leader', 'trainer', 'retired'].includes(visualCode)
                            ? visual?.text_color
                            : undefined,
                        }}
                      >
                        {employeeCode(assignment.employee_detail)}
                      </td>
                      <td className="sticky-col category">{t(`operations.categories.${assignment.operational_category}`)}</td>
                      <td className="sticky-col regular">{totals?.scheduled_regular_formatted || '0:00'}</td>
                      <td className="sticky-col overtime">{totals?.actual_overtime_formatted || '0:00'}</td>
                      <td className="sticky-col overload">{totals?.overload_formatted || '0:00'}</td>
                      {days.map((day) => {
                        const cell = cellMap[`${assignment.id}-${day.date}`];
                        const background =
                          cell?.operational_code_detail?.background_color ||
                          cell?.attendance_status_detail?.color ||
                          '';
                        return (
                          <td className="day-cell" key={day.date}>
                            <button
                              className="day-cell-button"
                              style={{ backgroundColor: background || undefined }}
                              type="button"
                              onClick={() => openCellEditor(assignment, day)}
                            >
                              {renderCellText(cell) || '-'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="operations-side-grid">
          <div className="inventory-panel">
            <div className="inventory-panel-header">
              <div>
                <p className="inventory-eyebrow">{t('operations.cellEditor')}</p>
                <h2>{selectedCell ? selectedCell.day.date : t('operations.selectCell')}</h2>
              </div>
            </div>

            {selectedCell ? (
              <form className="inventory-form" onSubmit={saveCell}>
                <div className="inventory-form-grid single">
                  <label className="inventory-field">
                    <span>{t('operations.position')}</span>
                    <select name="position" value={cellForm.position} onChange={updateCellField}>
                      <option value="">{t('common.none')}</option>
                      {positions.map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.code} - {getLocalizedName(position, i18n)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="inventory-field">
                    <span>{t('operations.attendanceStatus')}</span>
                    <select name="attendance_status" value={cellForm.attendance_status} onChange={updateCellField}>
                      <option value="">{t('common.none')}</option>
                      {attendanceStatuses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label_jp} - {item.label_pt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="inventory-field">
                    <span>{t('operations.workTime')}</span>
                    <select name="work_time_code" value={cellForm.work_time_code} onChange={updateCellField}>
                      <option value="">{t('common.none')}</option>
                      {workTimeCodes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label_jp} - {item.label_pt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="inventory-field">
                    <span>{t('operations.operationalCode')}</span>
                    <select name="operational_code" value={cellForm.operational_code} onChange={updateCellField}>
                      <option value="">{t('common.none')}</option>
                      {operationalCodes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label_jp} - {item.label_pt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="inventory-field">
                    <span>{t('operations.overtimeMinutes')}</span>
                    <input
                      min="0"
                      name="overtime_minutes"
                      type="number"
                      value={cellForm.overtime_minutes}
                      onChange={updateCellField}
                    />
                  </label>

                  <label className="inventory-field">
                    <span>{t('operations.rawValue')}</span>
                    <input name="raw_value" value={cellForm.raw_value} onChange={updateCellField} />
                  </label>

                  <label className="inventory-field">
                    <span>{t('operations.leaveTime')}</span>
                    <input name="leave_time" type="time" value={cellForm.leave_time} onChange={updateCellField} />
                  </label>

                  <label className="inventory-field">
                    <span>{t('operations.startTime')}</span>
                    <input name="start_time" type="time" value={cellForm.start_time} onChange={updateCellField} />
                  </label>

                  <label className="inventory-field">
                    <span>{t('operations.endTime')}</span>
                    <input name="end_time" type="time" value={cellForm.end_time} onChange={updateCellField} />
                  </label>

                  <label className="inventory-field">
                    <span>{t('operations.breakMinutes')}</span>
                    <input
                      min="0"
                      name="break_minutes"
                      type="number"
                      value={cellForm.break_minutes}
                      onChange={updateCellField}
                    />
                  </label>

                  <label className="operations-checkbox-field">
                    <input
                      name="crosses_midnight"
                      type="checkbox"
                      checked={Boolean(cellForm.crosses_midnight)}
                      onChange={updateCellField}
                    />
                    <span>{t('operations.crossesMidnight')}</span>
                  </label>

                  <label className="operations-checkbox-field">
                    <input
                      name="manual_time_override"
                      type="checkbox"
                      checked={Boolean(cellForm.manual_time_override)}
                      onChange={updateCellField}
                    />
                    <span>{t('operations.manualTimeOverride')}</span>
                  </label>

                  <label className="inventory-field">
                    <span>{t('operations.timeNote')}</span>
                    <input name="time_note" value={cellForm.time_note} onChange={updateCellField} />
                  </label>

                  <label className="inventory-field">
                    <span>{t('common.notes')}</span>
                    <textarea name="memo" rows={3} value={cellForm.memo} onChange={updateCellField} />
                  </label>
                </div>

                <div className="inventory-form-actions">
                  <button className="inventory-secondary-button" type="button" onClick={() => setSelectedCell(null)}>
                    {t('common.cancel')}
                  </button>
                  <button className="inventory-primary-button" type="submit" disabled={savingCell}>
                    {savingCell ? t('common.saving') : t('operations.saveCell')}
                  </button>
                </div>
              </form>
            ) : (
              <p className="inventory-empty-state">{t('operations.selectCellHint')}</p>
            )}
          </div>

          <div className="inventory-panel">
            <div className="inventory-panel-header">
              <div>
                <p className="inventory-eyebrow">{t('operations.positions')}</p>
                <h2>{t('operations.managePositions')}</h2>
              </div>
              <span className="inventory-status">{positions.length}</span>
            </div>

            <form className="inventory-form" onSubmit={createPosition}>
              <div className="inventory-form-grid single">
                <label className="inventory-field">
                  <span>{t('common.code')}</span>
                  <input name="code" value={positionForm.code} onChange={updatePositionField} required />
                </label>

                <label className="inventory-field">
                  <span>{t('operations.namePt')}</span>
                  <input name="name_pt" value={positionForm.name_pt} onChange={updatePositionField} required />
                </label>

                <label className="inventory-field">
                  <span>{t('operations.nameJp')}</span>
                  <input name="name_jp" value={positionForm.name_jp} onChange={updatePositionField} required />
                </label>

                <label className="inventory-field">
                  <span>{t('employees.buildingFloor')}</span>
                  <select name="building_floor" value={positionForm.building_floor} onChange={updatePositionField}>
                    <option value="">{t('common.none')}</option>
                    {buildingFloors.map((floor) => (
                      <option key={floor.id} value={floor.id}>
                        {floor.code} - {floor.label_jp || floor.label_pt}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inventory-field">
                  <span>{t('common.notes')}</span>
                  <textarea name="description" rows={2} value={positionForm.description} onChange={updatePositionField} />
                </label>
              </div>

              <div className="inventory-form-actions">
                <button className="inventory-primary-button" type="submit" disabled={savingPosition || loading}>
                  {savingPosition ? t('common.saving') : t('operations.createPosition')}
                </button>
              </div>
            </form>

            {positions.length === 0 ? (
              <p className="inventory-empty-state">{t('operations.emptyPositions')}</p>
            ) : (
              <div className="operations-position-list">
                {positions.map((position) => (
                  <span key={position.id} className="operations-position-chip">
                    <strong>{position.code}</strong>
                    {getLocalizedName(position, i18n)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="inventory-panel">
            <div className="inventory-panel-header">
              <div>
                <p className="inventory-eyebrow">{t('operations.excelPaste')}</p>
                <h2>{selectedCell ? selectedCell.day.date : t('operations.selectCell')}</h2>
              </div>
            </div>

            <form className="inventory-form" onSubmit={pasteCells}>
              <div className="inventory-form-grid single">
                <label className="inventory-field">
                  <span>{t('operations.tsvData')}</span>
                  <textarea
                    rows={6}
                    value={pasteText}
                    onChange={(event) => setPasteText(event.target.value)}
                    placeholder={'ECII\t休\t有\n片栗粉\tECII\t欠'}
                  />
                </label>
              </div>

              <div className="inventory-form-actions">
                <button
                  className="inventory-primary-button"
                  type="submit"
                  disabled={pastingCells || loading || !pasteText.trim()}
                >
                  {pastingCells ? t('common.saving') : t('operations.pasteFromExcel')}
                </button>
              </div>
            </form>

            {pasteResult ? (
              <div className="operations-paste-result">
                <span>{t('operations.created')}: <strong>{pasteResult.created}</strong></span>
                <span>{t('operations.updated')}: <strong>{pasteResult.updated}</strong></span>
                <span>
                  {t('operations.unrecognized')}: <strong>{pasteResult.unrecognized_values?.length || 0}</strong>
                </span>
              </div>
            ) : (
              <p className="inventory-empty-state">{t('operations.pasteHint')}</p>
            )}
          </div>

          <div className="inventory-panel">
            <div className="inventory-panel-header">
              <div>
                <p className="inventory-eyebrow">{t('operations.requirements')}</p>
                <h2>{t('operations.dailyRequirement')}</h2>
              </div>
            </div>

            <form className="inventory-form" onSubmit={saveRequirement}>
              <div className="inventory-form-grid single">
                <label className="inventory-field">
                  <span>{t('operations.position')}</span>
                  <select name="position" value={requirementForm.position} onChange={updateRequirementField} required>
                    <option value="">{t('common.select')}</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.code} - {getLocalizedName(position, i18n)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inventory-field">
                  <span>{t('common.date')}</span>
                  <input name="date" type="date" value={requirementForm.date} onChange={updateRequirementField} required />
                </label>

                <label className="inventory-field">
                  <span>{t('operations.required')}</span>
                  <input
                    min="0"
                    name="required_headcount"
                    type="number"
                    value={requirementForm.required_headcount}
                    onChange={updateRequirementField}
                  />
                </label>

                <label className="inventory-field">
                  <span>{t('common.notes')}</span>
                  <textarea name="notes" rows={2} value={requirementForm.notes} onChange={updateRequirementField} />
                </label>
              </div>

              <div className="inventory-form-actions">
                <button className="inventory-primary-button" type="submit" disabled={savingRequirement || loading}>
                  {savingRequirement ? t('common.saving') : t('operations.saveRequirement')}
                </button>
              </div>
            </form>
          </div>

          <div className="inventory-panel">
            <div className="inventory-panel-header">
              <div>
                <p className="inventory-eyebrow">{t('operations.summary')}</p>
                <h2>{t('operations.requiredVsAssigned')}</h2>
              </div>
            </div>

            {summaryRows.length === 0 ? (
              <p className="inventory-empty-state">{t('operations.emptySummary')}</p>
            ) : (
              <div className="inventory-table-wrap">
                <table className="inventory-table compact">
                  <thead>
                    <tr>
                      <th>{t('common.date')}</th>
                      <th>{t('operations.position')}</th>
                      <th>{t('operations.required')}</th>
                      <th>{t('operations.assigned')}</th>
                      <th>{t('operations.difference')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((row) => (
                      <tr key={`${row.date}-${row.position}`}>
                        <td>{row.date}</td>
                        <td>{row.position_code}</td>
                        <td>{row.required_headcount}</td>
                        <td>{row.assigned_headcount}</td>
                        <td>
                          <span
                            className={`inventory-badge ${
                              row.difference < 0 ? 'warning' : row.difference > 0 ? 'success' : ''
                            }`}
                          >
                            {row.difference}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </OperationsLayout>
  );
}
