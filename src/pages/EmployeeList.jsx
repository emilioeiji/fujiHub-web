import { useEmployees } from '../hooks/useEmployees';
import { useTranslation } from 'react-i18next';

export default function EmployeeList() {
  const { t } = useTranslation();
  const { employees, loading, deleteEmployee } = useEmployees();

  return (
    <section className="master-panel employee-list-panel">
      <div className="master-panel-header">
        <div>
          <p className="master-eyebrow">{t('employees.records')}</p>
          <h2>{t('employees.registeredEmployees')}</h2>
        </div>
        <span className="master-count">{loading ? '...' : employees.length}</span>
      </div>

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
                <th>{t('employees.department')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.employee_id}>
                  <td>{emp.employee_id}</td>
                  <td>{emp.name_en || emp.internal_name || '-'}</td>
                  <td>{emp.department || '-'}</td>
                  <td>
                    <button
                      className="master-danger-button"
                      type="button"
                      onClick={() => deleteEmployee(emp.employee_id)}
                    >
                      {t('employees.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
