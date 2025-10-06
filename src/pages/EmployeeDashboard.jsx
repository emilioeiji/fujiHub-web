// src/pages/EmployeeDashboard.jsx
import './EmployeeDashboard.css';
import EmployeeForm from './EmployeeForm';
import EmployeeList from './EmployeeList';

export default function EmployeeDashboard() {
  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">📊 FujiHub - Gestão de Funcionários</h1>

      <section className="dashboard-section">
        <h2>➕ Novo Cadastro</h2>
        <EmployeeForm />
      </section>

      <section className="dashboard-section">
        <h2>👥 Funcionários Cadastrados</h2>
        <EmployeeList />
      </section>
    </div>
  );
}
