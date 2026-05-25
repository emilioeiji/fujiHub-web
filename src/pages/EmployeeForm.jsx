import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useEmployees } from '../hooks/useEmployees';
import { getLocalizedLabel, getLocalizedName } from '../i18n/helpers';
import { authFetch } from '../utils/authFetch';
import './EmployeeForm.css';

import { apiUrl } from '../config/api';

function TextField({ label, register, name, type = 'text', required = false }) {
  return (
    <label className="master-field">
      <span>{label}</span>
      <input type={type} {...register(name)} required={required} />
    </label>
  );
}

function SelectField({ label, register, name, placeholder, options, getLabel }) {
  return (
    <label className="master-field">
      <span>{label}</span>
      <select {...register(name)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {getLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({ label, register, name }) {
  return (
    <label className="master-check-field">
      <input type="checkbox" {...register(name)} />
      <span>{label}</span>
    </label>
  );
}

export default function EmployeeForm() {
  const { i18n, t } = useTranslation();
  const { register, handleSubmit, reset } = useForm();
  const { createEmployee } = useEmployees();

  const [genders, setGenders] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [nationalities, setNationalities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [billingRates, setBillingRates] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [entryTypes, setEntryTypes] = useState([]);
  const [hireTypes, setHireTypes] = useState([]);
  const [buildingFloors, setBuildingFloors] = useState([]);
  const [rejoinedOptions, setRejoinedOptions] = useState([]);

  useEffect(() => {
    async function fetchOptions() {
      const endpoints = {
        genders: '/api/genders/',
        shifts: '/api/shifts/',
        nationalities: '/api/nationalities/',
        departments: '/api/departments/',
        billingRates: '/api/billingrates/',
        processes: '/api/processes/',
        entryTypes: '/api/entrytypes/',
        hireTypes: '/api/hiretypes/',
        buildingFloors: '/api/buildingfloors/',
        rejoinedOptions: '/api/rejoined/',
      };

      for (const [key, url] of Object.entries(endpoints)) {
        const res = await authFetch(apiUrl(url));
        if (!res.ok) continue;

        const data = await res.json();
        switch (key) {
          case 'genders':
            setGenders(data);
            break;
          case 'shifts':
            setShifts(data);
            break;
          case 'nationalities':
            setNationalities(data);
            break;
          case 'departments':
            setDepartments(data);
            break;
          case 'billingRates':
            setBillingRates(data);
            break;
          case 'processes':
            setProcesses(data);
            break;
          case 'entryTypes':
            setEntryTypes(data);
            break;
          case 'hireTypes':
            setHireTypes(data);
            break;
          case 'buildingFloors':
            setBuildingFloors(data);
            break;
          case 'rejoinedOptions':
            setRejoinedOptions(data);
            break;
          default:
            break;
        }
      }
    }

    fetchOptions();
  }, []);

  const onSubmit = async (data) => {
    const fiveTwoOffDays = String(data.five_two_off_days_input || '')
      .split(',')
      .map((value) => Number(String(value).trim()))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

    const cleaned = {
      ...data,
      joined_imc: data.joined_imc || null,
      end_work: data.end_work || null,
      retired: data.retired || null,
      new_joined: data.new_joined || null,
      joined_fa: data.joined_fa || null,
      birth_date: data.birth_date || null,
      dispatch_start: data.dispatch_start || null,
      five_two_off_days: fiveTwoOffDays,
    };
    delete cleaned.five_two_off_days_input;

    [
      'hourly_rate',
      'total_hourly',
      'months_worked',
      'years_elapsed',
      'months_elapsed',
      'age',
    ].forEach((field) => {
      if (cleaned[field] === '') cleaned[field] = null;
      else if (cleaned[field] !== null) cleaned[field] = Number(cleaned[field]);
    });

    const ok = await createEmployee(cleaned);
    if (ok) {
      alert(t('employees.createdSuccess'));
      reset();
    } else {
      alert(t('employees.createdError'));
    }
  };

  return (
    <section className="master-panel employee-form-panel">
      <div className="master-panel-header">
        <div>
          <p className="master-eyebrow">{t('employees.newRecord')}</p>
          <h2>{t('employees.employeeData')}</h2>
        </div>
        <span className="master-required-note">{t('employees.requiredId')}</span>
      </div>

      <form className="master-form" onSubmit={handleSubmit(onSubmit)}>
        <fieldset>
          <legend>{t('employees.identification')}</legend>
          <div className="master-form-grid">
            <TextField label={t('employees.employeeId')} register={register} name="employee_id" required />
            <TextField label={t('employees.employeeCode')} register={register} name="employee_cd" />
            <TextField label={t('employees.internalName')} register={register} name="internal_name" />
            <TextField label={t('employees.nickname')} register={register} name="nickname" />
            <TextField label={t('employees.englishName')} register={register} name="name_en" />
            <TextField label={t('employees.japaneseName')} register={register} name="name_jp" />
            <TextField label={t('employees.kanaName')} register={register} name="name_kana" />
            <TextField label={t('employees.murataName')} register={register} name="name_cd" />
            <TextField label={t('employees.organization')} register={register} name="organization_name" />
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('employees.personalData')}</legend>
          <div className="master-form-grid compact">
            <TextField label={t('employees.birthDate')} register={register} name="birth_date" type="date" />
            <TextField label={t('employees.age')} register={register} name="age" type="number" />
            <SelectField label={t('employees.gender')} register={register} name="gender" placeholder={t('common.select')} options={genders} getLabel={(item) => getLocalizedLabel(item, i18n)} />
            <SelectField label={t('employees.nationality')} register={register} name="nationality" placeholder={t('common.select')} options={nationalities} getLabel={(item) => getLocalizedName(item, i18n)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('employees.companyAllocation')}</legend>
          <div className="master-form-grid">
            <TextField label={t('employees.workplaceCode')} register={register} name="workplace_cd" />
            <TextField label={t('employees.workplaceName')} register={register} name="workplace_name" />
            <TextField label={t('employees.siteCode')} register={register} name="site_cd" />
            <TextField label={t('employees.siteAbbr')} register={register} name="site_abbr" />
            <SelectField label={t('employees.department')} register={register} name="department" placeholder={t('common.select')} options={departments} getLabel={(item) => getLocalizedLabel(item, i18n)} />
            <SelectField label={t('employees.shift')} register={register} name="shift" placeholder={t('common.select')} options={shifts} getLabel={(item) => getLocalizedLabel(item, i18n)} />
            <SelectField label={t('employees.buildingFloor')} register={register} name="building_floor" placeholder={t('common.select')} options={buildingFloors} getLabel={(item) => getLocalizedLabel(item, i18n)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('employees.contract')}</legend>
          <div className="master-form-grid">
            <TextField label={t('employees.joinedImc')} register={register} name="joined_imc" type="date" />
            <TextField label={t('employees.joinedFa')} register={register} name="joined_fa" type="date" />
            <TextField label={t('employees.newJoined')} register={register} name="new_joined" type="date" />
            <TextField label={t('employees.endWork')} register={register} name="end_work" type="date" />
            <TextField label={t('employees.retired')} register={register} name="retired" type="date" />
            <TextField label={t('employees.dispatchStart')} register={register} name="dispatch_start" type="date" />
            <SelectField label={t('employees.billingRate')} register={register} name="billing_rate" placeholder={t('common.select')} options={billingRates} getLabel={(item) => getLocalizedLabel(item, i18n)} />
            <SelectField label={t('employees.entryType')} register={register} name="entry_type" placeholder={t('common.select')} options={entryTypes} getLabel={(item) => getLocalizedLabel(item, i18n)} />
            <SelectField label={t('employees.hireType')} register={register} name="hire_type" placeholder={t('common.select')} options={hireTypes} getLabel={(item) => getLocalizedLabel(item, i18n)} />
            <SelectField label={t('employees.rejoined')} register={register} name="rejoined" placeholder={t('common.select')} options={rejoinedOptions} getLabel={(item) => getLocalizedLabel(item, i18n)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('employees.financial')}</legend>
          <div className="master-form-grid compact">
            <TextField label={t('employees.hourlyRate')} register={register} name="hourly_rate" type="number" />
            <TextField label={t('employees.totalHourly')} register={register} name="total_hourly" type="number" />
            <TextField label={t('employees.monthsWorked')} register={register} name="months_worked" type="number" />
            <TextField label={t('employees.yearsElapsed')} register={register} name="years_elapsed" type="number" />
            <TextField label={t('employees.monthsElapsed')} register={register} name="months_elapsed" type="number" />
            <TextField label={t('employees.elapsedTime')} register={register} name="elapsed_str" />
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('employees.internalControl')}</legend>
          <div className="master-form-grid compact">
            <SelectField label={t('employees.process')} register={register} name="process" placeholder={t('common.select')} options={processes} getLabel={(item) => getLocalizedLabel(item, i18n)} />
            <TextField label={t('employees.ordiaNumber')} register={register} name="ordia_number" />
            <TextField label={t('employees.officeCode')} register={register} name="office_cd" />
            <TextField label={t('employees.icCard')} register={register} name="ic_card" />
            <TextField label={t('employees.imcCard')} register={register} name="imc_card" />
          </div>

          <div className="master-check-grid">
            <CheckboxField label={t('employees.activeEndMonth')} register={register} name="active_end_month" />
            <CheckboxField label={t('employees.managerFlag')} register={register} name="manager_flag" />
            <CheckboxField label={t('employees.viewFlag')} register={register} name="view_flag" />
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('employees.operationalDefaults')}</legend>
          <div className="master-form-grid compact">
            <label className="master-field">
              <span>{t('employees.operationalCategory')}</span>
              <select {...register('operational_category')}>
                <option value="normal">normal</option>
                <option value="relief">relief</option>
                <option value="trainee">trainee</option>
                <option value="trainer">trainer</option>
                <option value="kl">kl</option>
                <option value="gl">gl</option>
                <option value="supervisor">supervisor</option>
                <option value="manager">manager</option>
                <option value="staff">staff</option>
              </select>
            </label>
            <label className="master-field">
              <span>{t('employees.workPattern')}</span>
              <select {...register('work_pattern')}>
                <option value="4x2">4x2</option>
                <option value="5x2">5x2</option>
                <option value="manual">manual</option>
              </select>
            </label>
            <label className="master-field">
              <span>{t('employees.shiftType')}</span>
              <select {...register('shift_type')}>
                <option value="day">day</option>
                <option value="night">night</option>
                <option value="flexible">flexible</option>
              </select>
            </label>
            <label className="master-field">
              <span>{t('employees.rotationGroup')}</span>
              <select {...register('rotation_group')}>
                <option value="">{t('common.none')}</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <TextField label={t('employees.fiveTwoOffDays')} register={register} name="five_two_off_days_input" />
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('employees.notesSection')}</legend>
          <label className="master-field full">
            <span>{t('employees.additionalComments')}</span>
            <textarea {...register('notes')} rows={4} />
          </label>
          <label className="master-field full">
            <span>{t('employees.operationalMemo')}</span>
            <textarea {...register('operational_memo')} rows={3} />
          </label>
        </fieldset>

        <div className="master-form-actions">
          <button type="button" className="master-secondary-button" onClick={() => reset()}>
            {t('common.clear')}
          </button>
          <button type="submit" className="master-primary-button">
            {t('employees.saveEmployee')}
          </button>
        </div>
      </form>
    </section>
  );
}
