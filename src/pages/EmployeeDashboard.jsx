// src/pages/EmployeeDashboard.jsx
import { Link, useNavigate } from 'react-router-dom';
import './EmployeeDashboard.css';
import EmployeeForm from './EmployeeForm';
import EmployeeList from './EmployeeList';

export default function EmployeeDashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="master-shell">
      <aside className="master-sidebar" aria-label="Navegação principal">
        <div className="master-brand">
          <span className="master-brand-mark">FH</span>
          <div>
            <strong>FujiHub</strong>
            <span>ERP Operacional</span>
          </div>
        </div>

        <nav className="master-nav">
          <Link className="master-nav-link" to="/dashboard">Dashboard</Link>
          <Link className="master-nav-link active" to="/employees">Funcionários</Link>
          <Link className="master-nav-link" to="/inventory/items">Uniformes</Link>
          <span className="master-nav-link disabled">Escalas</span>
          <span className="master-nav-link disabled">Relatórios</span>
        </nav>
      </aside>

      <main className="master-main">
        <header className="master-header">
          <div>
            <p className="master-eyebrow">Módulo master</p>
            <h1>Cadastro master de funcionários</h1>
            <p>
              Base central para registrar operadores, dados contratuais, alocação, controle financeiro
              e informações usadas pelos próximos módulos do ERP.
            </p>
          </div>

          <div className="master-actions">
            <Link to="/dashboard">Voltar ao dashboard</Link>
            <button type="button" onClick={handleLogout}>Sair</button>
          </div>
        </header>

        <section className="master-summary" aria-label="Resumo do módulo">
          <article>
            <span>Status</span>
            <strong>Em implantação</strong>
            <small>Primeiro módulo operacional</small>
          </article>
          <article>
            <span>Fonte principal</span>
            <strong>Master</strong>
            <small>Dados base dos operadores</small>
          </article>
          <article>
            <span>Próximos usos</span>
            <strong>Escalas</strong>
            <small>Moradia e relatórios</small>
          </article>
        </section>

        <section className="master-workspace">
          <EmployeeForm />
          <EmployeeList />
        </section>
      </main>
    </div>
  );
}
