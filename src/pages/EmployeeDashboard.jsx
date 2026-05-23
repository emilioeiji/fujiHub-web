// src/pages/EmployeeDashboard.jsx
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import LanguageSelector from '../components/LanguageSelector';
import './EmployeeDashboard.css';
import EmployeeForm from './EmployeeForm';
import EmployeeList from './EmployeeList';

export default function EmployeeDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="master-shell">
      <aside className="master-sidebar" aria-label={t('nav.dashboard')}>
        <div className="master-brand">
          <span className="master-brand-mark">FH</span>
          <div>
            <strong>FujiHub</strong>
            <span>{t('app.tagline')}</span>
          </div>
        </div>

        <nav className="master-nav">
          <Link className="master-nav-link" to="/dashboard">{t('nav.dashboard')}</Link>
          <Link className="master-nav-link active" to="/employees">{t('nav.employees')}</Link>
          <Link className="master-nav-link" to="/inventory/items">{t('nav.inventory')}</Link>
          <Link className="master-nav-link" to="/medical/requests">{t('nav.medical')}</Link>
          <span className="master-nav-link disabled">{t('nav.operations')}</span>
        </nav>
      </aside>

      <main className="master-main">
        <header className="master-header">
          <div>
            <p className="master-eyebrow">{t('employees.module')}</p>
            <h1>{t('employees.title')}</h1>
            <p>
              {t('employees.subtitle')}
            </p>
          </div>

          <div className="master-actions">
            <Link to="/dashboard">{t('nav.backDashboard')}</Link>
            <LanguageSelector compact />
            <button type="button" onClick={handleLogout}>{t('nav.logout')}</button>
          </div>
        </header>

        <section className="master-summary" aria-label={t('employees.module')}>
          <article>
            <span>{t('employees.summaryStatus')}</span>
            <strong>{t('employees.summaryStatusValue')}</strong>
            <small>{t('employees.summaryStatusDetail')}</small>
          </article>
          <article>
            <span>{t('employees.summarySource')}</span>
            <strong>{t('employees.summarySourceValue')}</strong>
            <small>{t('employees.summarySourceDetail')}</small>
          </article>
          <article>
            <span>{t('employees.summaryNextUses')}</span>
            <strong>{t('employees.summaryNextUsesValue')}</strong>
            <small>{t('employees.summaryNextUsesDetail')}</small>
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
