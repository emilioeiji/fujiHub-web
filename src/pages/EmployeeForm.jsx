import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useEmployees } from '../hooks/useEmployees';
import { authFetch } from '../utils/authFetch';
import './EmployeeForm.css';

const API_BASE_URL = 'http://127.0.0.1:8000';

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
        const res = await authFetch(`${API_BASE_URL}${url}`);
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
    const cleaned = {
      ...data,
      joined_imc: data.joined_imc || null,
      end_work: data.end_work || null,
      retired: data.retired || null,
      new_joined: data.new_joined || null,
      joined_fa: data.joined_fa || null,
      birth_date: data.birth_date || null,
      dispatch_start: data.dispatch_start || null,
    };

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
      alert('Funcionário cadastrado com sucesso!');
      reset();
    } else {
      alert('Erro ao cadastrar funcionário.');
    }
  };

  return (
    <section className="master-panel employee-form-panel">
      <div className="master-panel-header">
        <div>
          <p className="master-eyebrow">Novo registro</p>
          <h2>Dados do funcionário</h2>
        </div>
        <span className="master-required-note">ID obrigatório</span>
      </div>

      <form className="master-form" onSubmit={handleSubmit(onSubmit)}>
        <fieldset>
          <legend>Identificação</legend>
          <div className="master-form-grid">
            <TextField label="ID do funcionário" register={register} name="employee_id" required />
            <TextField label="Código do funcionário" register={register} name="employee_cd" />
            <TextField label="Nome interno" register={register} name="internal_name" />
            <TextField label="Nome em inglês" register={register} name="name_en" />
            <TextField label="Nome em japonês" register={register} name="name_jp" />
            <TextField label="Nome kana" register={register} name="name_kana" />
            <TextField label="Nome CD Murata" register={register} name="name_cd" />
          </div>
        </fieldset>

        <fieldset>
          <legend>Dados pessoais</legend>
          <div className="master-form-grid compact">
            <TextField label="Data de nascimento" register={register} name="birth_date" type="date" />
            <TextField label="Idade" register={register} name="age" type="number" />
            <SelectField label="Gênero" register={register} name="gender" placeholder="Selecione" options={genders} getLabel={(item) => item.label_pt} />
            <SelectField label="Nacionalidade" register={register} name="nationality" placeholder="Selecione" options={nationalities} getLabel={(item) => item.name_pt} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Empresa e alocação</legend>
          <div className="master-form-grid">
            <TextField label="Código do local" register={register} name="workplace_cd" />
            <TextField label="Nome do local" register={register} name="workplace_name" />
            <TextField label="Código do site" register={register} name="site_cd" />
            <TextField label="Abreviação do site" register={register} name="site_abbr" />
            <SelectField label="Departamento" register={register} name="department" placeholder="Selecione" options={departments} getLabel={(item) => item.label_pt} />
            <SelectField label="Turno" register={register} name="shift" placeholder="Selecione" options={shifts} getLabel={(item) => item.label_pt} />
            <SelectField label="Prédio/andar" register={register} name="building_floor" placeholder="Selecione" options={buildingFloors} getLabel={(item) => item.label_pt} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Contrato</legend>
          <div className="master-form-grid">
            <TextField label="Entrada IMC" register={register} name="joined_imc" type="date" />
            <TextField label="Entrada FA" register={register} name="joined_fa" type="date" />
            <TextField label="Nova entrada" register={register} name="new_joined" type="date" />
            <TextField label="Fim do trabalho" register={register} name="end_work" type="date" />
            <TextField label="Data de saída" register={register} name="retired" type="date" />
            <TextField label="Início da alocação" register={register} name="dispatch_start" type="date" />
            <SelectField label="Taxa de cobrança" register={register} name="billing_rate" placeholder="Selecione" options={billingRates} getLabel={(item) => item.label_pt} />
            <SelectField label="Tipo de entrada" register={register} name="entry_type" placeholder="Selecione" options={entryTypes} getLabel={(item) => item.label_pt} />
            <SelectField label="Tipo de contratação" register={register} name="hire_type" placeholder="Selecione" options={hireTypes} getLabel={(item) => item.label_pt} />
            <SelectField label="Reentrada" register={register} name="rejoined" placeholder="Selecione" options={rejoinedOptions} getLabel={(item) => item.label_pt} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Financeiro</legend>
          <div className="master-form-grid compact">
            <TextField label="Taxa horária" register={register} name="hourly_rate" type="number" />
            <TextField label="Total hora" register={register} name="total_hourly" type="number" />
            <TextField label="Meses trabalhados" register={register} name="months_worked" type="number" />
            <TextField label="Anos decorridos" register={register} name="years_elapsed" type="number" />
            <TextField label="Meses decorridos" register={register} name="months_elapsed" type="number" />
            <TextField label="Tempo decorrido" register={register} name="elapsed_str" />
          </div>
        </fieldset>

        <fieldset>
          <legend>Controle interno</legend>
          <div className="master-form-grid compact">
            <SelectField label="Processo" register={register} name="process" placeholder="Selecione" options={processes} getLabel={(item) => item.label_pt} />
            <TextField label="Número ORDIA" register={register} name="ordia_number" />
            <TextField label="Código do escritório" register={register} name="office_cd" />
            <TextField label="Cartão IC" register={register} name="ic_card" />
            <TextField label="Cartão IMC" register={register} name="imc_card" />
          </div>

          <div className="master-check-grid">
            <CheckboxField label="Ativo no fim do mês" register={register} name="active_end_month" />
            <CheckboxField label="É gestor" register={register} name="manager_flag" />
            <CheckboxField label="Pode visualizar" register={register} name="view_flag" />
          </div>
        </fieldset>

        <fieldset>
          <legend>Notas e observações</legend>
          <label className="master-field full">
            <span>Comentários adicionais</span>
            <textarea {...register('notes')} rows={4} />
          </label>
        </fieldset>

        <div className="master-form-actions">
          <button type="button" className="master-secondary-button" onClick={() => reset()}>
            Limpar
          </button>
          <button type="submit" className="master-primary-button">
            Salvar funcionário
          </button>
        </div>
      </form>
    </section>
  );
}
