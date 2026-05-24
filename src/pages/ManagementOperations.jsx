import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ManagementResourceSection from '../components/ManagementResourceSection';
import { authFetch } from '../utils/authFetch';
import ManagementLayout from './ManagementLayout';

const API_BASE_URL = 'http://127.0.0.1:8000';

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function PositionSection({ departments, buildingFloors }) {
  const { t } = useTranslation();
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [form, setForm] = useState({
    department: '',
    code: '',
    name_pt: '',
    name_jp: '',
    building_floor: '',
    description: '',
    is_active: true,
  });

  const departmentLabelById = useMemo(
    () => new Map(departments.map((d) => [String(d.id), `${d.code} - ${d.label_pt || d.label_jp || ''}`])),
    [departments]
  );
  const buildingLabelById = useMemo(
    () => new Map(buildingFloors.map((b) => [String(b.id), `${b.code} - ${b.label_pt || b.label_jp || ''}`])),
    [buildingFloors]
  );

  const loadItems = async () => {
    setLoading(true);
    setIsError(false);
    const queryPart = departmentFilter ? `?department=${departmentFilter}` : '';
    const res = await authFetch(`${API_BASE_URL}/api/operations/positions/${queryPart}`);
    const text = await res.text();
    const data = text ? JSON.parse(text) : [];
    if (!res.ok) {
      setStatus(t('management.loadError'));
      setIsError(true);
      setLoading(false);
      return;
    }
    setItems(normalizeList(data));
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, [departmentFilter]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.code, item.name_pt, item.name_jp, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [items, query]);

  const createPosition = async (event) => {
    event.preventDefault();
    setIsError(false);
    const payload = {
      ...form,
      department: form.department ? Number(form.department) : null,
      building_floor: form.building_floor ? Number(form.building_floor) : null,
    };
    const res = await authFetch(`${API_BASE_URL}/api/operations/positions/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      setStatus(data?.detail || t('management.createError'));
      setIsError(true);
      return;
    }
    setStatus(t('management.saved'));
    setForm({
      department: '',
      code: '',
      name_pt: '',
      name_jp: '',
      building_floor: '',
      description: '',
      is_active: true,
    });
    await loadItems();
  };

  return (
    <div className="inventory-panel">
      <div className="inventory-panel-header">
        <div>
          <p className="inventory-eyebrow">{t('management.settings')}</p>
          <h2>OperationalPosition</h2>
        </div>
        <div className="inventory-panel-tools">
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value="">{t('management.allDepartments')}</option>
            {departments.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.code} - {dep.label_pt || dep.label_jp}
              </option>
            ))}
          </select>
          <button className="inventory-secondary-button" type="button" onClick={loadItems} disabled={loading}>
            {loading ? t('common.loading') : t('common.refresh')}
          </button>
        </div>
      </div>

      {status ? <span className={`inventory-status ${isError ? 'error' : ''}`}>{status}</span> : null}

      <form className="inventory-form" onSubmit={createPosition}>
        <div className="inventory-form-grid">
          <label className="inventory-field">
            <span>{t('employees.department')}</span>
            <select value={form.department} onChange={(event) => setForm((c) => ({ ...c, department: event.target.value }))} required>
              <option value="">{t('common.select')}</option>
              {departments.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.code} - {dep.label_pt || dep.label_jp}
                </option>
              ))}
            </select>
          </label>
          <label className="inventory-field">
            <span>{t('common.code')}</span>
            <input value={form.code} onChange={(event) => setForm((c) => ({ ...c, code: event.target.value }))} required />
          </label>
          <label className="inventory-field">
            <span>{t('management.namePt')}</span>
            <input value={form.name_pt} onChange={(event) => setForm((c) => ({ ...c, name_pt: event.target.value }))} required />
          </label>
          <label className="inventory-field">
            <span>{t('management.nameJp')}</span>
            <input value={form.name_jp} onChange={(event) => setForm((c) => ({ ...c, name_jp: event.target.value }))} required />
          </label>
          <label className="inventory-field">
            <span>{t('employees.buildingFloor')}</span>
            <select value={form.building_floor} onChange={(event) => setForm((c) => ({ ...c, building_floor: event.target.value }))}>
              <option value="">{t('common.none')}</option>
              {buildingFloors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.code} - {floor.label_pt || floor.label_jp}
                </option>
              ))}
            </select>
          </label>
          <label className="inventory-field full">
            <span>{t('common.description')}</span>
            <input value={form.description} onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))} />
          </label>
        </div>
        <div className="inventory-form-actions">
          <button className="inventory-primary-button" type="submit">
            {t('management.create')}
          </button>
        </div>
      </form>

      <label className="inventory-field" style={{ margin: '0 18px 12px' }}>
        <span>{t('management.search')}</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('management.searchPlaceholder')} />
      </label>

      <div className="inventory-table-wrap">
        <table className="inventory-table compact">
          <thead>
            <tr>
              <th>{t('common.code')}</th>
              <th>{t('management.namePt')}</th>
              <th>{t('management.nameJp')}</th>
              <th>{t('employees.department')}</th>
              <th>{t('employees.buildingFloor')}</th>
              <th>{t('common.description')}</th>
              <th>{t('common.status')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.name_pt}</td>
                <td>{item.name_jp}</td>
                <td>{departmentLabelById.get(String(item.department)) || item.department}</td>
                <td>{buildingLabelById.get(String(item.building_floor)) || '-'}</td>
                <td>{item.description || '-'}</td>
                <td>{item.is_active ? t('common.active') : t('common.status')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ManagementOperations() {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState([]);
  const [buildingFloors, setBuildingFloors] = useState([]);
  const [attendanceStatuses, setAttendanceStatuses] = useState([]);
  const [workTimeCodes, setWorkTimeCodes] = useState([]);

  useEffect(() => {
    (async () => {
      const [depRes, floorRes, attendanceRes, workRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/api/departments/`),
        authFetch(`${API_BASE_URL}/api/buildingfloors/`),
        authFetch(`${API_BASE_URL}/api/operations/attendance-statuses/`),
        authFetch(`${API_BASE_URL}/api/operations/work-time-codes/`),
      ]);
      if (depRes.ok) setDepartments(normalizeList(await depRes.json()));
      if (floorRes.ok) setBuildingFloors(normalizeList(await floorRes.json()));
      if (attendanceRes.ok) setAttendanceStatuses(normalizeList(await attendanceRes.json()));
      if (workRes.ok) setWorkTimeCodes(normalizeList(await workRes.json()));
    })();
  }, []);

  const targetColumnOptions = [
    { value: 'name', label: 'name' },
    { value: 'kana', label: 'kana' },
    { value: 'code', label: 'code' },
    { value: 'row', label: 'row' },
  ];

  const printBehaviorOptions = [
    { value: 'show', label: 'show' },
    { value: 'suppress_on_print', label: 'suppress_on_print' },
  ];

  const operationalCategoryOptions = [
    { value: 'status', label: 'status' },
    { value: 'time', label: 'time' },
    { value: 'position', label: 'position' },
    { value: 'mixed', label: 'mixed' },
  ];

  return (
    <ManagementLayout title={t('management.operations')} subtitle={t('management.operationsDescription')}>
      <div className="inventory-stack">
        <ManagementResourceSection
          title="RotationGroupStyle"
          endpoint="/api/operations/rotation-group-styles/"
          createDefaults={{ group_code: '', label: '', background_color: '#ffffff', text_color: '#17232d', display_order: 0, is_active: true }}
          fields={[
            { name: 'group_code', label: t('management.groupCode'), required: true },
            { name: 'label', label: t('management.label'), required: true },
            { name: 'background_color', label: t('management.backgroundColor'), type: 'color' },
            { name: 'text_color', label: t('management.textColor'), type: 'color' },
            { name: 'display_order', label: t('management.order'), type: 'number' },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title="EmployeeVisualCategory"
          endpoint="/api/operations/visual-categories/"
          createDefaults={{ code: '', label_pt: '', label_jp: '', target_column: 'name', background_color: '#ffffff', text_color: '#17232d', print_behavior: 'show', display_order: 0, is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'label_pt', label: t('management.namePt'), required: true },
            { name: 'label_jp', label: t('management.nameJp'), required: true },
            { name: 'target_column', label: t('management.targetColumn'), type: 'select', options: targetColumnOptions },
            { name: 'background_color', label: t('management.backgroundColor'), type: 'color' },
            { name: 'text_color', label: t('management.textColor'), type: 'color' },
            { name: 'print_behavior', label: t('management.printBehavior'), type: 'select', options: printBehaviorOptions },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title="OperationalCode"
          endpoint="/api/operations/operational-codes/"
          createDefaults={{ code: '', label_pt: '', label_jp: '', category: 'status', attendance_status: '', work_time_code: '', background_color: '#ffffff', text_color: '#17232d', affects_overtime: false, affects_holiday_work: false, is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'label_pt', label: t('management.namePt'), required: true },
            { name: 'label_jp', label: t('management.nameJp'), required: true },
            { name: 'category', label: t('management.category'), type: 'select', options: operationalCategoryOptions },
            {
              name: 'attendance_status',
              label: t('management.attendanceStatusId'),
              type: 'select',
              options: attendanceStatuses.map((item) => ({ value: item.id, label: `${item.code} - ${item.label_pt}` })),
            },
            {
              name: 'work_time_code',
              label: t('management.workTimeCodeId'),
              type: 'select',
              options: workTimeCodes.map((item) => ({ value: item.id, label: `${item.code} - ${item.label_pt}` })),
            },
            { name: 'background_color', label: t('management.backgroundColor'), type: 'color' },
            { name: 'text_color', label: t('management.textColor'), type: 'color' },
            { name: 'affects_overtime', label: t('management.affectsOvertime'), type: 'checkbox' },
            { name: 'affects_holiday_work', label: t('management.affectsHolidayWork'), type: 'checkbox' },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title="AttendanceStatus"
          endpoint="/api/operations/attendance-statuses/"
          createDefaults={{ code: '', label_pt: '', label_jp: '', color: '#ffffff', is_working_day: false, is_absence: false, is_paid_leave: false, is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'label_pt', label: t('management.namePt'), required: true },
            { name: 'label_jp', label: t('management.nameJp'), required: true },
            { name: 'color', label: t('management.color'), type: 'color' },
            { name: 'is_working_day', label: t('management.workingDay'), type: 'checkbox' },
            { name: 'is_absence', label: t('management.absence'), type: 'checkbox' },
            { name: 'is_paid_leave', label: t('management.paidLeave'), type: 'checkbox' },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title="WorkTimeCode"
          endpoint="/api/operations/work-time-codes/"
          createDefaults={{ code: '', label_pt: '', label_jp: '', color: '#ffffff', affects_overtime: false, is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'label_pt', label: t('management.namePt'), required: true },
            { name: 'label_jp', label: t('management.nameJp'), required: true },
            { name: 'color', label: t('management.color'), type: 'color' },
            { name: 'affects_overtime', label: t('management.affectsOvertime'), type: 'checkbox' },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <PositionSection departments={departments} buildingFloors={buildingFloors} />
      </div>
    </ManagementLayout>
  );
}

