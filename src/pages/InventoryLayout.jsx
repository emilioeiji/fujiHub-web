import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Inventory.css';

export default function InventoryLayout({ children, title, subtitle, summary }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="inventory-shell">
      <aside className="inventory-sidebar" aria-label="Navegação principal">
        <div className="inventory-brand">
          <span className="inventory-brand-mark">FH</span>
          <div>
            <strong>FujiHub</strong>
            <span>ERP Operacional</span>
          </div>
        </div>

        <nav className="inventory-nav">
          <Link className="inventory-nav-link" to="/dashboard">Dashboard</Link>
          <Link className="inventory-nav-link" to="/employees">Funcionários</Link>
          <Link className="inventory-nav-link active" to="/inventory/items">Uniformes</Link>
          <span className="inventory-nav-link disabled">Escalas</span>
          <span className="inventory-nav-link disabled">Relatórios</span>
        </nav>
      </aside>

      <main className="inventory-main">
        <header className="inventory-header">
          <div>
            <p className="inventory-eyebrow">Inventory</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="inventory-actions">
            <Link to="/dashboard">Voltar ao dashboard</Link>
            <button type="button" onClick={handleLogout}>Sair</button>
          </div>
        </header>

        <nav className="inventory-tabs" aria-label="Inventory">
          <Link
            className={location.pathname === '/inventory/items' ? 'active' : ''}
            to="/inventory/items"
          >
            Itens
          </Link>
          <Link
            className={location.pathname === '/inventory/requests' ? 'active' : ''}
            to="/inventory/requests"
          >
            Solicitações
          </Link>
        </nav>

        {summary ? (
          <section className="inventory-summary" aria-label="Resumo do módulo">
            {summary.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </section>
        ) : null}

        {children}
      </main>
    </div>
  );
}
