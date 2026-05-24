import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import LanguageSelector from '../components/LanguageSelector';
import { authFetch } from '../utils/authFetch';
import './Dashboard.css';

export default function Dashboard() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [profileStatusKey, setProfileStatusKey] = useState('dashboard.loadingSession');
  const navigate = useNavigate();

  const indicators = [
    {
      label: t('dashboard.indicators.activeOperators'),
      value: '--',
      detail: t('dashboard.indicators.waitingIntegration'),
    },
    {
      label: t('dashboard.indicators.pendingRecords'),
      value: '--',
      detail: t('dashboard.indicators.masterModuleData'),
    },
    {
      label: t('dashboard.indicators.openOccurrences'),
      value: '--',
      detail: t('dashboard.indicators.futureModule'),
    },
    {
      label: t('dashboard.indicators.operationAlerts'),
      value: '--',
      detail: t('dashboard.indicators.futureModule'),
    },
  ];

  const modules = [
    {
      title: t('dashboard.moduleCards.employeesTitle'),
      description: t('dashboard.moduleCards.employeesDescription'),
      status: t('dashboard.moduleCards.statusImplementing'),
      to: '/employees',
    },
    {
      title: t('dashboard.moduleCards.inventoryTitle'),
      description: t('dashboard.moduleCards.inventoryDescription'),
      status: t('dashboard.moduleCards.statusInitial'),
      to: '/inventory/items',
    },
    {
      title: t('dashboard.moduleCards.medicalTitle'),
      description: t('dashboard.moduleCards.medicalDescription'),
      status: t('dashboard.moduleCards.statusInitial'),
      to: '/medical/requests',
    },
    {
      title: t('dashboard.moduleCards.operationsTitle'),
      description: t('dashboard.moduleCards.operationsDescription'),
      status: t('dashboard.moduleCards.statusPlanned'),
      to: '/operations/calendars',
    },
    {
      title: t('dashboard.moduleCards.managementTitle'),
      description: t('dashboard.moduleCards.managementDescription'),
      status: t('dashboard.moduleCards.statusInitial'),
      to: '/management',
    },
    {
      title: t('dashboard.moduleCards.housingTitle'),
      description: t('dashboard.moduleCards.housingDescription'),
      status: t('dashboard.moduleCards.statusPlanned'),
    },
    {
      title: t('dashboard.moduleCards.reportsTitle'),
      description: t('dashboard.moduleCards.reportsDescription'),
      status: t('dashboard.moduleCards.statusPlanned'),
    },
  ];

  useEffect(() => {
    (async () => {
      const res = await authFetch('http://127.0.0.1:8000/api/profile/');

      if (res.ok) {
        setProfile(await res.json());
        setProfileStatusKey('dashboard.sessionActive');
        return;
      }

      if (res.status === 401) {
        navigate('/login', { replace: true });
        return;
      }

      setProfileStatusKey('dashboard.sessionLocal');
    })();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="erp-shell">
      <aside className="erp-sidebar" aria-label={t('nav.dashboard')}>
        <div className="erp-brand">
          <span className="erp-brand-mark">FH</span>
          <div>
            <strong>FujiHub</strong>
            <span>{t('app.tagline')}</span>
          </div>
        </div>

        <nav className="erp-nav">
          <Link className="erp-nav-link active" to="/dashboard">{t('nav.dashboard')}</Link>
          <Link className="erp-nav-link" to="/employees">{t('nav.employees')}</Link>
          <Link className="erp-nav-link" to="/inventory/items">{t('nav.inventory')}</Link>
          <Link className="erp-nav-link" to="/medical/requests">{t('nav.medical')}</Link>
          <Link className="erp-nav-link" to="/management">{t('nav.management')}</Link>
          <span className="erp-nav-link disabled">{t('nav.operations')}</span>
        </nav>
      </aside>

      <main className="erp-main">
        <header className="erp-header">
          <div>
            <p className="erp-eyebrow">{t('dashboard.eyebrow')}</p>
            <h1>{t('dashboard.title')}</h1>
            <p className="erp-subtitle">
              {t('dashboard.subtitle')}
            </p>
          </div>

          <div className="erp-session">
            <span>{t(profileStatusKey)}</span>
            <strong>{profile?.username || t('dashboard.loggedUser')}</strong>
            <LanguageSelector compact />
            <button type="button" onClick={handleLogout}>{t('nav.logout')}</button>
          </div>
        </header>

        <section className="erp-indicators" aria-label="Indicadores operacionais">
          {indicators.map((indicator) => (
            <article className="erp-indicator" key={indicator.label}>
              <span>{indicator.label}</span>
              <strong>{indicator.value}</strong>
              <small>{indicator.detail}</small>
            </article>
          ))}
        </section>

        <section className="erp-content-grid">
          <div className="erp-panel erp-panel-large">
            <div className="erp-panel-header">
              <div>
                <p className="erp-eyebrow">{t('dashboard.nextStep')}</p>
                <h2>{t('dashboard.employeeMaster')}</h2>
              </div>
              <Link className="erp-primary-action" to="/employees">{t('nav.employees')}</Link>
            </div>
            <p>
              {t('dashboard.employeeMasterDescription')}
            </p>
            <div className="erp-progress-list">
              <div>
                <span>1</span>
                <p>{t('dashboard.progressMaster')}</p>
              </div>
              <div>
                <span>2</span>
                <p>{t('dashboard.progressComplement')}</p>
              </div>
              <div>
                <span>3</span>
                <p>{t('dashboard.progressOperations')}</p>
              </div>
            </div>
          </div>

          <div className="erp-panel">
            <div className="erp-panel-header compact">
              <div>
                <p className="erp-eyebrow">{t('dashboard.modules')}</p>
                <h2>{t('dashboard.erpMap')}</h2>
              </div>
            </div>
            <div className="erp-module-list">
              {modules.map((module) => {
                const content = (
                  <>
                    <div>
                      <strong>{module.title}</strong>
                      <p>{module.description}</p>
                    </div>
                    <span>{module.status}</span>
                  </>
                );

                return module.to ? (
                  <Link className="erp-module-item actionable" to={module.to} key={module.title}>
                    {content}
                  </Link>
                ) : (
                  <div className="erp-module-item" key={module.title}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
