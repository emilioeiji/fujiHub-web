import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import PermissionNotice from '../components/PermissionNotice';
import { useOperationPermissions } from '../hooks/useOperationPermissions';
import { noOperationalModuleMessage, requestAccessMessage } from '../utils/apiErrors';
import './Inventory.css';
import './Operations.css';

export default function OperationsLayout({ children, title, subtitle, summary }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { role, scopes, flags } = useOperationPermissions();
  const hasOperationalModule =
    flags.can_view_schedule || flags.can_view_hikitsugui || flags.can_view_attendance_dashboard || flags.can_view_dashboard_tv || flags.can_view_rbac;

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
          <Link className="inventory-nav-link" to="/inventory/items">{t('nav.inventory')}</Link>
          <Link className="inventory-nav-link" to="/medical/requests">{t('nav.medical')}</Link>
          <Link className="inventory-nav-link active" to="/operations/calendars">{t('nav.operations')}</Link>
        </nav>
      </aside>

      <main className="inventory-main">
        <header className="inventory-header">
          <div>
            <p className="inventory-eyebrow">{t('operations.module')}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="inventory-actions">
            <Link to="/dashboard">{t('nav.backDashboard')}</Link>
            <LanguageSelector compact />
            <button type="button" onClick={handleLogout}>{t('nav.logout')}</button>
          </div>
        </header>

        <nav className="inventory-tabs" aria-label={t('operations.module')}>
          {flags.can_view_attendance_dashboard ? (
            <Link
              className={location.pathname.startsWith('/operations/attendance-dashboard') ? 'active' : ''}
              to="/operations/attendance-dashboard"
            >
              Presença
            </Link>
          ) : null}
          {/* Dashboard de produção oculto temporariamente da navegação para priorizar o painel administrativo. */}
          {flags.can_view_schedule ? (
            <Link
              className={location.pathname.startsWith('/operations/calendars') ? 'active' : ''}
              to="/operations/calendars"
            >
              {t('operations.calendars')}
            </Link>
          ) : null}
          {flags.can_view_hikitsugui ? (
            <Link
              className={location.pathname.startsWith('/operations/hikitsugui') ? 'active' : ''}
              to="/operations/hikitsugui"
            >
              Hikitsugui
            </Link>
          ) : null}
          {flags.can_view_rbac ? (
            <Link
              className={location.pathname.startsWith('/operations/access') ? 'active' : ''}
              to="/operations/access"
            >
              Acessos / RBAC
            </Link>
          ) : null}
        </nav>

        <section className="inventory-panel" style={{ marginTop: '0.5rem' }}>
          <small>
            Perfil: <strong>{role || 'sem perfil'}</strong> | Escopos: <strong>{scopes?.length || 0}</strong>
          </small>
        </section>

        {summary ? (
          <section className="inventory-summary" aria-label={t('operations.module')}>
            {summary.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </section>
        ) : null}

        {!hasOperationalModule ? (
          <PermissionNotice
            title="Acesso operacional"
            message={`${noOperationalModuleMessage()} ${requestAccessMessage()}`}
            variant="blocked"
          />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
