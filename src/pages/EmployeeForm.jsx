import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useEmployees } from '../hooks/useEmployees';
import './EmployeeForm.css';

export default function EmployeeForm() {
  const { register, handleSubmit, reset } = useForm();
  const { createEmployee } = useEmployees();

  // Estados para tabelas auxiliares
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

  // Carregar opções da API
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
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access')}` },
        });
        if (res.ok) {
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
    }
    fetchOptions();
  }, []);

  const onSubmit = async (data) => {
    // Converte strings vazias em null para datas
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

    // Converte strings vazias em null para números opcionais
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
    <div className="fuji-form-container">
      <h1>📇 Cadastro de Funcionário</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <fieldset>
          <legend>Identificação</legend>
          <input {...register('employee_id')} placeholder="ID do Funcionário" required />
          <input {...register('employee_cd')} placeholder="Código do Funcionário" />
          <input {...register('internal_name')} placeholder="Nome Interno" />
          <input {...register('name_en')} placeholder="Nome (EN)" />
          <input {...register('name_jp')} placeholder="Nome (JP)" />
          <input {...register('name_kana')} placeholder="Nome (Kana)" />
          <input {...register('name_cd')} placeholder="Nome CD (Murata)" />
        </fieldset>

        <fieldset>
          <legend>Dados Pessoais</legend>
          <input type="date" {...register('birth_date')} />
          <input type="number" {...register('age')} placeholder="Idade" />
          <select {...register('gender')}>
            <option value="">Selecione o gênero</option>
            {genders.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label_pt}
              </option>
            ))}
          </select>
          <select {...register('nationality')}>
            <option value="">Selecione a nacionalidade</option>
            {nationalities.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name_pt}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend>Empresa</legend>
          <input {...register('workplace_cd')} placeholder="Código do Local" />
          <input {...register('workplace_name')} placeholder="Nome do Local" />
          <input {...register('site_cd')} placeholder="Código do Site" />
          <input {...register('site_abbr')} placeholder="Abreviação do Site" />
          <select {...register('department')}>
            <option value="">Selecione o departamento</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label_pt}
              </option>
            ))}
          </select>
          <select {...register('shift')}>
            <option value="">Selecione o turno</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label_pt}
              </option>
            ))}
          </select>
          <select {...register('building_floor')}>
            <option value="">Selecione o prédio/andar</option>
            {buildingFloors.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label_pt}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend>Contrato</legend>
          <input type="date" {...register('joined_imc')} placeholder="Entrada IMC" />
          <input type="date" {...register('joined_fa')} placeholder="Entrada FA" />
          <input type="date" {...register('new_joined')} placeholder="Nova Entrada" />
          <input type="date" {...register('end_work')} placeholder="Fim do Trabalho" />
          <input type="date" {...register('retired')} placeholder="Data de Saída" />
          <input type="date" {...register('dispatch_start')} placeholder="Início da Alocação" />
          <select {...register('billing_rate')}>
            <option value="">Selecione a taxa de cobrança</option>
            {billingRates.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label_pt}
              </option>
            ))}
          </select>
          <select {...register('entry_type')}>
            <option value="">Selecione o tipo de entrada</option>
            {entryTypes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label_pt}
              </option>
            ))}
          </select>
          <select {...register('hire_type')}>
            <option value="">Selecione o tipo de contratação</option>
            {hireTypes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label_pt}
              </option>
            ))}
          </select>
          <select {...register('rejoined')}>
            <option value="">Reentrada?</option>
            {rejoinedOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label_pt}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset>
          <legend>Financeiro</legend>
          <input type="number" {...register('hourly_rate')} placeholder="Taxa Horária" />
          <input type="number" {...register('total_hourly')} placeholder="Total Hora" />
          <input type="number" {...register('months_worked')} placeholder="Meses Trabalhados" />
          <input type="number" {...register('years_elapsed')} placeholder="Anos Decorridos" />
          <input type="number" {...register('months_elapsed')} placeholder="Meses Decorridos" />
          <input {...register('elapsed_str')} placeholder="Tempo Decorrido (texto)" />
        </fieldset>

        <fieldset>
          <legend>Outros</legend>
          <select {...register('process')}>
            <option value="">Selecione o processo</option>
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label_pt}
              </option>
            ))}
          </select>
          <input {...register('ordia_number')} placeholder="Número ORDIA" />
          <input {...register('office_cd')} placeholder="Código do Escritório" />
          <input {...register('ic_card')} placeholder="Cartão IC" />
          <input {...register('imc_card')} placeholder="Cartão IMC" />
          <label>
            <input type="checkbox" {...register('active_end_month')} /> Ativo no fim do mês
          </label>
          <label>
            <input type="checkbox" {...register('manager_flag')} /> É gestor
          </label>
          <label>
            <input type="checkbox" {...register('view_flag')} /> Pode visualizar
          </label>
        </fieldset>

        <fieldset>
          <legend>Notas e Observações</legend>
          <textarea {...register('notes')} rows={3} placeholder="Comentários adicionais" />
        </fieldset>

        <button type="submit">Salvar</button>
      </form>
    </div>
  );
}
