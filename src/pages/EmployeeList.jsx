import { useEmployees } from '../hooks/useEmployees';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { authFetch } from '../utils/authFetch';
import { apiUrl } from '../config/api';

export default function EmployeeList() {
  const { t } = useTranslation();
  const { employees, loading, pagination, deleteEmployee, updateEmployee, listEmployees } = useEmployees();
  const [departments, setDepartments] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importingPreview, setImportingPreview] = useState(false);
  const [importingCommit, setImportingCommit] = useState(false);
  const [updateEmpty, setUpdateEmpty] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    active: 'true',
    operational_category: '',
    work_pattern: '',
    page: 1,
    page_size: 25,
  });
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState({
    nickname: '',
    operational_category: 'normal',
    work_pattern: '4x2',
    shift_type: 'day',
    rotation_group: '',
    active_end_month: true,
  });

  useEffect(() => {
    (async () => {
      const depRes = await authFetch(apiUrl('/api/departments/'));
      if (!depRes.ok) return;
      const data = await depRes.json();
      setDepartments(Array.isArray(data) ? data : data?.results || []);
    })();
  }, []);

  useEffect(() => {
    listEmployees(filters);
  }, [filters.search, filters.department, filters.active, filters.operational_category, filters.work_pattern, filters.page, filters.page_size]);

  const startEdit = (employee) => {
    setEditingId(employee.employee_id);
    setEditForm({
      nickname: employee.nickname || '',
      operational_category: employee.operational_category || 'normal',
      work_pattern: employee.work_pattern || '4x2',
      shift_type: employee.shift_type || 'day',
      rotation_group: employee.rotation_group || '',
      active_end_month: Boolean(employee.active_end_month),
    });
  };

  const saveEdit = async (employeeId) => {
    const ok = await updateEmployee(employeeId, editForm);
    if (ok) {
      setEditingId('');
      listEmployees(filters);
    }
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      department: '',
      active: 'true',
      operational_category: '',
      work_pattern: '',
      page: 1,
      page_size: 25,
    });
  };

  const exportCsv = async () => {
    setExporting(true);
    const params = new URLSearchParams();
    ["search", "department", "active", "operational_category", "work_pattern", "ordering"].forEach((key) => {
      const value = filters[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        params.set(key, String(value));
      }
    });
    const url = apiUrl(`/api/employees/export/${params.toString() ? `?${params.toString()}` : ''}`);
    const res = await authFetch(url);
    if (!res.ok) {
      setExporting(false);
      return;
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = match?.[1] || `employees_${new Date().toISOString().replace(/[:T-]/g, '').slice(0, 13)}.csv`;
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
    setExporting(false);
  };

  const downloadImportTemplate = async () => {
    const res = await authFetch(apiUrl('/api/employees/import-template/'));
    if (!res.ok) return;
    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'employees_import_template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  const runImportPreview = async () => {
    if (!importFile) return;
    setImportingPreview(true);
    setImportError('');
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('update_empty', String(updateEmpty));
    const access = localStorage.getItem('access');
    const res = await fetch(apiUrl('/api/employees/import-preview/'), {
      method: 'POST',
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setImportError(data.detail || 'Falha no preview do CSV.');
      setImportingPreview(false);
      return;
    }
    setImportResult(data);
    setImportingPreview(false);
  };

  const runImportCommit = async () => {
    if (!importFile || !importResult) return;
    setImportingCommit(true);
    setImportError('');
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('update_empty', String(updateEmpty));
    const access = localStorage.getItem('access');
    const res = await fetch(apiUrl('/api/employees/import-commit/'), {
      method: 'POST',
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setImportError(data.detail || 'Falha ao confirmar importação.');
      setImportingCommit(false);
      return;
    }
    setImportResult(data);
    setImportingCommit(false);
    listEmployees(filters);
  };

  const statusBadgeClass = (isActive) => (isActive ? 'master-badge active' : 'master-badge inactive');
  const categoryBadgeClass = (category) => `master-badge category ${category || 'normal'}`;
  const importableRows = (importResult?.creates || 0) + (importResult?.updates || 0);
  const formatFileSize = (size) => {
    if (!size) return '0 KB';
    if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <section className="master-panel employee-list-panel">
      <div className="master-panel-header">
        <div>
          <p className="master-eyebrow">{t('employees.records')}</p>
          <h2>{t('employees.registeredEmployees')}</h2>
        </div>
        <span className="master-count">{loading ? '...' : employees.length}</span>
      </div>

      <div className="master-filter-grid">
        <label className="master-field">
          <span>{t('management.search')}</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))}
            placeholder={t('management.searchPlaceholder')}
          />
        </label>
        <label className="master-field">
          <span>{t('employees.department')}</span>
          <select value={filters.department} onChange={(event) => setFilters((prev) => ({ ...prev, department: event.target.value, page: 1 }))}>
            <option value="">{t('management.allDepartments')}</option>
            {departments.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.code} - {dep.label_pt || dep.label_jp}
              </option>
            ))}
          </select>
        </label>
        <label className="master-field">
          <span>{t('common.status')}</span>
          <select value={filters.active} onChange={(event) => setFilters((prev) => ({ ...prev, active: event.target.value, page: 1 }))}>
            <option value="">{t('common.total')}</option>
            <option value="true">{t('common.active')}</option>
            <option value="false">{t('employees.inactive')}</option>
          </select>
        </label>
        <label className="master-field">
          <span>{t('employees.operationalCategory')}</span>
          <select value={filters.operational_category} onChange={(event) => setFilters((prev) => ({ ...prev, operational_category: event.target.value, page: 1 }))}>
            <option value="">{t('common.total')}</option>
            <option value="normal">normal</option>
            <option value="relief">relief</option>
            <option value="trainee">trainee</option>
            <option value="trainer">trainer</option>
            <option value="kl">kl</option>
            <option value="gl">gl</option>
            <option value="supervisor">supervisor</option>
            <option value="manager">manager</option>
            <option value="staff">staff</option>
          </select>
        </label>
        <label className="master-field">
          <span>{t('employees.workPattern')}</span>
          <select value={filters.work_pattern} onChange={(event) => setFilters((prev) => ({ ...prev, work_pattern: event.target.value, page: 1 }))}>
            <option value="">{t('common.total')}</option>
            <option value="4x2">4x2</option>
            <option value="5x2">5x2</option>
            <option value="manual">manual</option>
          </select>
        </label>
        <label className="master-field">
          <span>{t('employees.pageSize')}</span>
          <select
            value={filters.page_size}
            onChange={(event) => setFilters((prev) => ({ ...prev, page_size: Number(event.target.value), page: 1 }))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      <div className="master-inline-actions" style={{ marginBottom: '12px' }}>
        <button className="master-secondary-button" type="button" onClick={resetFilters}>
          {t('employees.resetFilters')}
        </button>
        <button className="master-primary-button" type="button" disabled={exporting || loading} onClick={exportCsv}>
          {exporting ? t('employees.exportingCsv') : t('employees.exportCsv')}
        </button>
      </div>

      <div className="master-panel" style={{ marginBottom: '12px' }}>
        <div className="master-panel-header">
          <div>
            <p className="master-eyebrow">Importação</p>
            <h3>Importar CSV de Funcionários (MT.csv)</h3>
          </div>
        </div>
        <div className="master-filter-grid">
          <label className="master-field">
            <span>Arquivo CSV (UTF-8/UTF-8 BOM)</span>
            <div className="master-file-picker">
              <input
                key={importFile ? 'employee-import-file-selected' : 'employee-import-file-empty'}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] || null);
                  setImportResult(null);
                  setImportError('');
                }}
              />
            </div>
            {importFile ? (
              <div className="master-selected-file">
                <div>
                  <strong>{importFile.name}</strong>
                  <span>{formatFileSize(importFile.size)}</span>
                </div>
                <button
                  className="master-secondary-button"
                  type="button"
                  onClick={() => {
                    setImportFile(null);
                    setImportResult(null);
                    setImportError('');
                  }}
                >
                  Limpar
                </button>
              </div>
            ) : (
              <p className="master-file-hint">Nenhum arquivo selecionado.</p>
            )}
          </label>
          <label className="master-field">
            <span>Atualizar com campos vazios</span>
            <select value={String(updateEmpty)} onChange={(event) => setUpdateEmpty(event.target.value === 'true')}>
              <option value="false">Não (padrão)</option>
              <option value="true">Sim</option>
            </select>
          </label>
        </div>
        <div className="master-inline-actions" style={{ marginTop: '8px' }}>
          <button className="master-secondary-button" type="button" onClick={downloadImportTemplate}>
            Baixar modelo CSV
          </button>
          <button
            className="master-secondary-button"
            type="button"
            disabled={!importFile || importingPreview}
            onClick={runImportPreview}
          >
            {importingPreview ? 'Gerando preview...' : 'Preview'}
          </button>
          <button
            className="master-primary-button"
            type="button"
            disabled={!importFile || !importResult || importingCommit || importableRows === 0}
            onClick={runImportCommit}
          >
            {importingCommit ? 'Importando...' : 'Confirmar importação'}
          </button>
        </div>
        {importError ? <p className="master-empty-state" style={{ color: '#b91c1c' }}>{importError}</p> : null}
        {importResult ? (
          <div style={{ marginTop: '10px' }}>
            <p className="master-empty-state">
              Linhas: {importResult.total_rows} | Novos: {importResult.creates} | Atualizações: {importResult.updates} | Sem mudança: {importResult.unchanged}
            </p>
            {(importResult.errors || []).length > 0 ? (
              <p className="master-empty-state" style={{ color: '#b91c1c' }}>
                Erros: {importResult.errors.length} linhas serão ignoradas na importação.
              </p>
            ) : null}
            {(importResult.warnings || []).length > 0 ? (
              <p className="master-empty-state" style={{ color: '#a16207' }}>
                Warnings: {importResult.warnings.length}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="master-empty-state" style={{ marginBottom: '12px' }}>
        {t('employees.showingRange', {
          from: pagination.count === 0 ? 0 : (filters.page - 1) * filters.page_size + 1,
          to: Math.min(filters.page * filters.page_size, pagination.count),
          total: pagination.count,
        })}
      </p>

      {loading ? (
        <p className="master-empty-state">{t('employees.loadingEmployees')}</p>
      ) : employees.length === 0 ? (
        <p className="master-empty-state">{t('employees.emptyEmployees')}</p>
      ) : (
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('common.name')}</th>
                <th>{t('employees.japaneseName')}</th>
                <th>{t('employees.department')}</th>
                <th>{t('employees.operationalCategory')}</th>
                <th>{t('employees.workPattern')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.employee_id}>
                  <td>{emp.employee_id}</td>
                  <td>{emp.name_en || emp.internal_name || '-'}</td>
                  <td>{emp.name_jp || '-'}</td>
                  <td>{emp.department_detail?.label_pt || emp.department_detail?.label_jp || '-'}</td>
                  <td>
                    <span className={categoryBadgeClass(emp.operational_category)}>{emp.operational_category || 'normal'}</span>
                  </td>
                  <td>{emp.work_pattern || '-'}</td>
                  <td>
                    <span className={statusBadgeClass(emp.active_end_month)}>{emp.active_end_month ? t('common.active') : t('employees.inactive')}</span>
                  </td>
                  <td>
                    {editingId === emp.employee_id ? (
                      <div className="master-inline-editor">
                        <input
                          value={editForm.nickname}
                          placeholder={t('employees.nickname')}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, nickname: event.target.value }))}
                        />
                        <select
                          value={editForm.operational_category}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, operational_category: event.target.value }))}
                        >
                          <option value="normal">normal</option>
                          <option value="relief">relief</option>
                          <option value="trainee">trainee</option>
                          <option value="trainer">trainer</option>
                          <option value="kl">kl</option>
                          <option value="gl">gl</option>
                          <option value="supervisor">supervisor</option>
                          <option value="manager">manager</option>
                          <option value="staff">staff</option>
                        </select>
                        <select
                          value={editForm.work_pattern}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, work_pattern: event.target.value }))}
                        >
                          <option value="4x2">4x2</option>
                          <option value="5x2">5x2</option>
                          <option value="manual">manual</option>
                        </select>
                        <select
                          value={editForm.shift_type}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, shift_type: event.target.value }))}
                        >
                          <option value="day">day</option>
                          <option value="night">night</option>
                          <option value="flexible">flexible</option>
                        </select>
                        <select
                          value={editForm.rotation_group}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, rotation_group: event.target.value }))}
                        >
                          <option value="">{t('common.none')}</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </select>
                        <label className="master-check-field">
                          <input
                            type="checkbox"
                            checked={editForm.active_end_month}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, active_end_month: event.target.checked }))}
                          />
                          <span>{t('common.active')}</span>
                        </label>
                        <button className="master-primary-button" type="button" onClick={() => saveEdit(emp.employee_id)}>
                          {t('common.save')}
                        </button>
                        <button className="master-secondary-button" type="button" onClick={() => setEditingId('')}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    ) : (
                      <div className="master-inline-actions">
                        <button className="master-secondary-button" type="button" onClick={() => startEdit(emp)}>
                          {t('common.edit')}
                        </button>
                        {emp.active_end_month ? (
                          <button
                            className="master-danger-button"
                            type="button"
                            onClick={() => deleteEmployee(emp.employee_id)}
                          >
                            {t('employees.deactivate')}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="master-inline-actions" style={{ marginTop: '12px' }}>
        <button
          className="master-secondary-button"
          type="button"
          disabled={!pagination.previous || loading}
          onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
        >
          {t('employees.previousPage')}
        </button>
        <span className="master-required-note">{t('employees.pageLabel', { page: filters.page })}</span>
        <button
          className="master-secondary-button"
          type="button"
          disabled={!pagination.next || loading}
          onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
        >
          {t('employees.nextPage')}
        </button>
      </div>
    </section>
  );
}
