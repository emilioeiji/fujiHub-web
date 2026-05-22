import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import './Inventory.css';

export default function MedicalLayout({ children, title, subtitle, summary }) {
  const { t } = useTranslation();
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
            <span>{t('app.tagline')}</span>
          </div>
        </div>

        <nav className="inventory-nav">
          <Link className="inventory-nav-link" to="/dashboard">{t('nav.dashboard')}</Link>
          <Link className="inventory-nav-link" to="/employees">{t('nav.employees')}</Link>
          <Link className="inventory-nav-link" to="/inventory/items">{t('nav.inventory')}</Link>
          <Link className="inventory-nav-link active" to="/medical/requests">{t('nav.medical')}</Link>
          <span className="inventory-nav-link disabled">{t('nav.operations')}</span>
        </nav>
      </aside>

      <main className="inventory-main">
        <header className="inventory-header">
          <div>
            <p className="inventory-eyebrow">{t('medical.module')}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="inventory-actions">
            <Link to="/dashboard">{t('nav.backDashboard')}</Link>
            <LanguageSelector compact />
            <button type="button" onClick={handleLogout}>{t('nav.logout')}</button>
          </div>
        </header>

        <nav className="inventory-tabs" aria-label="Medical">
          <Link
            className={location.pathname === '/medical/requests' ? 'active' : ''}
            to="/medical/requests"
          >
            {t('medical.requests')}
          </Link>
          <Link
            className={location.pathname === '/medical/master-data' ? 'active' : ''}
            to="/medical/master-data"
          >
            {t('medical.masterData')}
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
