import { useEmployees } from '../hooks/useEmployees';

export default function EmployeeList() {
  const { employees, loading, deleteEmployee } = useEmployees();

  if (loading) return <p>Carregando...</p>;

  return (
    <div>
      <h2>👥 Funcionários</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>Depto</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.employee_id}>
              <td>{emp.employee_id}</td>
              <td>{emp.name_en}</td>
              <td>{emp.department}</td>
              <td>
                <button onClick={() => deleteEmployee(emp.employee_id)}>Excluir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
