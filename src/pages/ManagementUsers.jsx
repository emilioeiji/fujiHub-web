import { useTranslation } from 'react-i18next';
import ManagementResourceSection from '../components/ManagementResourceSection';
import ManagementLayout from './ManagementLayout';

export default function ManagementUsers() {
  const { t } = useTranslation();

  return (
    <ManagementLayout title={t('management.users')} subtitle={t('management.usersDescription')}>
      <div className="inventory-stack">
        <ManagementResourceSection
          title={t('management.roles')}
          endpoint="/api/accounts/roles/"
          createDefaults={{ name: '', code: '', description: '', is_active: true }}
          createLabel={t('management.createRole')}
          fields={[
            { name: 'name', label: t('management.name'), required: true },
            { name: 'code', label: t('common.code'), required: true },
            { name: 'description', label: t('common.description') },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title={t('management.userProfiles')}
          endpoint="/api/accounts/profiles/"
          allowCreate={false}
          createDefaults={{ user: '', role: '', department: '', language: 'pt-BR', is_active: true }}
          createLabel={t('management.createProfile')}
          fields={[
            { name: 'id', label: 'ID', readOnly: true },
            { name: 'username', label: t('auth.username'), readOnly: true },
            { name: 'role', label: t('management.roleId') },
            { name: 'department', label: t('employees.department') },
            { name: 'language', label: t('management.language') },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />
      </div>
    </ManagementLayout>
  );
}
