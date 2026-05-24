import { useTranslation } from 'react-i18next';
import ManagementResourceSection from '../components/ManagementResourceSection';
import ManagementLayout from './ManagementLayout';

export default function ManagementOperations() {
  const { t } = useTranslation();

  return (
    <ManagementLayout title={t('management.operations')} subtitle={t('management.operationsDescription')}>
      <div className="inventory-stack">
        <ManagementResourceSection
          title="RotationGroupStyle"
          endpoint="/api/operations/rotation-group-styles/"
          createDefaults={{ group_code: '', label: '', background_color: '#ffffff', text_color: '#17232d', display_order: 0, is_active: true }}
          fields={[
            { name: 'group_code', label: t('management.groupCode'), required: true },
            { name: 'label', label: t('management.label'), required: true },
            { name: 'background_color', label: t('management.backgroundColor') },
            { name: 'text_color', label: t('management.textColor') },
            { name: 'display_order', label: t('management.order'), type: 'number' },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title="EmployeeVisualCategory"
          endpoint="/api/operations/visual-categories/"
          createDefaults={{ code: '', label_pt: '', label_jp: '', target_column: 'name', background_color: '#ffffff', text_color: '#17232d', print_behavior: 'show', display_order: 0, is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'label_pt', label: t('management.namePt'), required: true },
            { name: 'label_jp', label: t('management.nameJp'), required: true },
            { name: 'target_column', label: t('management.targetColumn') },
            { name: 'print_behavior', label: t('management.printBehavior') },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title="OperationalCode"
          endpoint="/api/operations/operational-codes/"
          createDefaults={{ code: '', label_pt: '', label_jp: '', category: '', attendance_status: '', work_time_code: '', background_color: '', text_color: '', affects_overtime: false, affects_holiday_work: false, is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'label_pt', label: t('management.namePt'), required: true },
            { name: 'label_jp', label: t('management.nameJp'), required: true },
            { name: 'category', label: t('management.category') },
            { name: 'attendance_status', label: t('management.attendanceStatusId') },
            { name: 'work_time_code', label: t('management.workTimeCodeId') },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title="AttendanceStatus"
          endpoint="/api/operations/attendance-statuses/"
          createDefaults={{ code: '', label_pt: '', label_jp: '', color: '#ffffff', is_working_day: false, is_absence: false, is_paid_leave: false, is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'label_pt', label: t('management.namePt'), required: true },
            { name: 'label_jp', label: t('management.nameJp'), required: true },
            { name: 'color', label: t('management.color') },
            { name: 'is_working_day', label: t('management.workingDay'), type: 'checkbox' },
            { name: 'is_absence', label: t('management.absence'), type: 'checkbox' },
            { name: 'is_paid_leave', label: t('management.paidLeave'), type: 'checkbox' },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title="WorkTimeCode"
          endpoint="/api/operations/work-time-codes/"
          createDefaults={{ code: '', label_pt: '', label_jp: '', color: '', affects_overtime: false, is_active: true }}
          fields={[
            { name: 'code', label: t('common.code'), required: true },
            { name: 'label_pt', label: t('management.namePt'), required: true },
            { name: 'label_jp', label: t('management.nameJp'), required: true },
            { name: 'color', label: t('management.color') },
            { name: 'affects_overtime', label: t('management.affectsOvertime'), type: 'checkbox' },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />

        <ManagementResourceSection
          title="OperationalPosition"
          endpoint="/api/operations/positions/"
          createDefaults={{ department: '', code: '', name_pt: '', name_jp: '', building_floor: '', description: '', is_active: true }}
          fields={[
            { name: 'department', label: t('management.departmentId'), required: true },
            { name: 'code', label: t('common.code'), required: true },
            { name: 'name_pt', label: t('management.namePt'), required: true },
            { name: 'name_jp', label: t('management.nameJp'), required: true },
            { name: 'building_floor', label: t('management.buildingFloorId') },
            { name: 'description', label: t('common.description') },
            { name: 'is_active', label: t('common.active'), type: 'checkbox' },
          ]}
        />
      </div>
    </ManagementLayout>
  );
}

