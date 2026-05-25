import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import LanguageSelector from '../components/LanguageSelector';
import { getLocalizedLabel } from '../i18n/helpers';
import { authFetch } from '../utils/authFetch';
import './Inventory.css';
import './Operations.css';

import { apiUrl } from '../config/api';

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
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

function formatMinutes(minutes = 0) {
  const value = Number(minutes || 0);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function renderCellText(cell, i18n) {
  if (!cell) return '';
  if (cell.raw_value) return cell.raw_value;

  return [
    cell.position_detail?.code,
    getLocalizedLabel(cell.attendance_status_detail, i18n, ''),
    getLocalizedLabel(cell.work_time_code_detail, i18n, ''),
    cell.memo,
  ]
    .filter(Boolean)
    .join(' ');
}

export default function OperationsCalendarPrint() {
  const { id } = useParams();
  const { i18n, t } = useTranslation();
  const [calendar, setCalendar] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [cells, setCells] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [assignmentTotals, setAssignmentTotals] = useState([]);
  const [rotationStyles, setRotationStyles] = useState([]);
  const [visualCategories, setVisualCategories] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [paperSize, setPaperSize] = useState('A4');
  const [orientation, setOrientation] = useState('landscape');
  const [scale, setScale] = useState('90');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

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

  const assignmentTotalsMap = useMemo(
    () =>
      assignmentTotals.reduce((acc, item) => {
        acc[item.assignment] = item;
        return acc;
      }, {}),
    [assignmentTotals]
  );

  const rotationStyleByGroup = useMemo(
    () =>
      rotationStyles.reduce((acc, style) => {
        acc[style.group_code] = style;
        return acc;
      }, {}),
    [rotationStyles]
  );

  const visualCategoryByCode = useMemo(
    () =>
      visualCategories.reduce((acc, item) => {
        acc[item.code] = item;
        return acc;
      }, {}),
    [visualCategories]
  );

  const getAssignmentVisualCode = (assignment) => {
    if (assignment.employee_detail?.retired || assignment.employee_detail?.end_work) return 'retired';
    const category = assignment.operational_category;
    if (category === 'relief') return 'relief';
    if (category === 'koutei_leader') return 'koutei_leader';
    if (category === 'trainer') return 'trainer';
    if ((assignment.notes || '').toLowerCase().includes('trainee')) return 'trainee';
    return 'normal';
  };

  const printableAssignments = useMemo(() => {
    const rank = (assignment) => {
      const visualCode = getAssignmentVisualCode(assignment);
      if (['manager', 'director', 'supervisor', 'gl', 'koutei_leader'].includes(assignment.operational_category)) return 300;
      if (visualCode === 'relief') return 280;
      if (visualCode === 'trainee') return 140;
      return 100;
    };

    return assignments
      .filter((assignment) => {
        const visualCode = getAssignmentVisualCode(assignment);
        const visual = visualCategoryByCode[visualCode];
        return visual?.print_behavior !== 'suppress_on_print';
      })
      .sort((a, b) => {
        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0) return rankDiff;
        return (a.display_order || 0) - (b.display_order || 0);
      });
  }, [assignments, visualCategoryByCode]);

  const process = processes.find((item) => Number(item.id) === Number(calendar?.process));
  const shift = shifts.find((item) => Number(item.id) === Number(calendar?.shift));
  const printedAt = new Intl.DateTimeFormat(i18n.language || 'pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  const loadData = async () => {
    setLoading(true);
    setLoadError('');

    const [calendarRes, assignmentsRes, cellsRes, summaryRes, totalsRes, rotationRes, visualRes, processesRes, shiftsRes] = await Promise.all([
      authFetch(`${apiUrl('/api/operations/calendars/${id}/')}`),
      authFetch(`${apiUrl('/api/operations/calendars/${id}/assignments/')}`),
      authFetch(`${apiUrl('/api/operations/calendars/${id}/cells/')}`),
      authFetch(`${apiUrl('/api/operations/calendars/${id}/summary/')}`),
      authFetch(`${apiUrl('/api/operations/calendars/${id}/assignment-totals/')}`),
      authFetch(`${apiUrl('/api/operations/rotation-group-styles/')}`),
      authFetch(`${apiUrl('/api/operations/visual-categories/')}`),
      authFetch(`${apiUrl('/api/processes/')}`),
      authFetch(`${apiUrl('/api/shifts/')}`),
    ]);

    if (calendarRes.ok) setCalendar(await calendarRes.json());
    if (assignmentsRes.ok) setAssignments(normalizeList(await assignmentsRes.json()));
    if (cellsRes.ok) setCells(normalizeList(await cellsRes.json()));
    if (summaryRes.ok) setSummaryRows(normalizeList(await summaryRes.json()));
    if (totalsRes.ok) setAssignmentTotals(normalizeList(await totalsRes.json()));
    if (rotationRes.ok) setRotationStyles(normalizeList(await rotationRes.json()));
    if (visualRes.ok) setVisualCategories(normalizeList(await visualRes.json()));
    if (processesRes.ok) setProcesses(normalizeList(await processesRes.json()));
    if (shiftsRes.ok) setShifts(normalizeList(await shiftsRes.json()));

    if (!calendarRes.ok || !assignmentsRes.ok || !cellsRes.ok || !summaryRes.ok || !totalsRes.ok) {
      setLoadError(t('operations.printLoadError'));
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  return (
    <main
      className={`operations-print-page print-${paperSize.toLowerCase()} print-${orientation}`}
      style={{ '--print-scale': Number(scale) / 100 }}
    >
      <style>{`@page { size: ${paperSize} ${orientation}; margin: 8mm; }`}</style>
      <section className="operations-print-controls no-print">
        <div>
          <p className="inventory-eyebrow">{t('operations.printView')}</p>
          <h1>{calendar?.title || t('operations.printTitle')}</h1>
        </div>

        <div className="operations-print-control-grid">
          <label className="inventory-field">
            <span>{t('operations.paperSize')}</span>
            <select value={paperSize} onChange={(event) => setPaperSize(event.target.value)}>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </label>

          <label className="inventory-field">
            <span>{t('operations.orientation')}</span>
            <select value={orientation} onChange={(event) => setOrientation(event.target.value)}>
              <option value="portrait">{t('operations.portrait')}</option>
              <option value="landscape">{t('operations.landscape')}</option>
            </select>
          </label>

          <label className="inventory-field">
            <span>{t('operations.scale')}</span>
            <select value={scale} onChange={(event) => setScale(event.target.value)}>
              <option value="80">80%</option>
              <option value="90">90%</option>
              <option value="100">100%</option>
            </select>
          </label>

          <div className="operations-print-actions">
            <LanguageSelector compact />
            <Link className="inventory-secondary-button" to={`/operations/calendars/${id}/grid`}>
              {t('operations.backToGrid')}
            </Link>
            <button className="inventory-secondary-button" type="button" disabled={loading} onClick={loadData}>
              {loading ? t('common.refreshing') : t('common.refresh')}
            </button>
            <button className="inventory-primary-button" type="button" disabled={loading} onClick={() => window.print()}>
              {t('operations.print')}
            </button>
          </div>
        </div>

        {loadError ? <span className="inventory-status error">{loadError}</span> : null}
      </section>

      <section className="operations-print-sheet">
        {loading ? (
          <p className="inventory-empty-state">{t('common.loading')}</p>
        ) : (
          <>
            <header className="operations-print-header">
              <div>
                <p>FujiHub</p>
                <h1>{calendar?.title || t('operations.printTitle')}</h1>
              </div>
              <dl>
                <div>
                  <dt>{t('employees.department')}</dt>
                  <dd>
                    {calendar?.department_detail?.code} - {getLocalizedLabel(calendar?.department_detail, i18n)}
                  </dd>
                </div>
                <div>
                  <dt>{t('employees.process')}</dt>
                  <dd>{process ? `${process.code} - ${getLocalizedLabel(process, i18n)}` : t('common.none')}</dd>
                </div>
                <div>
                  <dt>{t('employees.shift')}</dt>
                  <dd>{shift ? `${shift.code} - ${getLocalizedLabel(shift, i18n)}` : t('common.none')}</dd>
                </div>
                <div>
                  <dt>{t('operations.period')}</dt>
                  <dd>
                    {calendar?.year}-{String(calendar?.month || '').padStart(2, '0')}
                  </dd>
                </div>
                <div>
                  <dt>{t('operations.printedAt')}</dt>
                  <dd>{printedAt}</dd>
                </div>
              </dl>
            </header>

            <div className="operations-print-table-wrap">
              <table className="operations-print-table">
                <thead>
                  <tr>
                    <th>SCD</th>
                    <th>所定</th>
                    <th>残業</th>
                    <th>過重</th>
                    <th>人数</th>
                    <th>{t('operations.name')}</th>
                    <th>和名</th>
                    <th>{t('operations.code')}</th>
                    <th>{t('operations.category')}</th>
                    {days.map((day) => (
                      <th key={day.date} className={new Date(day.date).getDay() === 0 ? 'sunday-head' : ''}>
                        {day.day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {printableAssignments.map((assignment) => {
                    const totals = assignmentTotalsMap[assignment.id];
                    const groupStyle = rotationStyleByGroup[assignment.rotation_group];
                    const visualCode = getAssignmentVisualCode(assignment);
                    const visual = visualCategoryByCode[visualCode];
                    const rowClass = visual?.target_column === 'row' || visualCode === 'trainee' ? 'row-trainee' : '';

                    return (
                    <tr key={assignment.id} className={rowClass}>
                      <td>{assignment.display_order}</td>
                      <td>{totals?.scheduled_regular_formatted || formatMinutes(totals?.scheduled_regular_minutes_total)}</td>
                      <td>{totals?.actual_overtime_formatted || formatMinutes(totals?.actual_overtime_minutes_total)}</td>
                      <td>{totals?.overload_formatted || formatMinutes(totals?.overload_minutes)}</td>
                      <td>1</td>
                      <td
                        style={{
                          backgroundColor: groupStyle?.background_color || undefined,
                          color: groupStyle?.text_color || undefined,
                        }}
                      >
                        {employeeLabel(assignment.employee_detail)}
                      </td>
                      <td
                        style={{
                          backgroundColor: visualCode === 'relief' ? visual?.background_color : undefined,
                          color: visualCode === 'relief' ? visual?.text_color : undefined,
                        }}
                      >
                        {assignment.employee_detail?.name_jp || '-'}
                      </td>
                      <td
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
                      <td>{t(`operations.categories.${assignment.operational_category}`)}</td>
                      {days.map((day) => {
                        const cell = cellMap[`${assignment.id}-${day.date}`];
                        const cellColor =
                          cell?.operational_code_detail?.background_color ||
                          cell?.attendance_status_detail?.color ||
                          undefined;
                        return (
                          <td
                            key={day.date}
                            style={{ backgroundColor: cellColor }}
                          >
                            {renderCellText(cell, i18n) || ''}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <section className="operations-print-summary">
              <h2>{t('operations.requiredVsAssigned')}</h2>
              {summaryRows.length === 0 ? (
                <p>{t('operations.emptySummary')}</p>
              ) : (
                <table>
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
                        <td>{row.difference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
