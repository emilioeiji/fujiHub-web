import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import LanguageSelector from '../components/LanguageSelector';
import { authFetch } from '../utils/authFetch';
import './Dashboard.css';

const modules = [
  {
    title: 'Funcionários',
    description: 'Cadastro master, dados cadastrais e acompanhamento dos operadores.',
    status: 'Em implantação',
    to: '/employees',
  },
  {
    title: 'Uniformes',
    description: 'Cadastro de itens, solicitações e workflow de entrega de uniformes.',
    status: 'Inicial',
    to: '/inventory/items',
  },
  {
    title: 'Atendimento médico',
    description: 'Solicitações internas, triagem e acompanhamento operacional de saúde.',
    status: 'Inicial',
    to: '/medical/requests',
  },
  {
    title: 'Escalas e operações',
    description: 'Visão operacional de turnos, postos e disponibilidade da equipe.',
    status: 'Planejado',
  },
  {
    title: 'Moradia e apoio',
    description: 'Controle de alojamentos, vínculos e informações de suporte.',
    status: 'Planejado',
  },
  {
    title: 'Relatórios',
    description: 'Indicadores gerenciais para tomada de decisão e auditoria interna.',
    status: 'Planejado',
  },
];

const indicators = [
  { label: 'Operadores ativos', value: '--', detail: 'Aguardando integração' },
  { label: 'Cadastros pendentes', value: '--', detail: 'Dados do módulo master' },
  { label: 'Ocorrências abertas', value: '--', detail: 'Módulo futuro' },
  { label: 'Alertas de operação', value: '--', detail: 'Módulo futuro' },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState(t('dashboard.loadingSession'));
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const res = await authFetch('http://127.0.0.1:8000/api/profile/');

      if (res.ok) {
        setProfile(await res.json());
        setProfileStatus(t('dashboard.sessionActive'));
        return;
      }

      if (res.status === 401) {
        navigate('/login', { replace: true });
        return;
      }

      setProfileStatus(t('dashboard.sessionLocal'));
    })();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="erp-shell">
      <aside className="erp-sidebar" aria-label="Navegação principal">
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
            <span>{profileStatus}</span>
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
              O primeiro módulo ativo concentra o cadastro base dos operadores. Ele será a fonte
              principal para os próximos controles de escala, moradia, documentos e relatórios.
            </p>
            <div className="erp-progress-list">
              <div>
                <span>1</span>
                <p>Cadastro master</p>
              </div>
              <div>
                <span>2</span>
                <p>Dados complementares</p>
              </div>
              <div>
                <span>3</span>
                <p>Operação e relatórios</p>
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
