import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const [profile, setProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState('Carregando sessão');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const res = await authFetch('http://127.0.0.1:8000/api/profile/');

      if (res.ok) {
        setProfile(await res.json());
        setProfileStatus('Sessão ativa');
        return;
      }

      if (res.status === 401) {
        navigate('/login', { replace: true });
        return;
      }

      setProfileStatus('Sessão local ativa');
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
            <span>ERP Operacional</span>
          </div>
        </div>

        <nav className="erp-nav">
          <Link className="erp-nav-link active" to="/dashboard">Dashboard</Link>
          <Link className="erp-nav-link" to="/employees">Funcionários</Link>
          <span className="erp-nav-link disabled">Escalas</span>
          <span className="erp-nav-link disabled">Moradia</span>
          <span className="erp-nav-link disabled">Relatórios</span>
        </nav>
      </aside>

      <main className="erp-main">
        <header className="erp-header">
          <div>
            <p className="erp-eyebrow">Painel inicial</p>
            <h1>Controle geral dos operadores</h1>
            <p className="erp-subtitle">
              Visão central para acompanhar cadastros, operação e próximos módulos do ERP.
            </p>
          </div>

          <div className="erp-session">
            <span>{profileStatus}</span>
            <strong>{profile?.username || 'Usuário logado'}</strong>
            <button type="button" onClick={handleLogout}>Sair</button>
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
                <p className="erp-eyebrow">Próximo passo</p>
                <h2>Cadastro master de funcionários</h2>
              </div>
              <Link className="erp-primary-action" to="/employees">Abrir cadastro</Link>
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
                <p className="erp-eyebrow">Módulos</p>
                <h2>Mapa do ERP</h2>
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
