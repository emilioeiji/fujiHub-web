import { useEmployees } from '../hooks/useEmployees';

export default function EmployeeList() {
  const { employees, loading, deleteEmployee } = useEmployees();

  return (
    <section className="master-panel employee-list-panel">
      <div className="master-panel-header">
        <div>
          <p className="master-eyebrow">Registros</p>
          <h2>Funcionários cadastrados</h2>
        </div>
        <span className="master-count">{loading ? '...' : employees.length}</span>
      </div>

      {loading ? (
        <p className="master-empty-state">Carregando funcionários...</p>
      ) : employees.length === 0 ? (
        <p className="master-empty-state">Nenhum funcionário cadastrado até o momento.</p>
      ) : (
        <div className="master-table-wrap">
          <table className="master-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Departamento</th>
                <th>Ações</th>
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
                      Excluir
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
