import { useTranslation } from 'react-i18next';
import ManagementResourceSection from '../components/ManagementResourceSection';
import ManagementLayout from './ManagementLayout';

export default function ManagementInventory() {
  const { t } = useTranslation();

  return (
    <ManagementLayout title={t('management.inventory')} subtitle={t('management.inventoryDescription')}>
      <div className="inventory-stack">
        <ManagementResourceSection
          title={t('management.uniformCategories')}
          endpoint="/api/inventory/categories/"
          createDefaults={{ code: '', label_pt: '', label_jp: '', is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'label_pt', label: t('management.namePt'), required: true },
            { name: 'label_jp', label: t('management.nameJp'), required: true },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title={t('management.uniformItems')}
          endpoint="/api/inventory/items/"
          createDefaults={{ sku: '', name: '', category: '', size: '', color: '', stock_quantity: 0, minimum_stock: 0, unit_cost: 0, is_active: true }}
          fields={[
            { name: 'sku', label: 'SKU', required: true },
            { name: 'name', label: t('management.name'), required: true },
            { name: 'category', label: t('management.categoryId'), required: true },
            { name: 'size', label: t('inventory.size') },
            { name: 'color', label: t('inventory.color') },
            { name: 'stock_quantity', label: t('inventory.stock'), type: 'number' },
            { name: 'minimum_stock', label: t('inventory.minimumStock'), type: 'number' },
            { name: 'unit_cost', label: t('inventory.unitCost'), type: 'number' },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />
      </div>
    </ManagementLayout>
  );
}

