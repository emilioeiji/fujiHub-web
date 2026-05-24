import { useTranslation } from 'react-i18next';
import ManagementResourceSection from '../components/ManagementResourceSection';
import ManagementLayout from './ManagementLayout';

export default function ManagementMedical() {
  const { t } = useTranslation();

  return (
    <ManagementLayout title={t('management.medical')} subtitle={t('management.medicalDescription')}>
      <div className="inventory-stack">
        <ManagementResourceSection
          title={t('management.medicalReasons')}
          endpoint="/api/medical/reasons/"
          createDefaults={{ code: '', name_pt: '', name_jp: '', is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'name_pt', label: t('management.namePt'), required: true },
            { name: 'name_jp', label: t('management.nameJp'), required: true },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title={t('management.symptomTypes')}
          endpoint="/api/medical/symptoms/"
          createDefaults={{ code: '', name_pt: '', name_jp: '', is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'name_pt', label: t('management.namePt'), required: true },
            { name: 'name_jp', label: t('management.nameJp'), required: true },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title={t('management.medicalDestinations')}
          endpoint="/api/medical/destinations/"
          createDefaults={{ code: '', name: '', address: '', phone: '', is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'name', label: t('management.name'), required: true },
            { name: 'address', label: t('medical.master.address') },
            { name: 'phone', label: t('medical.master.phone') },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />
      </div>
    </ManagementLayout>
  );
}

