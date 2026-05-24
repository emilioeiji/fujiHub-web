import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import './Inventory.css';

export default function ManagementLayout({ children, title, subtitle }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  const tabs = [
    { to: '/management', label: t('management.dashboard') },
    { to: '/management/users', label: t('management.users') },
    { to: '/management/operations', label: t('management.operations') },
    { to: '/management/inventory', label: t('management.inventory') },
    { to: '/management/medical', label: t('management.medical') },
  ];

  return (
    <div className="inventory-shell">
      <aside className="inventory-sidebar">
        <div className="inventory-brand">
          <span className="inventory-brand-mark">FH</span>
          <div>
            <strong>FujiHub</strong>
            <span>{t('app.tagline')}</span>
          </div>
        </div>
        <nav className="inventory-nav">
          <Link className="inventory-nav-link" to="/dashboard">{t('nav.dashboard')}</Link>
          <Link className="inventory-nav-link active" to="/management">{t('nav.management')}</Link>
          <Link className="inventory-nav-link" to="/operations/calendars">{t('nav.operations')}</Link>
          <Link className="inventory-nav-link" to="/inventory/items">{t('nav.inventory')}</Link>
          <Link className="inventory-nav-link" to="/medical/requests">{t('nav.medical')}</Link>
        </nav>
      </aside>

      <main className="inventory-main">
        <header className="inventory-header">
          <div>
            <p className="inventory-eyebrow">{t('management.module')}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="inventory-actions">
            <Link to="/dashboard">{t('nav.backDashboard')}</Link>
            <LanguageSelector compact />
            <button type="button" onClick={handleLogout}>{t('nav.logout')}</button>
          </div>
        </header>

        <nav className="inventory-tabs" aria-label={t('management.module')}>
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              className={location.pathname === tab.to ? 'active' : ''}
              to={tab.to}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <section className="inventory-workspace">{children}</section>
      </main>
    </div>
  );
}

