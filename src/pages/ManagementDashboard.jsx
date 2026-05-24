import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ManagementLayout from './ManagementLayout';

export default function ManagementDashboard() {
  const { t } = useTranslation();

  const cards = [
    { to: '/management/users', title: t('management.users'), description: t('management.usersDescription') },
    { to: '/management/operations', title: t('management.operations'), description: t('management.operationsDescription') },
    { to: '/management/inventory', title: t('management.inventory'), description: t('management.inventoryDescription') },
    { to: '/management/medical', title: t('management.medical'), description: t('management.medicalDescription') },
  ];

  return (
    <ManagementLayout title={t('management.title')} subtitle={t('management.subtitle')}>
      <div className="inventory-summary">
        {cards.map((card) => (
          <article key={card.to}>
            <span>{card.title}</span>
            <small>{card.description}</small>
            <Link className="inventory-small-button" to={card.to}>
              {t('management.open')}
            </Link>
          </article>
        ))}
      </div>
    </ManagementLayout>
  );
}

