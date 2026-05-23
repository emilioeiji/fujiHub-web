import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import './Inventory.css';

export default function InventoryLayout({ children, title, subtitle, summary }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="inventory-shell">
      <aside className="inventory-sidebar" aria-label={t('nav.dashboard')}>
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
          <Link className="inventory-nav-link active" to="/inventory/items">{t('nav.inventory')}</Link>
          <Link className="inventory-nav-link" to="/medical/requests">{t('nav.medical')}</Link>
          <Link className="inventory-nav-link" to="/operations/calendars">{t('nav.operations')}</Link>
        </nav>
      </aside>

      <main className="inventory-main">
        <header className="inventory-header">
          <div>
            <p className="inventory-eyebrow">{t('inventory.module')}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="inventory-actions">
            <Link to="/dashboard">{t('nav.backDashboard')}</Link>
            <LanguageSelector compact />
            <button type="button" onClick={handleLogout}>{t('nav.logout')}</button>
          </div>
        </header>

        <nav className="inventory-tabs" aria-label={t('inventory.module')}>
          <Link
            className={location.pathname === '/inventory/items' ? 'active' : ''}
            to="/inventory/items"
          >
            {t('inventory.items')}
          </Link>
          <Link
            className={location.pathname === '/inventory/requests' ? 'active' : ''}
            to="/inventory/requests"
          >
            {t('inventory.requests')}
          </Link>
        </nav>

        {summary ? (
          <section className="inventory-summary" aria-label={t('inventory.module')}>
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
