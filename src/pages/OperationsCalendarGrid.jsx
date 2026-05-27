import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import TemplatePanel from '../components/TemplatePanel';
import { getLocalizedName } from '../i18n/helpers';
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

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeShiftToken(value) {
  const token = normalizeSearchText(value);
  if (!token) return '';
  if (['day', 'dia', '昼', '昼勤', 'd'].includes(token)) return 'day';
  if (['night', 'noite', '夜', '夜勤', 'n'].includes(token)) return 'night';
  if (['flexible', 'flex', 'flexivel', 'flexível'].includes(token)) return 'flexible';
  return token;
}

function getWeekdayLabel(date, i18n) {
  const locale = i18n?.language === 'ja-JP' ? 'ja-JP' : 'pt-BR';
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday: 'short' });
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

function emptyPatternForm(year, month) {
  return {
    start_date: year && month ? `${year}-${String(month).padStart(2, '0')}-01` : '',
    work_days: 4,
    off_days: 2,
    work_operational_code: '',
    work_attendance_status: '',
    off_attendance_status: '',
  };
}

function normalizeHistoryText(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function shortenHistoryText(value, maxLen = 40) {
  const text = normalizeHistoryText(value);
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen).trim()}...` : text;
}

function formatHistoryValue(value) {
  if (value == null) return 'vazio';
  if (typeof value === 'string') return shortenHistoryText(value) || 'vazio';
  if (typeof value !== 'object') return shortenHistoryText(value) || 'vazio';

  const statusShort = shortenHistoryText(value.attendance_status_code || value.attendance_status_label || value.status, 20);
  const positionShort = shortenHistoryText(value.position_code || value.position_name || value.position, 20);
  const floorShort = shortenHistoryText(value.building_floor_code || value.floor || value.location, 20);
  const opCodeShort = shortenHistoryText(value.operational_code_code || value.operational_code, 20);
  const rawShort = shortenHistoryText(value.raw_value, 30);

  if (statusShort && !positionShort && !opCodeShort && !rawShort) return statusShort;
  if (positionShort && floorShort && !positionShort.includes(floorShort)) return `${positionShort} / ${floorShort}`;
  if (positionShort) return positionShort;
  if (statusShort) return statusShort;
  if (opCodeShort) return opCodeShort;
  if (rawShort) return rawShort;

  const fallback = shortenHistoryText(JSON.stringify(value), 40);
  return fallback || 'vazio';
}

function formatHistorySource(source) {
  const key = String(source || '').trim().toLowerCase();
  const labels = {
    inline_edit: 'Edição',
    paste: 'Colagem',
    fill_handle: 'Preenchimento',
    quick_apply: 'Aplicação rápida',
    pattern_4x2: '4x2',
    template: 'Template',
    month_duplication: 'Duplicação mensal',
    duplicate_previous: 'Duplicação mensal',
    next_month_generation: 'Próximo mês',
    generate_next_month: 'Próximo mês',
  };
  return labels[key] || key || '-';
}

function formatImportIgnoredReason(reason) {
  const key = String(reason || '').trim().toLowerCase();
  const labels = {
    different_shift: 'turno diferente',
    missing_employee_shift: 'sem turno cadastrado',
    different_process: 'processo diferente',
    missing_employee_process: 'sem processo cadastrado',
    inactive: 'inativo',
    already_linked: 'já vinculado',
    unknown: 'incompatível com o escopo',
  };
  return labels[key] || labels.unknown;
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
  const [templates, setTemplates] = useState([]);
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
  const [importPreview, setImportPreview] = useState(null);
  const [processingMonthOps, setProcessingMonthOps] = useState(false);
  const [processingTemplates, setProcessingTemplates] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [showSaveTemplatePanel, setShowSaveTemplatePanel] = useState(false);
  const [showApplyTemplatePanel, setShowApplyTemplatePanel] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateNeedsOverwrite, setTemplateNeedsOverwrite] = useState(false);
  const [templateTargetCounts, setTemplateTargetCounts] = useState({ assignments: 0, cells: 0 });
  const [showPatternPanel, setShowPatternPanel] = useState(false);
  const [patternForm, setPatternForm] = useState(emptyPatternForm());
  const [lastPatternPreset, setLastPatternPreset] = useState('');
  const [selectedCell, setSelectedCell] = useState(null);
  const [cellForm, setCellForm] = useState(emptyCellForm());
  const [activeCell, setActiveCell] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [inlineCellForm, setInlineCellForm] = useState(emptyCellForm());
  const [selectionAnchor, setSelectionAnchor] = useState(null);
  const [selectionRange, setSelectionRange] = useState(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [quickCategoryFilter, setQuickCategoryFilter] = useState('');
  const [savingCellKeys, setSavingCellKeys] = useState({});
  const [cellErrorKeys, setCellErrorKeys] = useState({});
  const [historyStack, setHistoryStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [isApplyingHistory, setIsApplyingHistory] = useState(false);
  const [fillDragState, setFillDragState] = useState(null);
  const gridWrapRef = useRef(null);
  const employeeSearchRef = useRef(null);
  const internalClipboardRef = useRef({ plainText: '', payload: null, updatedAt: 0 });
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState(false);
  const [addingAssignment, setAddingAssignment] = useState(false);
  const [savingPosition, setSavingPosition] = useState(false);
  const [savingRequirement, setSavingRequirement] = useState(false);
  const [pastingCells, setPastingCells] = useState(false);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [importingEmployees, setImportingEmployees] = useState(false);
  const [syncingAssignments, setSyncingAssignments] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editingAssignmentForm, setEditingAssignmentForm] = useState(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [employeeHighlightIndex, setEmployeeHighlightIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({ assignment: '', date: '', source: '', user: '' });
  const HISTORY_LIMIT = 100;
  const isGridBusy =
    loading ||
    savingCell ||
    addingAssignment ||
    savingPosition ||
    savingRequirement ||
    pastingCells ||
    generatingSchedule ||
    importingEmployees ||
    syncingAssignments ||
    processingTemplates ||
    exportingExcel;

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

  const attendanceStatusById = useMemo(
    () => attendanceStatuses.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}),
    [attendanceStatuses]
  );

  const workTimeCodeById = useMemo(
    () => workTimeCodes.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}),
    [workTimeCodes]
  );

  const operationalCodeById = useMemo(
    () => operationalCodes.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}),
    [operationalCodes]
  );

  const positionById = useMemo(() => positions.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}), [positions]);
  const buildingFloorById = useMemo(
    () => buildingFloors.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}),
    [buildingFloors]
  );

  const filteredOperationalCodes = useMemo(() => {
    if (!quickCategoryFilter) return operationalCodes;
    return operationalCodes.filter((item) => item.category === quickCategoryFilter);
  }, [operationalCodes, quickCategoryFilter]);

  const quickOperationalCodes = useMemo(() => filteredOperationalCodes.slice(0, 10), [filteredOperationalCodes]);

  const dayIndexByDate = useMemo(
    () => days.reduce((acc, item, index) => ({ ...acc, [item.date]: index }), {}),
    [days]
  );

  const resolveAssignmentCategory = (assignment) => {
    const masterBillingToken = String(
      assignment.billing_rate?.code ||
        assignment.employee_detail?.billing_rate_detail?.code ||
        assignment.employee_detail?.billing_rate_code ||
        assignment.employee_detail?.rank ||
        ''
    )
      .toLowerCase()
      .trim();
    const processToken = String(
      assignment.process?.code ||
        assignment.employee_detail?.process_detail?.code ||
        assignment.employee_detail?.process_code ||
        assignment.employee_detail?.process ||
        ''
    )
      .toLowerCase()
      .trim();
    const rawCategory = String(
      assignment.operational_category ||
        assignment.employee_detail?.operational_category ||
        ''
    )
      .toLowerCase()
      .trim();
    const category = rawCategory === 'kl' ? 'koutei_leader' : rawCategory;
    let resolved = 'other';
    if (category === 'normal') resolved = 'normal';
    if (['koutei_leader'].includes(category) || masterBillingToken.includes('kl') || masterBillingToken.includes('koutei')) resolved = 'koutei_leader';
    if (['relief', 'trainer', 'ririfu', 'apoio'].includes(category) || masterBillingToken.includes('relief') || processToken.includes('relief')) resolved = 'relief';
    if (['gl', 'supervisor', 'manager', 'director'].includes(category)) resolved = 'leadership';

    const labelMap = {
      normal: 'Normal',
      koutei_leader: 'Koutei Leader',
      relief: category === 'trainer' ? 'Trainer' : 'Relief',
      leadership: category === 'gl' ? 'GL' : 'Liderança',
      other: 'Outro',
    };
    return {
      key: resolved,
      label: assignment.category_label || labelMap[resolved] || 'Outro',
    };
  };

  const getAssignmentVisualCode = (assignment) => {
    if (assignment.employee_detail?.retired || assignment.employee_detail?.end_work) return 'retired';
    const resolved = resolveAssignmentCategory(assignment);
    if (resolved.key === 'koutei_leader') return 'koutei_leader';
    if (resolved.key === 'relief') return 'relief';
    if (resolved.key === 'leadership') return 'trainer';
    if ((assignment.notes || '').toLowerCase().includes('trainee')) return 'trainee';
    return 'normal';
  };

  const assignmentsForGrid = useMemo(() => {
    const resolvedCategory = (assignment) => {
      const token = String(assignment.operational_category || assignment.employee_detail?.operational_category || '').toLowerCase().trim();
      const billingToken = String(
        assignment.employee_detail?.billing_rate_detail?.code ||
          assignment.employee_detail?.billing_rate_code ||
          assignment.employee_detail?.billing_rate ||
          assignment.employee_detail?.rank ||
          ''
      )
        .toLowerCase()
        .trim();
      const processToken = String(
        assignment.employee_detail?.process_detail?.code ||
          assignment.employee_detail?.process_code ||
          assignment.employee_detail?.process ||
          ''
      )
        .toLowerCase()
        .trim();
      if (token === 'kl' || token === 'koutei_leader' || billingToken.includes('kl') || billingToken.includes('koutei')) return 'koutei_leader';
      if (['ririfu', 'apoio', 'relief', 'trainer'].includes(token) || billingToken.includes('relief') || processToken.includes('relief')) return 'relief';
      if (['gl', 'supervisor', 'manager', 'director', 'leader', 'lider', 'lideranca', 'supervisao'].includes(token)) return 'leadership';
      if (token === 'normal') return 'normal';
      return 'other';
    };
    const categoryRank = (assignment) => {
      const token = resolvedCategory(assignment);
      if (token === 'normal') return 10;
      if (token === 'koutei_leader') return 20;
      if (token === 'relief') return 30;
      if (token === 'leadership') return 40;
      return 90;
    };
    const groupRank = (assignment) => {
      const token = String(assignment.rotation_group || '').toUpperCase().trim();
      if (token === 'A') return 10;
      if (token === 'B') return 20;
      if (token === 'C') return 30;
      return 90;
    };
    const code = (assignment) =>
      String(assignment.employee_detail?.employee_cd || assignment.employee_detail?.employee_id || '').toLowerCase().trim();
    const name = (assignment) => String(employeeLabel(assignment.employee_detail)).toLowerCase().trim();
    const processCode = (assignment) =>
      String(
        assignment.employee_detail?.process_detail?.code ||
          assignment.employee_detail?.process_code ||
          assignment.employee_detail?.process ||
          ''
      )
        .toLowerCase()
        .trim();

    return [...assignments].sort((a, b) => {
      const categoryDiff = categoryRank(a) - categoryRank(b);
      if (categoryDiff !== 0) return categoryDiff;
      const groupDiff = groupRank(a) - groupRank(b);
      if (groupDiff !== 0) return groupDiff;
      const processDiff = processCode(a).localeCompare(processCode(b), 'pt-BR');
      if (processDiff !== 0) return processDiff;
      const orderDiff = (a.display_order || 0) - (b.display_order || 0);
      if (orderDiff !== 0) return orderDiff;
      const codeDiff = code(a).localeCompare(code(b), 'pt-BR');
      if (codeDiff !== 0) return codeDiff;
      const nameDiff = name(a).localeCompare(name(b), 'pt-BR');
      if (nameDiff !== 0) return nameDiff;
      return (a.display_order || 0) - (b.display_order || 0);
    });
  }, [assignments]);

  const assignmentIndexById = useMemo(
    () => assignmentsForGrid.reduce((acc, item, index) => ({ ...acc, [item.id]: index }), {}),
    [assignmentsForGrid]
  );

  const linkedEmployeeIds = useMemo(() => {
    const ids = new Set();
    assignments.forEach((assignment) => {
      const idValue = String(
        assignment.employee_detail?.employee_id ||
          assignment.employee_detail?.id ||
          assignment.employee ||
          assignment.employee_id ||
          ''
      ).trim();
      if (idValue) ids.add(idValue);
    });
    return ids;
  }, [assignments]);

  const selectedEmployee = useMemo(() => {
    const idValue = String(assignmentForm.employee || '').trim();
    if (!idValue) return null;
    return (
      employees.find((employee) => String(employee.employee_id || employee.id || '').trim() === idValue) || null
    );
  }, [assignmentForm.employee, employees]);

  const employeeOptions = useMemo(() => {
    const calendarDepartmentId = Number(calendar?.department || 0);
    const calendarShift = normalizeShiftToken(calendar?.shift);
    const calendarProcess = normalizeSearchText(calendar?.process);
    const query = normalizeSearchText(employeeSearchTerm);
    const shouldFilter = query.length >= 2;

    const base = employees
      .map((employee) => {
        const employeeId = String(employee.employee_id || employee.id || '').trim();
        if (!employeeId) return null;
        const shiftToken = normalizeShiftToken(employee.shift_type || employee.shift || employee.work_shift);
        const processToken = normalizeSearchText(employee.process || employee.process_code || employee.line || employee.line_code);
        const departmentId = Number(employee.department || employee.department_id || employee.department_detail?.id || 0);
        const isActive = !(employee.retired || employee.end_work) && employee.active !== false && employee.is_active !== false;
        const alreadyLinked = linkedEmployeeIds.has(employeeId);
        const departmentMatch = calendarDepartmentId > 0 ? departmentId === calendarDepartmentId : true;
        const shiftMatch = !calendarShift || !shiftToken || calendarShift === shiftToken;
        const processMatch = !calendarProcess || !processToken || processToken.includes(calendarProcess) || calendarProcess.includes(processToken);
        const compatible = isActive && !alreadyLinked && departmentMatch && shiftMatch && processMatch;
        const searchTokens = normalizeSearchText(
          [
            employeeId,
            employeeCode(employee),
            employee.name,
            employee.name_en,
            employee.name_jp,
            employee.internal_name,
            employee.kana_name,
            employee.name_kana,
            employee.nickname,
            employee.alias_name,
            employee.alternative_name,
          ]
            .filter(Boolean)
            .join(' ')
        );
        const matchesQuery = !shouldFilter || searchTokens.includes(query);
        const warnings = [];
        if (alreadyLinked) warnings.push('já vinculado');
        if (!isActive) warnings.push('inativo');
        if (!departmentMatch) warnings.push('departamento diferente');
        if (!shiftMatch) warnings.push('turno diferente');
        if (!processMatch) warnings.push('processo diferente');
        return {
          employee,
          employeeId,
          name: employeeLabel(employee),
          code: employeeCode(employee),
          shiftLabel: employee.shift || employee.shift_type || '-',
          groupLabel: employee.rotation_group || employee.group || '-',
          departmentLabel: employee.department_detail?.code || employee.department_code || employee.department || '-',
          workPattern: employee.work_pattern || '-',
          compatible,
          alreadyLinked,
          warnings,
          matchesQuery,
        };
      })
      .filter(Boolean);

    const ordered = base
      .sort((a, b) => {
        if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
        if (a.alreadyLinked !== b.alreadyLinked) return a.alreadyLinked ? 1 : -1;
        return a.name.localeCompare(b.name, 'pt-BR');
      })
      .filter((item) => item.matchesQuery);

    return ordered.slice(0, shouldFilter ? 40 : 25);
  }, [employees, calendar, employeeSearchTerm, linkedEmployeeIds]);

  const activeEmployeeOption = employeeOptions[employeeHighlightIndex] || employeeOptions[0] || null;

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
      templatesRes,
    ] = await Promise.all([
      authFetch(`${apiUrl(`/api/operations/calendars/${id}/`)}`),
      authFetch(`${apiUrl(`/api/operations/calendars/${id}/assignments/`)}`),
      authFetch(`${apiUrl(`/api/operations/calendars/${id}/cells/`)}`),
      authFetch(`${apiUrl(`/api/operations/calendars/${id}/summary/`)}`),
      authFetch(`${apiUrl(`/api/operations/calendars/${id}/assignment-totals/`)}`),
      authFetch(`${apiUrl('/api/employees/')}`),
      authFetch(`${apiUrl('/api/operations/positions/')}`),
      authFetch(`${apiUrl('/api/buildingfloors/')}`),
      authFetch(`${apiUrl('/api/operations/attendance-statuses/')}`),
      authFetch(`${apiUrl('/api/operations/work-time-codes/')}`),
      authFetch(`${apiUrl('/api/operations/operational-codes/')}`),
      authFetch(`${apiUrl('/api/operations/rotation-group-styles/')}`),
      authFetch(`${apiUrl('/api/operations/visual-categories/')}`),
      authFetch(`${apiUrl('/api/operations/calendar-templates/')}`),
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
      setPatternForm((current) => ({
        ...current,
        start_date: current.start_date || `${loadedCalendar.year}-${String(loadedCalendar.month).padStart(2, '0')}-01`,
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
    if (templatesRes.ok) {
      setTemplates(normalizeList(await templatesRes.json()));
    } else {
      setTemplates([]);
    }

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
      if (!templatesRes.ok) {
        setStatusMessage('Grade carregada. Templates indisponíveis neste ambiente.');
      } else {
        setStatusMessage('');
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!employeeSearchRef.current) return;
      if (!employeeSearchRef.current.contains(event.target)) {
        setEmployeeSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    setEmployeeHighlightIndex(0);
  }, [employeeSearchTerm, employeeOptions.length]);

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

  const buildCellForm = (assignment, day) => {
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
    return { existing, form };
  };

  const selectCellOnly = (assignment, day, { shiftKey = false, startDrag = false } = {}) => {
    const { existing, form } = buildCellForm(assignment, day);
    setSelectedCell({ assignment, day, existing });
    setCellForm(form);
    const row = assignmentIndexById[assignment.id];
    const col = dayIndexByDate[day.date];
    if (row == null || col == null) return;
    setActiveCell({ row, col, assignmentId: assignment.id, date: day.date });
    if (shiftKey && selectionAnchor) {
      setSelectionRange({ anchor: selectionAnchor, target: { row, col } });
    } else {
      setSelectionAnchor({ row, col });
      setSelectionRange(null);
    }
    if (startDrag) setIsDraggingSelection(true);
  };

  const openCellEditor = (assignment, day) => {
    const { existing, form } = buildCellForm(assignment, day);
    setSelectedCell({ assignment, day, existing });
    setCellForm(form);
    setInlineCellForm(form);
    setEditingCell({ assignmentId: assignment.id, date: day.date });
    const row = assignmentIndexById[assignment.id];
    const col = dayIndexByDate[day.date];
    if (row != null && col != null) {
      setActiveCell({ row, col, assignmentId: assignment.id, date: day.date });
      if (!selectionAnchor) setSelectionAnchor({ row, col });
    }
  };

  const addAssignment = async (event) => {
    event.preventDefault();
    if (!assignmentForm.employee) {
      setIsError(true);
      setStatusMessage('Selecione um funcionário para adicionar.');
      return;
    }
    setAddingAssignment(true);
    setIsError(false);
    setStatusMessage('');

    const payload = {
      ...assignmentForm,
      display_order: Number(assignmentForm.display_order || 0),
      default_position: assignmentForm.default_position ? Number(assignmentForm.default_position) : null,
    };

    const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/assignments/`)}`, {
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
    setEmployeeSearchTerm('');
    setEmployeeSearchOpen(false);
    setEmployeeHighlightIndex(0);
    setStatusMessage(t('operations.assignmentCreated'));
    await loadData();
    setAddingAssignment(false);
  };

  const selectEmployeeOption = (option) => {
    if (!option || option.alreadyLinked) return;
    setAssignmentForm((current) => ({ ...current, employee: option.employeeId }));
    setEmployeeSearchTerm(`${option.name} (${option.code})`);
    setEmployeeSearchOpen(false);
  };

  const generateSchedule = async (event) => {
    event.preventDefault();
    setGeneratingSchedule(true);
    setIsError(false);
    setStatusMessage('');
    setGenerateResult(null);

    const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/generate-schedule/`)}`, {
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

    const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/import-employees/`)}`, {
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
    await loadImportPreview();
    setImportingEmployees(false);
  };

  const loadImportPreview = async () => {
    if (!id) return;
    const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/import-employees-preview/?import_all=true`)}`);
    const data = await readJson(res);
    if (!res.ok) {
      setImportPreview(null);
      return;
    }
    setImportPreview(data);
  };

  const syncAssignmentsFromMaster = async () => {
    if (loading || syncingAssignments) return;
    const confirmed = window.confirm('Sincronizar grupo, turno, padrão, posição padrão e categoria a partir do cadastro master? As células da escala não serão alteradas.');
    if (!confirmed) return;
    setSyncingAssignments(true);
    setIsError(false);
    setStatusMessage('');
    const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/sync-assignments/`)}`, { method: 'POST' });
    const data = await readJson(res);
    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Falha ao sincronizar assignments.'));
      setIsError(true);
      setSyncingAssignments(false);
      return;
    }
    setStatusMessage(`${data?.updated || 0} funcionários sincronizados`);
    await loadData();
    await loadImportPreview();
    setSyncingAssignments(false);
  };

  const openAssignmentEditor = (assignment) => {
    setEditingAssignment(assignment);
    setEditingAssignmentForm({
      operational_category: assignment.operational_category || 'normal',
      work_pattern: assignment.work_pattern || '4x2',
      shift_type: assignment.shift_type || 'day',
      rotation_group: assignment.rotation_group || '',
      default_position: assignment.default_position || '',
    });
  };

  const updateEditingAssignmentField = (event) => {
    const { name, value } = event.target;
    setEditingAssignmentForm((current) => ({ ...current, [name]: value }));
  };

  const saveAssignmentEdit = async () => {
    if (!editingAssignment || !editingAssignmentForm) return;
    setAddingAssignment(true);
    setIsError(false);
    setStatusMessage('');
    const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/assignments/${editingAssignment.id}/`)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...editingAssignmentForm,
        default_position: editingAssignmentForm.default_position ? Number(editingAssignmentForm.default_position) : null,
      }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Falha ao editar linha do funcionário.'));
      setIsError(true);
      setAddingAssignment(false);
      return;
    }
    setStatusMessage('Linha do funcionário atualizada.');
    setEditingAssignment(null);
    setEditingAssignmentForm(null);
    await loadData();
    setAddingAssignment(false);
  };

  const duplicateFromPreviousMonth = async () => {
    const firstConfirm = window.confirm(
      'Duplicar mês anterior para este calendário? Funcionários e base operacional serão copiados de forma conservadora.'
    );
    if (!firstConfirm) return;

    setProcessingMonthOps(true);
    setIsError(false);
    setStatusMessage('');

    let overwrite = false;
    // up to two attempts: first normal, second with overwrite after user confirm.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/duplicate-from-previous/`)}`, {
        method: 'POST',
        body: JSON.stringify({
          copy_base_cells: true,
          overwrite,
        }),
      });
      const data = await readJson(res);
      if (res.ok) {
        setStatusMessage(
          `Duplicação concluída: ${data?.created_assignments || 0} linhas, ${data?.created_cells || 0} células`
        );
        await loadData();
        setProcessingMonthOps(false);
        return;
      }
      if (res.status === 409 && data?.requires_confirmation && !overwrite) {
        const overwriteConfirm = window.confirm(
          `Destino já possui dados (${data?.target_assignment_count || 0} linhas, ${
            data?.target_cell_count || 0
          } células). Deseja sobrescrever?`
        );
        if (!overwriteConfirm) {
          setStatusMessage('Operação cancelada pelo usuário.');
          setProcessingMonthOps(false);
          return;
        }
        overwrite = true;
        continue;
      }
      setStatusMessage(formatApiMessage(data, 'Falha ao duplicar mês anterior.'));
      setIsError(true);
      setProcessingMonthOps(false);
      return;
    }
    setProcessingMonthOps(false);
  };

  const generateNextMonth = async () => {
    const firstConfirm = window.confirm(
      'Gerar próximo mês com base no calendário atual? Isso pode criar novo calendário e copiar a estrutura.'
    );
    if (!firstConfirm) return;

    setProcessingMonthOps(true);
    setIsError(false);
    setStatusMessage('');

    let overwriteExisting = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/generate-next-month/`)}`, {
        method: 'POST',
        body: JSON.stringify({
          copy_assignments: true,
          copy_base_cells: false,
          overwrite_existing: overwriteExisting,
        }),
      });
      const data = await readJson(res);
      if (res.ok) {
        setStatusMessage(
          `Próximo mês ${data?.target_year}-${String(data?.target_month || '').padStart(2, '0')} pronto: ${
            data?.created_assignments || 0
          } linhas, ${data?.created_cells || 0} células`
        );
        await loadData();
        setProcessingMonthOps(false);
        return;
      }
      if (res.status === 409 && data?.requires_confirmation && !overwriteExisting) {
        const overwriteConfirm = window.confirm(
          `Próximo mês já possui dados (${data?.target_assignment_count || 0} linhas, ${
            data?.target_cell_count || 0
          } células). Deseja sobrescrever?`
        );
        if (!overwriteConfirm) {
          setStatusMessage('Operação cancelada pelo usuário.');
          setProcessingMonthOps(false);
          return;
        }
        overwriteExisting = true;
        continue;
      }
      setStatusMessage(formatApiMessage(data, 'Falha ao gerar próximo mês.'));
      setIsError(true);
      setProcessingMonthOps(false);
      return;
    }
    setProcessingMonthOps(false);
  };

  const exportExcel = async () => {
    if (isGridBusy) return;
    setExportingExcel(true);
    setIsError(false);
    setStatusMessage('');
    try {
      const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/export-excel/`)}`);
      if (!res.ok) {
        const data = await readJson(res);
        setStatusMessage(formatApiMessage(data, 'Falha ao exportar Excel.'));
        setIsError(true);
        setExportingExcel(false);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const fallbackName = calendar
        ? `escala_${calendar.year}_${String(calendar.month).padStart(2, '0')}.xlsx`
        : 'escala_operacional.xlsx';
      const filename = match?.[1] || fallbackName;
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      setStatusMessage('Excel exportado com sucesso.');
    } catch {
      setStatusMessage('Falha ao exportar Excel.');
      setIsError(true);
    } finally {
      setExportingExcel(false);
    }
  };

  const openSaveTemplatePanel = () => {
    if (!calendar || isGridBusy) return;
    setShowApplyTemplatePanel(false);
    setTemplateNeedsOverwrite(false);
    setTemplateTargetCounts({ assignments: 0, cells: 0 });
    setTemplateName(`${calendar.year}-${String(calendar.month).padStart(2, '0')} ${calendar.title || 'Template'}`);
    setTemplateDescription('');
    setShowSaveTemplatePanel(true);
  };

  const saveAsTemplate = async () => {
    if (!calendar || isGridBusy || !templateName.trim()) return;
    setProcessingTemplates(true);
    setIsError(false);
    setStatusMessage('');
    try {
      const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/save-template/`)}`, {
        method: 'POST',
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim(),
          scope_from_calendar: true,
          include_base_cells: true,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setStatusMessage(formatApiMessage(data, 'Falha ao salvar template.'));
        setIsError(true);
        setProcessingTemplates(false);
        return;
      }
      setStatusMessage(
        `Template salvo: ${data?.template_name || templateName.trim()} (${data?.created_assignments || 0} linhas, ${data?.created_cells || 0} células)`
      );
      setShowSaveTemplatePanel(false);
      await loadData();
    } finally {
      setProcessingTemplates(false);
    }
  };

  const openApplyTemplatePanel = () => {
    if (!calendar || isGridBusy) return;
    setShowSaveTemplatePanel(false);
    setTemplateNeedsOverwrite(false);
    setTemplateTargetCounts({ assignments: 0, cells: 0 });
    setSelectedTemplateId(templates[0]?.id ? String(templates[0].id) : '');
    setShowApplyTemplatePanel(true);
  };

  const applyTemplate = async () => {
    if (!calendar || isGridBusy) return;
    if (!templates.length) {
      setStatusMessage('Nenhum template disponível.');
      setIsError(true);
      return;
    }
    const templateId = Number(selectedTemplateId);
    if (!templateId) return;

    setProcessingTemplates(true);
    setIsError(false);
    setStatusMessage('');
    const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/apply-template/`)}`, {
      method: 'POST',
      body: JSON.stringify({ template_id: templateId, overwrite: templateNeedsOverwrite }),
    });
    const data = await readJson(res);
    if (res.ok) {
      setStatusMessage(`Template aplicado: ${data?.created_assignments || 0} linhas, ${data?.created_cells || 0} células`);
      setShowApplyTemplatePanel(false);
      setTemplateNeedsOverwrite(false);
      await loadData();
      setProcessingTemplates(false);
      return;
    }
    if (res.status === 409 && data?.requires_confirmation && !templateNeedsOverwrite) {
      setTemplateNeedsOverwrite(true);
      setTemplateTargetCounts({
        assignments: data?.target_assignment_count || 0,
        cells: data?.target_cell_count || 0,
      });
      setStatusMessage('Destino possui dados. Confirme sobrescrita para aplicar o template.');
      setIsError(false);
      setProcessingTemplates(false);
      return;
    }
    setStatusMessage(formatApiMessage(data, 'Falha ao aplicar template.'));
    setIsError(true);
    setProcessingTemplates(false);
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

    const res = await authFetch(`${apiUrl('/api/operations/positions/')}`, {
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
      ? `${apiUrl(`/api/operations/calendars/${id}/requirements/${existing.requirement_id}/`)}`
      : `${apiUrl(`/api/operations/calendars/${id}/requirements/`)}`;
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

  const replicateRequirement = async (mode, weekdaysOnly = false) => {
    if (!requirementForm.position || !requirementForm.date) {
      setIsError(true);
      setStatusMessage('Selecione posição e data para replicar.');
      return;
    }
    const modeText = mode === 'all' ? 'todos os dias do mês' : 'dias restantes do mês';
    const weekText = weekdaysOnly ? ' (somente dias úteis)' : '';
    const confirmed = window.confirm(`Replicar a quantidade necessária para ${modeText}${weekText}?`);
    if (!confirmed) return;

    setSavingRequirement(true);
    setIsError(false);
    setStatusMessage('');
    const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/requirements/replicate/`)}`, {
      method: 'POST',
      body: JSON.stringify({
        position: Number(requirementForm.position),
        date: requirementForm.date,
        required_headcount: Number(requirementForm.required_headcount || 0),
        notes: requirementForm.notes,
        mode,
        weekdays_only: weekdaysOnly,
      }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Falha ao replicar quantidade necessária.'));
      setIsError(true);
      setSavingRequirement(false);
      return;
    }
    setStatusMessage(`Quantidade replicada para ${data?.affected_days || 0} dias`);
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

    const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/cells/paste/`)}`, {
      method: 'POST',
      body: JSON.stringify({
        start_assignment: selectedCell.assignment.id,
        start_date: selectedCell.day.date,
        tsv: pasteText,
        history_source: 'paste',
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

  const saveCellPayload = async ({ assignment, day, existing, form, silent = false, historySource = 'inline_edit' }) => {
    const payload = {
      ...form,
      assignment: assignment.id,
      date: day.date,
      position: form.position ? Number(form.position) : null,
      attendance_status: form.attendance_status ? Number(form.attendance_status) : null,
      work_time_code: form.work_time_code ? Number(form.work_time_code) : null,
      operational_code: form.operational_code ? Number(form.operational_code) : null,
      overtime_minutes: Number(form.overtime_minutes || 0),
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      break_minutes: Number(form.break_minutes || 0),
      crosses_midnight: Boolean(form.crosses_midnight),
      manual_time_override: Boolean(form.manual_time_override),
      leave_time: form.leave_time || null,
      time_note: form.time_note || '',
      history_source: historySource,
    };

    const key = assignment.id + '-' + day.date;
    const existingId = existing?.id || cellMap[key]?.id;
    const url = existingId
      ? apiUrl('/api/operations/calendars/' + id + '/cells/' + existingId + '/')
      : apiUrl('/api/operations/calendars/' + id + '/cells/');
    const method = existingId ? 'PATCH' : 'POST';

    setSavingCellKeys((current) => ({ ...current, [key]: true }));
    setCellErrorKeys((current) => ({ ...current, [key]: false }));

    const optimistic = {
      ...(cellMap[key] || {}),
      ...payload,
      id: existingId || cellMap[key]?.id || null,
      assignment: assignment.id,
      date: day.date,
      position_detail: payload.position ? positionById[payload.position] : null,
      attendance_status_detail: payload.attendance_status ? attendanceStatusById[payload.attendance_status] : null,
      work_time_code_detail: payload.work_time_code ? workTimeCodeById[payload.work_time_code] : null,
      operational_code_detail: payload.operational_code ? operationalCodeById[payload.operational_code] : null,
    };

    setCells((current) => {
      const idx = current.findIndex((item) => item.assignment === assignment.id && item.date === day.date);
      if (idx === -1) return [...current, optimistic];
      const next = [...current];
      next[idx] = { ...next[idx], ...optimistic };
      return next;
    });

    const res = await authFetch(url, { method, body: JSON.stringify(payload) });
    const data = await readJson(res);

    if (!res.ok) {
      setCellErrorKeys((current) => ({ ...current, [key]: true }));
      setStatusMessage(formatApiMessage(data, t('operations.cellSaveError')));
      setIsError(true);
      await loadData();
      setSavingCellKeys((current) => ({ ...current, [key]: false }));
      return false;
    }

    setCells((current) => {
      const idx = current.findIndex((item) => item.assignment === assignment.id && item.date === day.date);
      const saved = data || optimistic;
      if (idx === -1) return [...current, saved];
      const next = [...current];
      next[idx] = saved;
      return next;
    });

    setSavingCellKeys((current) => ({ ...current, [key]: false }));
    if (!silent) setStatusMessage(t('operations.cellSaved'));
    return true;
  };

  const executeCellUpdates = async (updates, { label = 'update', recordHistory = true, silent = false } = {}) => {
    if (!Array.isArray(updates) || updates.length === 0) return { ok: true, successCount: 0 };
    if (isGridBusy) return { ok: false, successCount: 0 };

    const before = [];
    for (const update of updates) {
      const key = `${update.assignment.id}-${update.day.date}`;
      const { form } = buildCellForm(update.assignment, update.day);
      before.push({ assignment: update.assignment, day: update.day, form, key });
    }

    const results = await Promise.all(
      updates.map((update) =>
        saveCellPayload({
          assignment: update.assignment,
          day: update.day,
          existing: update.existing,
          form: update.form,
          silent: true,
          historySource: label,
        })
      )
    );

    const successCount = results.filter(Boolean).length;
    const ok = successCount === updates.length;
    if (ok && recordHistory && !isApplyingHistory) {
      const after = updates.map((update) => ({
        assignment: update.assignment,
        day: update.day,
        form: update.form,
        key: `${update.assignment.id}-${update.day.date}`,
      }));
      setHistoryStack((current) => [...current.slice(-(HISTORY_LIMIT - 1)), { label, before, after }]);
      setRedoStack([]);
    }

    if (!silent) {
      const feedbackByLabel = {
        'inline-edit': (count) => `${count} células alteradas`,
        'batch-apply': (count) => `${count} células alteradas`,
        'batch-status': (count) => `${count} células alteradas`,
        'batch-op-code': (count) => `${count} células alteradas`,
        'batch-clear': (count) => `Range limpo (${count})`,
        'fill-handle': (count) => `${count} células alteradas`,
        'pattern-4x2': (count) => `Padrão 4x2 aplicado em ${count} células`,
        paste: (count) => `${count} células alteradas`,
      };
      if (successCount > 0) {
        const formatter = feedbackByLabel[label];
        setStatusMessage(formatter ? formatter(successCount) : `${successCount} células alteradas`);
        setIsError(false);
      } else {
        setIsError(true);
      }
    }

    return { ok, successCount };
  };

  const saveCell = async (event) => {
    event.preventDefault();
    if (!selectedCell) return;
    setSavingCell(true);
    setIsError(false);
    setStatusMessage('');
    const { ok } = await executeCellUpdates(
      [
        {
          assignment: selectedCell.assignment,
          day: selectedCell.day,
          existing: selectedCell.existing,
          form: cellForm,
        },
      ],
      { label: 'inline-edit', recordHistory: true, silent: true }
    );
    if (ok) {
      setSelectedCell(null);
      setCellForm(emptyCellForm());
    }
    setSavingCell(false);
  };

  const normalizeCellText = (value) =>
    String(value ?? '')
      .replace(/\r?\n/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const shortenCellText = (value, maxLen = 40) => {
    const text = normalizeCellText(value);
    if (!text) return '';
    return text.length > maxLen ? text.slice(0, maxLen).trim() : text;
  };

  const getPositionSummaryParts = (cell, maxLen = 40) => {
    if (!cell) return [];
    const positionDetail = cell.position_detail || {};
    const fullPosition = positionById[positionDetail.id] || positionDetail;

    const positionToken = shortenCellText(positionDetail.code || positionDetail.name_jp || positionDetail.name_pt, maxLen);
    if (!positionToken) return [];

    const floorRef =
      buildingFloorById[positionDetail.building_floor] ||
      buildingFloorById[fullPosition.building_floor] ||
      null;
    const floorToken = shortenCellText(
      floorRef?.code ||
        floorRef?.label_jp ||
        floorRef?.label_pt ||
        positionDetail.building_floor_code ||
        fullPosition.building_floor_code ||
        positionDetail.location ||
        fullPosition.location,
      maxLen
    );

    if (!floorToken) return [positionToken];
    if (normalizeCellText(positionToken).includes(normalizeCellText(floorToken))) return [positionToken];
    return [positionToken, floorToken];
  };

  const renderCellText = (cell) => {
    if (!cell) return '';
    const positionParts = getPositionSummaryParts(cell);
    if (positionParts.length > 0) return positionParts.join(' / ');
    if (cell.raw_value) return normalizeCellText(cell.raw_value);
    const parts = [
      cell.operational_code_detail?.label_jp,
      cell.operational_code_detail?.code,
      cell.attendance_status_detail?.label_jp,
      cell.work_time_code_detail?.label_jp,
    ]
      .map((part) => normalizeCellText(part))
      .filter(Boolean);
    return parts.join(' ');
  };

  const getCellSemanticClass = (cell) => {
    if (!cell) return 'is-empty';
    const status = cell.attendance_status_detail;
    const opCategory = cell.operational_code_detail?.category;
    if (status?.is_absence) return 'is-absence';
    if (status?.is_working_day === false) return 'is-rest';
    if (['special', 'special_shift', 'exception'].includes(opCategory)) return 'is-special';
    if (opCategory === 'alert') return 'is-alert';
    return 'is-work';
  };

  const getCellDisplayLines = (cell) => {
    if (!cell) return ['-'];
    const positionParts = getPositionSummaryParts(cell);
    if (positionParts.length > 0) return positionParts;
    if (cell.raw_value) return [normalizeCellText(cell.raw_value)];
    const primary =
      cell.operational_code_detail?.label_jp ||
      cell.operational_code_detail?.code ||
      cell.attendance_status_detail?.label_jp ||
      '-';
    const secondary =
      cell.position_detail?.code ||
      cell.work_time_code_detail?.label_jp ||
      cell.work_time_code_detail?.code ||
      '';
    return secondary ? [primary, secondary] : [primary];
  };

  const getCellByCoord = (row, col) => {
    const assignment = assignmentsForGrid[row];
    const day = days[col];
    if (!assignment || !day) return null;
    return { assignment, day };
  };

  const moveActiveCell = (rowDelta, colDelta, { anchor = false } = {}) => {
    const baseRow = activeCell?.row ?? 0;
    const baseCol = activeCell?.col ?? 0;
    const row = Math.max(0, Math.min(assignmentsForGrid.length - 1, baseRow + rowDelta));
    const col = Math.max(0, Math.min(days.length - 1, baseCol + colDelta));
    const target = getCellByCoord(row, col);
    if (!target) return;
    selectCellOnly(target.assignment, target.day, { shiftKey: anchor });
  };

  const performUndo = async () => {
    const last = historyStack[historyStack.length - 1];
    if (!last || isApplyingHistory) return;
    setIsApplyingHistory(true);
    const undoUpdates = last.before.map((item) => ({
      assignment: item.assignment,
      day: item.day,
      existing: cellMap[item.key] || null,
      form: item.form,
    }));
    await executeCellUpdates(undoUpdates, { label: 'undo', recordHistory: false, silent: true });
    setHistoryStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, last]);
    setStatusMessage('Desfeito');
    setIsError(false);
    setIsApplyingHistory(false);
  };

  const performRedo = async () => {
    const last = redoStack[redoStack.length - 1];
    if (!last || isApplyingHistory) return;
    setIsApplyingHistory(true);
    const redoUpdates = last.after.map((item) => ({
      assignment: item.assignment,
      day: item.day,
      existing: cellMap[item.key] || null,
      form: item.form,
    }));
    await executeCellUpdates(redoUpdates, { label: 'redo', recordHistory: false, silent: true });
    setRedoStack((current) => current.slice(0, -1));
    setHistoryStack((current) => [...current, last]);
    setStatusMessage('Refeito');
    setIsError(false);
    setIsApplyingHistory(false);
  };

  const handleGridKeyDown = async (event) => {
    const targetTag = event.target?.tagName?.toLowerCase();
    const isTypingTarget =
      targetTag === 'input' ||
      targetTag === 'textarea' ||
      targetTag === 'select' ||
      event.target?.isContentEditable;

    if (isTypingTarget) {
      if (event.key === 'Escape' && editingCell) {
        event.preventDefault();
        setEditingCell(null);
        setInlineCellForm(emptyCellForm());
      }
      return;
    }

    if (assignmentsForGrid.length === 0 || days.length === 0) return;
    if (!activeCell) {
      const target = getCellByCoord(0, 0);
      if (target) selectCellOnly(target.assignment, target.day);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      await performUndo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      await performRedo();
      return;
    }

    if (editingCell && event.key === 'Escape') {
      event.preventDefault();
      setEditingCell(null);
      setInlineCellForm(emptyCellForm());
      return;
    }

    if (editingCell) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveActiveCell(0, 1, { anchor: event.shiftKey });
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveActiveCell(0, -1, { anchor: event.shiftKey });
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveCell(1, 0, { anchor: event.shiftKey });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveCell(-1, 0, { anchor: event.shiftKey });
    } else if (event.key === 'Tab') {
      event.preventDefault();
      moveActiveCell(0, event.shiftKey ? -1 : 1, { anchor: event.shiftKey });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      moveActiveCell(1, 0, { anchor: event.shiftKey });
    } else if (event.key === 'Home') {
      event.preventDefault();
      const target = getCellByCoord(activeCell.row, 0);
      if (target) selectCellOnly(target.assignment, target.day, { shiftKey: event.shiftKey });
    } else if (event.key === 'End') {
      event.preventDefault();
      const target = getCellByCoord(activeCell.row, Math.max(days.length - 1, 0));
      if (target) selectCellOnly(target.assignment, target.day, { shiftKey: event.shiftKey });
    } else if (event.key === 'F2') {
      event.preventDefault();
      const target = getCellByCoord(activeCell.row, activeCell.col);
      if (target) openCellEditor(target.assignment, target.day);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      await copySelectionToClipboard();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      try {
        if (navigator?.clipboard?.read) {
          const items = await navigator.clipboard.read();
          for (const item of items) {
            if (item.types.includes('application/x-fujihub-grid')) {
              const blob = await item.getType('application/x-fujihub-grid');
              const jsonRaw = await blob.text();
              const payload = JSON.parse(jsonRaw);
              const handled = await applyClipboardPayload(payload);
              if (handled) return;
            }
          }
        }
        if (internalClipboardRef.current?.payload) {
          const handled = await applyClipboardPayload(internalClipboardRef.current.payload);
          if (handled) return;
        }
        if (navigator?.clipboard?.readText) {
          const text = await navigator.clipboard.readText();
          const cached = internalClipboardRef.current;
          if (cached?.payload && text && cached.plainText === text) {
            const handled = await applyClipboardPayload(cached.payload);
            if (handled) return;
          }
          await applyClipboardText(text);
          return;
        }
      } catch {
        // Fallback: native onPaste handler on the grid may still process this.
      }
    }
  };

  const applyQuickToSelection = async (changes, options = {}) => {
    if (!activeCell || isGridBusy) return;
    const bounds = selectionRange && selectionRange.anchor && selectionRange.target
      ? {
          startRow: Math.min(selectionRange.anchor.row, selectionRange.target.row),
          endRow: Math.max(selectionRange.anchor.row, selectionRange.target.row),
          startCol: Math.min(selectionRange.anchor.col, selectionRange.target.col),
          endCol: Math.max(selectionRange.anchor.col, selectionRange.target.col),
        }
      : { startRow: activeCell.row, endRow: activeCell.row, startCol: activeCell.col, endCol: activeCell.col };

    const updates = [];
    for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
      for (let col = bounds.startCol; col <= bounds.endCol; col += 1) {
        const target = getCellByCoord(row, col);
        if (!target) continue;
        const { existing, form } = buildCellForm(target.assignment, target.day);
        const merged = { ...form, ...changes };
        updates.push({ assignment: target.assignment, day: target.day, existing, form: merged });
      }
    }
    if (updates.length === 0) return;
    const result = await executeCellUpdates(updates, {
      label: options.label || 'batch-apply',
      recordHistory: true,
      silent: false,
    });
    if (!result.ok) return;
  };

  const getSelectionBounds = () => {
    if (!activeCell) return null;
    if (selectionRange?.anchor && selectionRange?.target) {
      return {
        startRow: Math.min(selectionRange.anchor.row, selectionRange.target.row),
        endRow: Math.max(selectionRange.anchor.row, selectionRange.target.row),
        startCol: Math.min(selectionRange.anchor.col, selectionRange.target.col),
        endCol: Math.max(selectionRange.anchor.col, selectionRange.target.col),
      };
    }
    return { startRow: activeCell.row, endRow: activeCell.row, startCol: activeCell.col, endCol: activeCell.col };
  };

  const hasRangeSelection = Boolean(selectionRange?.anchor && selectionRange?.target);

  const updatePatternField = (event) => {
    const { name, value } = event.target;
    setPatternForm((current) => ({
      ...current,
      [name]: name === 'work_days' || name === 'off_days' ? Number(value || 0) : value,
    }));
  };

  const findStatusIdByHints = (hints = []) => {
    const normalizedHints = hints.map((h) => String(h || '').toLowerCase());
    const item = attendanceStatuses.find((status) => {
      const values = [status.code, status.label_jp, status.label_pt].map((v) => String(v || '').toLowerCase());
      return normalizedHints.some((hint) => values.some((value) => value.includes(hint)));
    });
    return item ? String(item.id) : '';
  };

  const findOperationalCodeIdByHints = (hints = []) => {
    const normalizedHints = hints.map((h) => String(h || '').toLowerCase());
    const item = operationalCodes.find((code) => {
      const values = [code.code, code.label_jp, code.label_pt].map((v) => String(v || '').toLowerCase());
      return normalizedHints.some((hint) => values.some((value) => value.includes(hint)));
    });
    return item ? String(item.id) : '';
  };

  const applyPatternPreset = async (preset) => {
    if (!hasRangeSelection || !activeCell || isGridBusy) {
      setStatusMessage('Selecione um range válido');
      setIsError(true);
      return;
    }

    setLastPatternPreset(preset);

    if (preset === 'clear') {
      await applyQuickToSelection(
        {
          position: '',
          attendance_status: '',
          operational_code: '',
          work_time_code: '',
          raw_value: '',
        },
        { label: 'batch-clear' }
      );
      return;
    }

    if (preset === 'off-only') {
      const offStatus = patternForm.off_attendance_status || findStatusIdByHints(['folga', '休', 'off']);
      if (!offStatus) {
        setStatusMessage('Status de folga não encontrado');
        setIsError(true);
        return;
      }
      await applyQuickToSelection({ attendance_status: String(offStatus), operational_code: '' }, { label: 'batch-status' });
      return;
    }

    const isNight = preset === '4x2-night';
    const workStatus = isNight
      ? patternForm.work_attendance_status || findStatusIdByHints(['noite', 'night', '夜'])
      : patternForm.work_attendance_status || findStatusIdByHints(['trabalho', 'work', '出勤']);
    const offStatus = patternForm.off_attendance_status || findStatusIdByHints(['folga', '休', 'off']);
    const workCode = isNight
      ? patternForm.work_operational_code || findOperationalCodeIdByHints(['noite', 'night', '夜'])
      : patternForm.work_operational_code || findOperationalCodeIdByHints(['dia', 'day', '日']);

    const nextForm = {
      ...patternForm,
      work_days: 4,
      off_days: 2,
      work_attendance_status: workStatus || patternForm.work_attendance_status,
      off_attendance_status: offStatus || patternForm.off_attendance_status,
      work_operational_code: workCode || patternForm.work_operational_code,
    };

    setPatternForm(nextForm);

    await applyFourTwoPattern(nextForm);
  };

  const applyFourTwoPattern = async (overrideForm = null) => {
    if (!hasRangeSelection || !activeCell || isGridBusy) {
      setStatusMessage('Selecione um range válido para aplicar 4x2');
      setIsError(true);
      return;
    }

    const formRef = overrideForm || patternForm;
    const workDays = Number(formRef.work_days || 0);
    const offDays = Number(formRef.off_days || 0);
    if (!formRef.start_date || workDays <= 0 || offDays <= 0) {
      setStatusMessage('Parâmetros inválidos para padrão 4x2');
      setIsError(true);
      return;
    }

    const cycleLen = workDays + offDays;
    const startDate = new Date(`${formRef.start_date}T00:00:00`);
    if (Number.isNaN(startDate.getTime())) {
      setStatusMessage('Data inicial inválida');
      setIsError(true);
      return;
    }

    const workOpId = formRef.work_operational_code ? Number(formRef.work_operational_code) : null;
    const workStatusId = formRef.work_attendance_status ? Number(formRef.work_attendance_status) : null;
    const offStatusId = formRef.off_attendance_status ? Number(formRef.off_attendance_status) : null;

    if (workOpId && !operationalCodeById[workOpId]) {
      setStatusMessage('Código operacional de trabalho inválido');
      setIsError(true);
      return;
    }
    if (workStatusId && !attendanceStatusById[workStatusId]) {
      setStatusMessage('Status de trabalho inválido');
      setIsError(true);
      return;
    }
    if (offStatusId && !attendanceStatusById[offStatusId]) {
      setStatusMessage('Status de folga inválido');
      setIsError(true);
      return;
    }

    const bounds = getSelectionBounds();
    if (!bounds) return;
    const updates = [];

    for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
      for (let col = bounds.startCol; col <= bounds.endCol; col += 1) {
        const target = getCellByCoord(row, col);
        if (!target) continue;
        const { existing, form } = buildCellForm(target.assignment, target.day);
        const targetDate = new Date(`${target.day.date}T00:00:00`);
        const diffDays = Math.floor((targetDate - startDate) / 86400000);
        const cycleIndex = ((diffDays % cycleLen) + cycleLen) % cycleLen;
        const isWorkDay = cycleIndex < workDays;

        const merged = { ...form };
        if (isWorkDay) {
          merged.operational_code = workOpId ? String(workOpId) : '';
          merged.attendance_status = workStatusId ? String(workStatusId) : '';
        } else {
          merged.attendance_status = offStatusId ? String(offStatusId) : '';
          merged.operational_code = '';
        }

        updates.push({ assignment: target.assignment, day: target.day, existing, form: merged });
      }
    }

    if (updates.length === 0) return;
    const result = await executeCellUpdates(updates, {
      label: 'pattern-4x2',
      recordHistory: true,
      silent: false,
    });
    if (!result.ok) return;
    setShowPatternPanel(false);
  };

  const startFillDrag = (assignment, day) => {
    if (isGridBusy) return;
    const row = assignmentIndexById[assignment.id];
    const col = dayIndexByDate[day.date];
    if (row == null || col == null) return;
    const { form } = buildCellForm(assignment, day);
    setFillDragState({
      anchor: { row, col, assignment, day },
      target: { row, col, assignment, day },
      sourceForm: form,
    });
  };

  const updateFillDrag = (assignment, day) => {
    if (!fillDragState || isGridBusy) return;
    const row = assignmentIndexById[assignment.id];
    const col = dayIndexByDate[day.date];
    if (row == null || col == null) return;
    setFillDragState((current) => (current ? { ...current, target: { row, col, assignment, day } } : current));
  };

  const getFillBounds = () => {
    if (!fillDragState) return null;
    const { anchor, target } = fillDragState;
    return {
      startRow: Math.min(anchor.row, target.row),
      endRow: Math.max(anchor.row, target.row),
      startCol: Math.min(anchor.col, target.col),
      endCol: Math.max(anchor.col, target.col),
    };
  };

  const applyFillDrag = async () => {
    if (!fillDragState) return;
    const bounds = getFillBounds();
    if (!bounds) return;
    const { anchor, sourceForm } = fillDragState;
    const updates = [];
    for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
      for (let col = bounds.startCol; col <= bounds.endCol; col += 1) {
        if (row === anchor.row && col === anchor.col) continue;
        const target = getCellByCoord(row, col);
        if (!target) continue;
        const { existing } = buildCellForm(target.assignment, target.day);
        updates.push({
          assignment: target.assignment,
          day: target.day,
          existing,
          form: { ...sourceForm, assignment: target.assignment.id, date: target.day.date },
        });
      }
    }
    setFillDragState(null);
    if (updates.length === 0) return;
    await executeCellUpdates(updates, { label: 'fill-handle', recordHistory: true, silent: false });
  };

  const getCellClipboardValue = (cell) => {
    if (!cell) return '';

    const MAX_LEN = 40;
    const isLongText = (value) => normalizeCellText(value).length > MAX_LEN;

    const statusShort =
      shortenCellText(cell.attendance_status_detail?.code, MAX_LEN) ||
      shortenCellText(cell.attendance_status_detail?.label_jp, MAX_LEN) ||
      shortenCellText(cell.attendance_status_detail?.label_pt, MAX_LEN);

    const isAbsenceLike =
      cell.attendance_status_detail?.is_absence ||
      cell.attendance_status_detail?.is_working_day === false ||
      ['休', '欠', '有休'].includes(statusShort);

    if (isAbsenceLike && statusShort) {
      return statusShort;
    }

    const positionParts = getPositionSummaryParts(cell, MAX_LEN);
    if (positionParts.length > 0) {
      return shortenCellText(positionParts.join(' / '), MAX_LEN);
    }

    const operationalCodeShort = shortenCellText(cell.operational_code_detail?.code, MAX_LEN);
    if (operationalCodeShort) return operationalCodeShort;

    const fallbackWorkCode = shortenCellText(
      cell.work_time_code_detail?.code || cell.work_time_code_detail?.label_jp,
      MAX_LEN
    );
    if (fallbackWorkCode) return fallbackWorkCode;

    if (cell.raw_value && !isLongText(cell.raw_value)) {
      return shortenCellText(cell.raw_value, MAX_LEN);
    }

    return '';
  };

  const parseClipboardToken = (token, baseForm) => {
    const raw = String(token ?? '').trim();
    if (!raw) {
      return {
        ...baseForm,
        raw_value: '',
        operational_code: '',
        attendance_status: '',
      };
    }

    const normalizeKey = (value) =>
      String(value ?? '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const slashParts = raw
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);

    if (slashParts.length >= 2) {
      const positionToken = slashParts[0];
      const floorToken = slashParts.slice(1).join('/').trim();
      const positionNorm = normalizeKey(positionToken);
      const floorNorm = normalizeKey(floorToken);

      const positionCandidates = positions.filter((position) => {
        const keys = [
          position.code,
          position.name_jp,
          position.name_pt,
          `${position.code || ''} ${position.name_jp || ''}`.trim(),
          `${position.code || ''} ${position.name_pt || ''}`.trim(),
        ].map(normalizeKey);
        return keys.includes(positionNorm);
      });

      const resolveFloorNorm = (position) => {
        const floor = buildingFloorById[position.building_floor];
        return [
          floor?.code,
          floor?.label_jp,
          floor?.label_pt,
          position.building_floor_code,
          position.location,
        ]
          .map(normalizeKey)
          .find(Boolean);
      };

      let matchedPosition = null;
      if (positionCandidates.length > 0) {
        if (floorNorm) {
          matchedPosition =
            positionCandidates.find((position) => resolveFloorNorm(position) === floorNorm) ||
            (positionCandidates.length === 1 ? positionCandidates[0] : null);
        } else {
          matchedPosition = positionCandidates[0];
        }
      }

      if (matchedPosition) {
        return {
          ...baseForm,
          position: String(matchedPosition.id),
          raw_value: '',
        };
      }
    }

    const lower = raw.toLowerCase();
    const op = operationalCodes.find(
      (item) =>
        String(item.code || '').toLowerCase() === lower ||
        String(item.label_jp || '').toLowerCase() === lower ||
        String(item.label_pt || '').toLowerCase() === lower
    );
    if (op) {
      return {
        ...baseForm,
        operational_code: String(op.id),
        raw_value: '',
      };
    }

    const status = attendanceStatuses.find(
      (item) =>
        String(item.code || '').toLowerCase() === lower ||
        String(item.label_jp || '').toLowerCase() === lower ||
        String(item.label_pt || '').toLowerCase() === lower
    );
    if (status) {
      return {
        ...baseForm,
        attendance_status: String(status.id),
        raw_value: '',
      };
    }

    return {
      ...baseForm,
      raw_value: raw,
    };
  };

  const copySelectionToClipboard = async () => {
    const bounds = getSelectionBounds();
    if (!bounds) return;

    const lines = [];
    const matrix = [];
    const editableFields = [
      'position',
      'attendance_status',
      'work_time_code',
      'operational_code',
      'overtime_minutes',
      'start_time',
      'end_time',
      'break_minutes',
      'crosses_midnight',
      'manual_time_override',
      'leave_time',
      'time_note',
      'memo',
      'raw_value',
    ];
    for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
      const values = [];
      const payloadRow = [];
      for (let col = bounds.startCol; col <= bounds.endCol; col += 1) {
        const target = getCellByCoord(row, col);
        if (!target) {
          values.push('');
          payloadRow.push(null);
          continue;
        }
        const cell = cellMap[target.assignment.id + '-' + target.day.date];
        values.push(getCellClipboardValue(cell));
        const { form } = buildCellForm(target.assignment, target.day);
        const payloadForm = editableFields.reduce((acc, field) => {
          acc[field] = form[field] ?? '';
          return acc;
        }, {});
        payloadRow.push(payloadForm);
      }
      lines.push(values.join('	'));
      matrix.push(payloadRow);
    }

    const tsv = lines.join('\n');
    const internalPayload = JSON.stringify({
      version: 1,
      kind: 'fujihub-grid-cells',
      rows: matrix.length,
      cols: matrix[0]?.length || 0,
      matrix,
    });
    const internalPayloadObject = {
      version: 1,
      kind: 'fujihub-grid-cells',
      rows: matrix.length,
      cols: matrix[0]?.length || 0,
      matrix,
    };
    internalClipboardRef.current = {
      plainText: tsv,
      payload: internalPayloadObject,
      updatedAt: Date.now(),
    };
    if (import.meta.env.DEV) {
      console.debug('[grid-copy] internal payload', internalPayloadObject);
    }
    try {
      if (navigator?.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        const item = new ClipboardItem({
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
          'application/x-fujihub-grid': new Blob([internalPayload], { type: 'application/x-fujihub-grid' }),
        });
        await navigator.clipboard.write([item]);
        setStatusMessage('Copiado');
        setIsError(false);
        return;
      }
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(tsv);
        setStatusMessage('Copiado');
        setIsError(false);
        return;
      }
    } catch {
      // fallback below
    }

    // fallback execCommand for legacy browsers
    const textarea = document.createElement('textarea');
    textarea.value = tsv;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    setStatusMessage('Copiado');
    setIsError(false);
  };

  const applyClipboardText = async (text) => {
    const rawText = String(text || '');
    if (!rawText.trim()) {
      setStatusMessage('Conteudo de colagem invalido');
      setIsError(true);
      return;
    }
    if (!activeCell || isGridBusy) return;

    const rows = rawText
      .replace(/\r/g, '')
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => line.split('\t'));

    if (rows.length === 0) {
      setStatusMessage('Conteudo de colagem invalido');
      setIsError(true);
      return;
    }

    const singleCell = rows.length === 1 && rows[0].length === 1;
    const updates = [];

    if (singleCell && selectionRange?.anchor && selectionRange?.target) {
      const bounds = getSelectionBounds();
      const token = rows[0][0] || '';
      for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
        for (let col = bounds.startCol; col <= bounds.endCol; col += 1) {
          const target = getCellByCoord(row, col);
          if (!target) continue;
          const { existing, form } = buildCellForm(target.assignment, target.day);
          const merged = parseClipboardToken(token, form);
          updates.push({ assignment: target.assignment, day: target.day, existing, form: merged });
        }
      }
    } else {
      for (let rowOffset = 0; rowOffset < rows.length; rowOffset += 1) {
        const dataRow = rows[rowOffset];
        for (let colOffset = 0; colOffset < dataRow.length; colOffset += 1) {
          const target = getCellByCoord(activeCell.row + rowOffset, activeCell.col + colOffset);
          if (!target) continue;
          const token = dataRow[colOffset] ?? '';
          const { existing, form } = buildCellForm(target.assignment, target.day);
          const merged = parseClipboardToken(token, form);
          updates.push({ assignment: target.assignment, day: target.day, existing, form: merged });
        }
      }
    }

    if (updates.length === 0) {
      setStatusMessage('Nenhuma celula valida para colar');
      setIsError(true);
      return;
    }

    const result = await executeCellUpdates(updates, { label: 'paste', recordHistory: true, silent: false });
    const successCount = result.successCount;
    if (successCount === 0) return;
  };

  const applyClipboardPayload = async (payload) => {
    if (!activeCell || isGridBusy) return;
    if (!payload || payload.kind !== 'fujihub-grid-cells' || !Array.isArray(payload.matrix)) return false;
    if (import.meta.env.DEV) {
      console.debug('[grid-paste] internal payload received', payload);
    }

    const rows = payload.matrix;
    if (rows.length === 0) return false;
    const cols = Array.isArray(rows[0]) ? rows[0].length : 0;
    if (cols === 0) return false;

    const singleCell = rows.length === 1 && cols === 1;
    const updates = [];
    const editableFields = new Set([
      'position',
      'attendance_status',
      'work_time_code',
      'operational_code',
      'overtime_minutes',
      'start_time',
      'end_time',
      'break_minutes',
      'crosses_midnight',
      'manual_time_override',
      'leave_time',
      'time_note',
      'memo',
      'raw_value',
    ]);

    if (singleCell && selectionRange?.anchor && selectionRange?.target) {
      const bounds = getSelectionBounds();
      const source = rows[0][0] || {};
      for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
        for (let col = bounds.startCol; col <= bounds.endCol; col += 1) {
          const target = getCellByCoord(row, col);
          if (!target) continue;
          const { existing, form } = buildCellForm(target.assignment, target.day);
          const merged = { ...form };
          Object.entries(source || {}).forEach(([key, value]) => {
            if (!editableFields.has(key)) return;
            merged[key] = value ?? '';
          });
          updates.push({ assignment: target.assignment, day: target.day, existing, form: merged });
        }
      }
    } else {
      for (let rowOffset = 0; rowOffset < rows.length; rowOffset += 1) {
        const dataRow = rows[rowOffset];
        for (let colOffset = 0; colOffset < (Array.isArray(dataRow) ? dataRow.length : 0); colOffset += 1) {
          const target = getCellByCoord(activeCell.row + rowOffset, activeCell.col + colOffset);
          if (!target) continue;
          const source = dataRow[colOffset] || {};
          const { existing, form } = buildCellForm(target.assignment, target.day);
          const merged = { ...form };
          Object.entries(source || {}).forEach(([key, value]) => {
            if (!editableFields.has(key)) return;
            merged[key] = value ?? '';
          });
          updates.push({ assignment: target.assignment, day: target.day, existing, form: merged });
        }
      }
    }

    if (updates.length === 0) {
      setStatusMessage('Nenhuma celula valida para colar');
      setIsError(true);
      return true;
    }
    if (import.meta.env.DEV) {
      console.debug('[grid-paste] final updates payload', updates.slice(0, 3).map((item) => item.form));
    }
    const result = await executeCellUpdates(updates, { label: 'paste', recordHistory: true, silent: false });
    if (result.successCount > 0) {
      setStatusMessage(`Colado ${result.successCount} células`);
      setIsError(false);
    }
    return true;
  };

  const handleGridPaste = async (event) => {
    event.preventDefault();
    const jsonRaw = event.clipboardData?.getData('application/x-fujihub-grid');
    if (jsonRaw) {
      try {
        const payload = JSON.parse(jsonRaw);
        const handled = await applyClipboardPayload(payload);
        if (handled) return;
      } catch {
        // fallback to plain text parser
      }
    }
    const text = event.clipboardData?.getData('text/plain') || '';
    const cached = internalClipboardRef.current;
    if (cached?.payload && text && cached.plainText === text) {
      const handled = await applyClipboardPayload(cached.payload);
      if (handled) return;
    }
    await applyClipboardText(text);
  };

  const loadHistory = async () => {
    if (!id) return;
    setHistoryLoading(true);
    const params = new URLSearchParams();
    if (historyFilters.assignment) params.set('assignment', historyFilters.assignment);
    if (historyFilters.date) params.set('date', historyFilters.date);
    if (historyFilters.source) params.set('source', historyFilters.source);
    if (historyFilters.user) params.set('user', historyFilters.user);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const res = await authFetch(`${apiUrl(`/api/operations/calendars/${id}/history/${suffix}`)}`);
    const data = await readJson(res);
    if (!res.ok) {
      setStatusMessage(formatApiMessage(data, 'Falha ao carregar histórico.'));
      setIsError(true);
      setHistoryRows([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryRows(normalizeList(data));
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (!showHistoryPanel) return;
    loadHistory();
  }, [showHistoryPanel]);

  useEffect(() => {
    if (!showImportPanel) return;
    loadImportPreview();
  }, [showImportPanel, id]);

  useEffect(() => {
    if (!isDraggingSelection && !fillDragState) return undefined;
    const onMouseUp = async () => {
      if (isDraggingSelection) setIsDraggingSelection(false);
      if (fillDragState) await applyFillDrag();
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [isDraggingSelection, fillDragState]);

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
              <div className="operations-toolbar-groups">
                <div className="operations-toolbar-group">
                  <span className="operations-toolbar-title">Navegação</span>
                  <Link className="inventory-secondary-button" to="/operations/calendars">
                    {t('operations.backToCalendars')}
                  </Link>
                  <button className="inventory-secondary-button" type="button" disabled={loading} onClick={loadData}>
                    {loading ? t('common.refreshing') : t('common.refresh')}
                  </button>
                </div>
                <div className="operations-toolbar-group">
                  <span className="operations-toolbar-title">Operação</span>
                  <button className="inventory-secondary-button" type="button" onClick={() => setShowImportPanel((current) => !current)}>
                    {t('operations.importEmployees')}
                  </button>
                  <button className="inventory-secondary-button" type="button" onClick={() => setShowGeneratePanel((current) => !current)}>
                    {t('operations.generateSchedule')}
                  </button>
                  <button className="inventory-secondary-button" type="button" disabled={isGridBusy} onClick={openSaveTemplatePanel}>
                    Salvar template
                  </button>
                  <button className="inventory-secondary-button" type="button" disabled={isGridBusy} onClick={openApplyTemplatePanel}>
                    Aplicar template
                  </button>
                </div>
                <div className="operations-toolbar-group">
                  <span className="operations-toolbar-title">Ciclo mensal</span>
                  <button className="inventory-secondary-button" type="button" disabled={loading || processingMonthOps} onClick={duplicateFromPreviousMonth}>
                    Duplicar mês anterior
                  </button>
                  <button className="inventory-secondary-button" type="button" disabled={loading || processingMonthOps} onClick={generateNextMonth}>
                    Gerar próximo mês
                  </button>
                </div>
                <div className="operations-toolbar-group">
                  <span className="operations-toolbar-title">Saída / Auditoria</span>
                  <button className="inventory-secondary-button" type="button" disabled={isGridBusy} onClick={exportExcel}>
                    {exportingExcel ? 'Exportando Excel...' : 'Exportar Excel'}
                  </button>
                  <Link className="inventory-secondary-button" to={`/operations/calendars/${id}/print`} target="_blank" rel="noopener noreferrer">
                    Imprimir / PDF
                  </Link>
                  <button
                    className="inventory-secondary-button"
                    type="button"
                    disabled={loading}
                    onClick={() => setShowHistoryPanel((current) => !current)}
                  >
                    Histórico
                  </button>
                </div>
              </div>
            </div>

          {statusMessage ? (
            <span className={`inventory-status ${isError ? 'error' : ''}`}>{statusMessage}</span>
          ) : null}

          {showHistoryPanel ? (
            <div className="operations-pattern-panel" style={{ margin: '8px 18px 14px' }}>
              <label>
                Funcionário
                <select
                  value={historyFilters.assignment}
                  onChange={(event) => setHistoryFilters((current) => ({ ...current, assignment: event.target.value }))}
                >
                  <option value="">Todos</option>
                  {assignmentsForGrid.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.employee_detail?.employee_id || item.id} - {employeeLabel(item.employee_detail)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data
                <input
                  type="date"
                  value={historyFilters.date}
                  onChange={(event) => setHistoryFilters((current) => ({ ...current, date: event.target.value }))}
                />
              </label>
              <label>
                Origem
                <select
                  value={historyFilters.source}
                  onChange={(event) => setHistoryFilters((current) => ({ ...current, source: event.target.value }))}
                >
                  <option value="">Todas</option>
                  <option value="inline_edit">inline edit</option>
                  <option value="quick_apply">quick apply</option>
                  <option value="paste">paste</option>
                  <option value="fill_handle">fill handle</option>
                  <option value="pattern_4x2">4x2</option>
                  <option value="template">template</option>
                  <option value="month_duplication">duplicação mensal</option>
                  <option value="next_month_generation">geração próximo mês</option>
                </select>
              </label>
              <label>
                Usuário (ID)
                <input
                  type="number"
                  value={historyFilters.user}
                  onChange={(event) => setHistoryFilters((current) => ({ ...current, user: event.target.value }))}
                />
              </label>
              <div className="inventory-form-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                <button className="inventory-secondary-button" type="button" onClick={() => setShowHistoryPanel(false)}>
                  Fechar
                </button>
                <button className="inventory-primary-button" type="button" onClick={loadHistory} disabled={historyLoading}>
                  {historyLoading ? 'Carregando...' : 'Atualizar'}
                </button>
              </div>
              <div style={{ gridColumn: '1 / -1', maxHeight: '220px', overflow: 'auto', borderTop: '1px solid #d7e1e8', paddingTop: '8px' }}>
                {historyRows.length === 0 ? (
                  <p className="inventory-empty-state">Sem alterações no período filtrado.</p>
                ) : (
                  <table className="inventory-table compact">
                    <thead>
                      <tr>
                        <th>Data/hora</th>
                        <th>Usuário</th>
                        <th>Origem</th>
                        <th>Célula</th>
                        <th>Antes</th>
                        <th>Depois</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map((row) => (
                        <tr key={row.id}>
                          <td>{new Date(row.created_at).toLocaleString()}</td>
                          <td>{row.updated_by_username || '-'}</td>
                          <td>{formatHistorySource(row.source)}</td>
                          <td>
                            {row.assignment_employee_id || '-'} {row.cell_date ? `• ${row.cell_date}` : ''}
                          </td>
                          <td>{formatHistoryValue(row.old_value)}</td>
                          <td>{formatHistoryValue(row.new_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}

          {showSaveTemplatePanel ? (
            <TemplatePanel
              mode="save"
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onSelectedTemplateIdChange={setSelectedTemplateId}
              templateName={templateName}
              onTemplateNameChange={setTemplateName}
              templateDescription={templateDescription}
              onTemplateDescriptionChange={setTemplateDescription}
              scopeText={`${calendar?.department_detail?.code || '-'} / ${calendar?.process || '-'} / ${calendar?.shift || '-'}`}
              templateNeedsOverwrite={templateNeedsOverwrite}
              templateTargetCounts={templateTargetCounts}
              processing={processingTemplates}
              onSave={saveAsTemplate}
              onApply={applyTemplate}
              onCancel={() => setShowSaveTemplatePanel(false)}
              style={{ margin: '8px 18px 14px' }}
            />
          ) : null}

          {showApplyTemplatePanel ? (
            <TemplatePanel
              mode="apply"
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onSelectedTemplateIdChange={setSelectedTemplateId}
              templateName={templateName}
              onTemplateNameChange={setTemplateName}
              templateDescription={templateDescription}
              onTemplateDescriptionChange={setTemplateDescription}
              scopeText=""
              templateNeedsOverwrite={templateNeedsOverwrite}
              templateTargetCounts={templateTargetCounts}
              processing={processingTemplates}
              onSave={saveAsTemplate}
              onApply={applyTemplate}
              onCancel={() => {
                setShowApplyTemplatePanel(false);
                setTemplateNeedsOverwrite(false);
              }}
              style={{ margin: '8px 18px 14px' }}
            />
          ) : null}

          <form className="operations-inline-form" onSubmit={addAssignment}>
            <label className="inventory-field">
              <span>{t('operations.employee')}</span>
              <div className="operations-employee-autocomplete" ref={employeeSearchRef}>
                <input
                  type="text"
                  value={employeeSearchTerm}
                  placeholder="Digite nome, código ou nome JP"
                  onFocus={() => setEmployeeSearchOpen(true)}
                  onChange={(event) => {
                    setEmployeeSearchTerm(event.target.value);
                    setEmployeeSearchOpen(true);
                    setAssignmentForm((current) => ({ ...current, employee: '' }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setEmployeeSearchOpen(false);
                      return;
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setEmployeeSearchOpen(true);
                      setEmployeeHighlightIndex((current) => Math.min(current + 1, Math.max(employeeOptions.length - 1, 0)));
                      return;
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setEmployeeHighlightIndex((current) => Math.max(current - 1, 0));
                      return;
                    }
                    if (event.key === 'Enter' && employeeSearchOpen && activeEmployeeOption) {
                      event.preventDefault();
                      selectEmployeeOption(activeEmployeeOption);
                    }
                  }}
                  required={!assignmentForm.employee}
                />
                <input type="hidden" name="employee" value={assignmentForm.employee} required />
                {employeeSearchOpen ? (
                  <div className="operations-employee-dropdown">
                    {employeeSearchTerm.trim().length < 2 ? (
                      <div className="operations-employee-empty">Digite ao menos 2 caracteres</div>
                    ) : employeeOptions.length === 0 ? (
                      <div className="operations-employee-empty">Nenhum funcionário encontrado</div>
                    ) : (
                      employeeOptions.map((option, index) => (
                        <button
                          key={option.employeeId}
                          type="button"
                          className={`operations-employee-option ${index === employeeHighlightIndex ? 'is-highlighted' : ''} ${option.compatible ? 'is-compatible' : 'is-other'} ${option.alreadyLinked ? 'is-linked' : ''}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectEmployeeOption(option)}
                          disabled={option.alreadyLinked}
                        >
                          <strong>{option.name} ({option.code})</strong>
                          <span>Turno: {option.shiftLabel} • Grupo: {option.groupLabel} • Depto: {option.departmentLabel}</span>
                          <span>
                            Padrão: {option.workPattern}
                            {option.warnings.length ? ` • ${option.warnings.join(' • ')}` : ''}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              {selectedEmployee ? (
                <small className="operations-employee-help">
                  Selecionado: {employeeLabel(selectedEmployee)} ({employeeCode(selectedEmployee)})
                </small>
              ) : (
                <small className="operations-employee-help">Compatíveis do calendário aparecem primeiro.</small>
              )}
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

            <button className="inventory-primary-button" type="submit" disabled={addingAssignment || loading || !assignmentForm.employee}>
              {addingAssignment ? t('common.creating') : t('operations.addEmployee')}
            </button>
          </form>

          {editingAssignment && editingAssignmentForm ? (
            <div className="operations-pattern-panel" style={{ margin: '8px 18px 14px' }}>
              <label>
                Funcionário
                <input value={`${employeeLabel(editingAssignment.employee_detail)} (${employeeCode(editingAssignment.employee_detail)})`} readOnly />
              </label>
              <label>
                Categoria
                <select name="operational_category" value={editingAssignmentForm.operational_category} onChange={updateEditingAssignmentField}>
                  {['normal', 'relief', 'trainer', 'koutei_leader', 'gl', 'supervisor', 'manager', 'director'].map((category) => (
                    <option key={category} value={category}>{t(`operations.categories.${category}`)}</option>
                  ))}
                </select>
              </label>
              <label>
                Padrão
                <select name="work_pattern" value={editingAssignmentForm.work_pattern} onChange={updateEditingAssignmentField}>
                  <option value="4x2">4x2</option>
                  <option value="5x2">5x2</option>
                  <option value="manual">{t('operations.manual')}</option>
                </select>
              </label>
              <label>
                Turno
                <select name="shift_type" value={editingAssignmentForm.shift_type} onChange={updateEditingAssignmentField}>
                  <option value="day">{t('operations.shiftTypes.day')}</option>
                  <option value="night">{t('operations.shiftTypes.night')}</option>
                  <option value="flexible">{t('operations.shiftTypes.flexible')}</option>
                </select>
              </label>
              <label>
                Grupo
                <select name="rotation_group" value={editingAssignmentForm.rotation_group} onChange={updateEditingAssignmentField}>
                  <option value="">{t('common.none')}</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </label>
              <label>
                Posição padrão
                <select name="default_position" value={editingAssignmentForm.default_position} onChange={updateEditingAssignmentField}>
                  <option value="">{t('common.none')}</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>{position.code} - {getLocalizedName(position, i18n)}</option>
                  ))}
                </select>
              </label>
              <div className="inventory-form-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                <button className="inventory-secondary-button" type="button" onClick={() => setEditingAssignment(null)}>
                  Cancelar
                </button>
                <button className="inventory-primary-button" type="button" disabled={addingAssignment} onClick={saveAssignmentEdit}>
                  {addingAssignment ? 'Salvando...' : 'Salvar linha'}
                </button>
              </div>
            </div>
          ) : null}

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
                <span>Turno / Processo</span>
                <strong>{importPreview?.scope?.shift || calendar?.shift || '-'} / {importPreview?.scope?.process || calendar?.process || '-'}</strong>
              </div>

              <div className="operations-import-summary">
                <span>Funcionários no depto.</span>
                <strong>{importPreview?.total_base ?? 0}</strong>
              </div>

              <div className="operations-import-summary">
                <span>{t('operations.totalCandidates')}</span>
                <strong>{importPreview?.total_candidates ?? 0}</strong>
              </div>

              <div className="operations-import-summary">
                <span>{t('operations.skipped')}</span>
                <strong>{importPreview?.total_already_linked ?? 0}</strong>
              </div>

              <div className="operations-import-summary">
                <span>Ignorados</span>
                <strong>{importPreview?.total_ignored ?? 0}</strong>
              </div>

              <div className="inventory-form-actions">
                <button className="inventory-primary-button" type="submit" disabled={importingEmployees || loading || (importPreview && importPreview.total_candidates === 0)}>
                  {importingEmployees ? t('common.saving') : t('operations.confirmImport')}
                </button>
                <button className="inventory-secondary-button" type="button" disabled={syncingAssignments || loading} onClick={syncAssignmentsFromMaster}>
                  {syncingAssignments ? 'Sincronizando...' : 'Sincronizar com cadastro master'}
                </button>
              </div>

              {importResult ? (
                <div className="operations-paste-result">
                  <span>{t('operations.created')}: <strong>{importResult.created}</strong></span>
                  <span>{t('operations.skipped')}: <strong>{importResult.skipped}</strong></span>
                  <span>{t('operations.totalCandidates')}: <strong>{importResult.total_candidates}</strong></span>
                </div>
              ) : null}
              {importPreview ? (
                <div className="operations-import-lists">
                  <section>
                    <strong>Candidatos para importação</strong>
                    {(importPreview.candidates || []).length === 0 ? (
                      <p className="inventory-empty-state">Sem candidatos válidos.</p>
                    ) : (
                      <>
                        {(importPreview.candidates || []).slice(0, 10).map((item) => (
                          <span key={item.employee_id}>
                            {item.name || '-'} ({item.employee_id})<br />
                            Turno: {item.shift || item.shift_type || '-'} • Grupo: {item.rotation_group || '-'} • Padrão: {item.work_pattern || '-'}
                            {item.default_position_code ? ` • Posição: ${item.default_position_code}` : ''}
                          </span>
                        ))}
                        {(importPreview.candidates || []).length > 10 ? (
                          <span>+ {(importPreview.candidates || []).length - 10} outros candidatos</span>
                        ) : null}
                      </>
                    )}
                  </section>
                  <section>
                    <strong>Já vinculados</strong>
                    {(importPreview.already_linked || []).length === 0 ? (
                      <p className="inventory-empty-state">Nenhum.</p>
                    ) : (
                      <>
                        {(importPreview.already_linked || []).slice(0, 10).map((item) => (
                          <span key={item.employee_id}>
                            {item.name || '-'} ({item.employee_id}) — {formatImportIgnoredReason(item.reason || 'already_linked')}
                          </span>
                        ))}
                        {(importPreview.already_linked || []).length > 10 ? (
                          <span>+ {(importPreview.already_linked || []).length - 10} outros vinculados</span>
                        ) : null}
                      </>
                    )}
                  </section>
                  <section>
                    <strong>Ignorados</strong>
                    {(importPreview.ignored || []).length === 0 ? (
                      <p className="inventory-empty-state">Nenhum.</p>
                    ) : (
                      <>
                        {(importPreview.ignored || []).slice(0, 10).map((item) => (
                          <span key={item.employee_id}>
                            {item.name || '-'} ({item.employee_id}) — {formatImportIgnoredReason(item.reason)}
                          </span>
                        ))}
                        {(importPreview.ignored || []).length > 10 ? (
                          <span>+ {(importPreview.ignored || []).length - 10} outros ignorados</span>
                        ) : null}
                      </>
                    )}
                  </section>
                </div>
              ) : null}

              {importPreview && importPreview.total_candidates === 0 ? (
                <p className="inventory-empty-state">
                  {(importPreview.total_ignored || 0) > 0 || (importPreview.total_already_linked || 0) > 0
                    ? 'Nenhum candidato compatível encontrado. Veja abaixo os funcionários ignorados e os motivos.'
                    : 'Nenhum funcionário encontrado para o departamento do calendário.'}
                </p>
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
            <>
              <div className="operations-quick-toolbar">
                <label>
                  <span>Categoria visual</span>
                  <select value={quickCategoryFilter} onChange={(event) => setQuickCategoryFilter(event.target.value)}>
                    <option value="">Todas</option>
                    {[...new Set(operationalCodes.map((item) => item.category).filter(Boolean))].map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <div className="operations-quick-chips">
                  <button
                    type="button"
                    className="quick-chip"
                    disabled={!hasRangeSelection || isGridBusy}
                    onClick={() => setShowPatternPanel((current) => !current)}
                  >
                    Aplicar 4x2
                  </button>
                  {hasRangeSelection ? (
                    <button
                      type="button"
                      className="quick-chip quick-chip-clear"
                      onClick={() =>
                        applyQuickToSelection(
                          {
                            position: '',
                            attendance_status: '',
                            operational_code: '',
                            work_time_code: '',
                            raw_value: '',
                          },
                          { label: 'batch-clear' }
                        )
                      }
                    >
                      Limpar Range
                    </button>
                  ) : null}
                  {attendanceStatuses.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="quick-chip"
                      onClick={() => applyQuickToSelection({ attendance_status: String(item.id) }, { label: 'batch-status' })}
                    >
                      {item.label_jp}
                    </button>
                  ))}
                  {quickOperationalCodes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="quick-chip"
                      onClick={() => applyQuickToSelection({ operational_code: String(item.id) }, { label: 'batch-op-code' })}
                    >
                      {item.label_jp || item.code}
                    </button>
                  ))}
                  <button type="button" className="quick-chip" disabled={historyStack.length === 0} onClick={performUndo}>
                    Ctrl+Z
                  </button>
                  <button type="button" className="quick-chip" disabled={redoStack.length === 0} onClick={performRedo}>
                    Ctrl+Y
                  </button>
                </div>
                {showPatternPanel ? (
                  <div className="operations-pattern-panel">
                    <div className="operations-pattern-presets">
                      <button type="button" className="quick-chip" onClick={() => applyPatternPreset('4x2-day')} disabled={isGridBusy}>
                        4x2 Dia
                      </button>
                      <button type="button" className="quick-chip" onClick={() => applyPatternPreset('4x2-night')} disabled={isGridBusy}>
                        4x2 Noite
                      </button>
                      <button type="button" className="quick-chip" onClick={() => applyPatternPreset('off-only')} disabled={isGridBusy}>
                        Somente folgas
                      </button>
                      <button type="button" className="quick-chip quick-chip-clear" onClick={() => applyPatternPreset('clear')} disabled={isGridBusy}>
                        Limpar padrão
                      </button>
                      {lastPatternPreset ? <span className="pattern-last-preset">Último preset: {lastPatternPreset}</span> : null}
                    </div>
                    <label>
                      <span>Data inicial</span>
                      <input name="start_date" type="date" value={patternForm.start_date} onChange={updatePatternField} />
                    </label>
                    <label>
                      <span>Dias trabalho</span>
                      <input name="work_days" type="number" min="1" value={patternForm.work_days} onChange={updatePatternField} />
                    </label>
                    <label>
                      <span>Dias folga</span>
                      <input name="off_days" type="number" min="1" value={patternForm.off_days} onChange={updatePatternField} />
                    </label>
                    <label>
                      <span>Código trabalho</span>
                      <select name="work_operational_code" value={patternForm.work_operational_code} onChange={updatePatternField}>
                        <option value="">(nenhum)</option>
                        {operationalCodes.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label_jp || item.code}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Status trabalho</span>
                      <select name="work_attendance_status" value={patternForm.work_attendance_status} onChange={updatePatternField}>
                        <option value="">(nenhum)</option>
                        {attendanceStatuses.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label_jp || item.code}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Status folga</span>
                      <select name="off_attendance_status" value={patternForm.off_attendance_status} onChange={updatePatternField}>
                        <option value="">(nenhum)</option>
                        {attendanceStatuses.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label_jp || item.code}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="operations-pattern-actions">
                      <button type="button" className="quick-chip" onClick={() => setShowPatternPanel(false)}>
                        Cancelar
                      </button>
                      <button type="button" className="quick-chip quick-chip-apply" onClick={applyFourTwoPattern} disabled={isGridBusy}>
                        Aplicar
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div ref={gridWrapRef} className="operations-grid-wrap" tabIndex={0} onKeyDown={handleGridKeyDown} onPaste={handleGridPaste}>
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
                      <th
                        className={`day-col ${[0, 6].includes(new Date(day.date).getDay()) ? 'weekend-head' : ''} ${
                          new Date(day.date).getDay() === 0 ? 'sunday-head' : ''
                        }`}
                        key={day.date}
                      >
                        <span className="day-col-number">{day.day}</span>
                        <span className="day-col-weekday">{getWeekdayLabel(day.date, i18n)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignmentsForGrid.map((assignment) => {
                    const groupStyle = rotationStyleByGroup[assignment.rotation_group];
                    const resolvedCategory = resolveAssignmentCategory(assignment);
                    const visualCode = getAssignmentVisualCode(assignment);
                    const visual = visualCategoryByCode[visualCode];
                    const rowClass =
                      visual?.target_column === 'row' || visualCode === 'trainee'
                        ? 'row-trainee'
                        : visualCode === 'koutei_leader'
                          ? 'row-koutei-leader'
                          : visualCode === 'relief'
                            ? 'row-relief'
                            : ['trainer'].includes(visualCode)
                              ? 'row-leadership'
                              : resolvedCategory.key === 'other'
                                ? 'row-other'
                                : '';
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
                      <td className="sticky-col category">
                        <button
                          type="button"
                          className={`quick-chip operations-category-badge is-${resolvedCategory.key}`}
                          onClick={() => openAssignmentEditor(assignment)}
                        >
                          {resolvedCategory.label}
                        </button>
                      </td>
                      <td className="sticky-col regular">{totals?.scheduled_regular_formatted || '0:00'}</td>
                      <td className="sticky-col overtime">{totals?.actual_overtime_formatted || '0:00'}</td>
                      <td className="sticky-col overload">{totals?.overload_formatted || '0:00'}</td>
                      {days.map((day) => {
                        const cell = cellMap[`${assignment.id}-${day.date}`];
                        const isSelected =
                          selectedCell?.assignment?.id === assignment.id && selectedCell?.day?.date === day.date;
                        const semanticClass = getCellSemanticClass(cell);
                        const displayLines = getCellDisplayLines(cell);
                        const background =
                          cell?.operational_code_detail?.background_color ||
                          cell?.attendance_status_detail?.color ||
                          '';
                        const row = assignmentIndexById[assignment.id];
                        const col = dayIndexByDate[day.date];
                        const isActive = activeCell?.assignmentId === assignment.id && activeCell?.date === day.date;
                        const isEditing = editingCell?.assignmentId === assignment.id && editingCell?.date === day.date;
                        const inRange = selectionRange?.anchor && selectionRange?.target
                          ? row >= Math.min(selectionRange.anchor.row, selectionRange.target.row) &&
                            row <= Math.max(selectionRange.anchor.row, selectionRange.target.row) &&
                            col >= Math.min(selectionRange.anchor.col, selectionRange.target.col) &&
                            col <= Math.max(selectionRange.anchor.col, selectionRange.target.col)
                          : false;
                        const fillBounds = fillDragState
                          ? {
                              startRow: Math.min(fillDragState.anchor.row, fillDragState.target.row),
                              endRow: Math.max(fillDragState.anchor.row, fillDragState.target.row),
                              startCol: Math.min(fillDragState.anchor.col, fillDragState.target.col),
                              endCol: Math.max(fillDragState.anchor.col, fillDragState.target.col),
                            }
                          : null;
                        const inFillRange = fillBounds
                          ? row >= fillBounds.startRow &&
                            row <= fillBounds.endRow &&
                            col >= fillBounds.startCol &&
                            col <= fillBounds.endCol
                          : false;
                        const isFillAnchor = Boolean(
                          fillDragState &&
                            row === fillDragState.anchor.row &&
                            col === fillDragState.anchor.col
                        );
                        const key = assignment.id + '-' + day.date;
                        const isSavingInline = Boolean(savingCellKeys[key]);
                        const hasInlineError = Boolean(cellErrorKeys[key]);
                        return (
                          <td className="day-cell" key={day.date} onMouseEnter={() => {
                            if (!isDraggingSelection) return;
                            selectCellOnly(assignment, day, { shiftKey: true });
                          }}>
                            {isEditing ? (
                              <form
                                className="day-cell-inline-editor"
                                onSubmit={async (event) => {
                                  event.preventDefault();
                                  const result = await executeCellUpdates(
                                    [{ assignment, day, existing: cell, form: inlineCellForm }],
                                    { label: 'inline-edit', recordHistory: true, silent: true }
                                  );
                                  const ok = result.ok;
                                  if (ok) {
                                    setEditingCell(null);
                                  }
                                }}
                              >
                                <select
                                  value={inlineCellForm.operational_code}
                                  onChange={(event) => setInlineCellForm((current) => ({ ...current, operational_code: event.target.value }))}
                                  autoFocus
                                >
                                  <option value="">-</option>
                                  {filteredOperationalCodes.map((item) => (
                                    <option key={item.id} value={item.id}>{item.label_jp || item.code}</option>
                                  ))}
                                </select>
                                <input
                                  value={inlineCellForm.raw_value}
                                  onChange={(event) => setInlineCellForm((current) => ({ ...current, raw_value: event.target.value }))}
                                  onKeyDown={async (event) => {
                                    if (event.key === 'Escape') {
                                      event.preventDefault();
                                      setEditingCell(null);
                                      return;
                                    }
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      const result = await executeCellUpdates(
                                        [{ assignment, day, existing: cell, form: inlineCellForm }],
                                        { label: 'inline-edit', recordHistory: true, silent: true }
                                      );
                                      const ok = result.ok;
                                      if (ok) {
                                        setEditingCell(null);
                                        moveActiveCell(1, 0);
                                      }
                                    }
                                  }}
                                />
                              </form>
                            ) : (
                              <button
                                className={`day-cell-button ${semanticClass} ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''} ${inRange ? 'in-range' : ''} ${inFillRange ? 'in-fill-range' : ''} ${isFillAnchor ? 'is-fill-anchor' : ''} ${isSavingInline ? 'is-saving' : ''} ${hasInlineError ? 'is-error' : ''}`}
                                style={{ backgroundColor: background || undefined }}
                                type="button"
                                onMouseEnter={() => updateFillDrag(assignment, day)}
                                onMouseDown={(event) => selectCellOnly(assignment, day, { shiftKey: event.shiftKey, startDrag: true })}
                                onClick={(event) => selectCellOnly(assignment, day, { shiftKey: event.shiftKey })}
                                onDoubleClick={() => openCellEditor(assignment, day)}
                                title={renderCellText(cell) || '-'}
                              >
                                {displayLines.map((line, index) => (
                                  <span key={`${day.date}-${index}`} className={`cell-line cell-line-${index + 1}`}>
                                    {line}
                                  </span>
                                ))}
                                {isActive ? (
                                  <span
                                    className="cell-fill-handle"
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      startFillDrag(assignment, day);
                                    }}
                                  />
                                ) : null}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            </>
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
                <details className="operations-replicate-menu">
                  <summary className={`inventory-secondary-button ${(savingRequirement || loading) ? 'is-disabled' : ''}`}>Replicar...</summary>
                  <div className="operations-replicate-dropdown">
                    <button
                      className="inventory-secondary-button"
                      type="button"
                      disabled={savingRequirement || loading}
                      onClick={() => replicateRequirement('remaining', false)}
                    >
                      Para dias restantes
                    </button>
                    <button
                      className="inventory-secondary-button"
                      type="button"
                      disabled={savingRequirement || loading}
                      onClick={() => replicateRequirement('all', false)}
                    >
                      Para mês todo
                    </button>
                    <button
                      className="inventory-secondary-button"
                      type="button"
                      disabled={savingRequirement || loading}
                      onClick={() => replicateRequirement('all', true)}
                    >
                      Para dias úteis
                    </button>
                  </div>
                </details>
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
