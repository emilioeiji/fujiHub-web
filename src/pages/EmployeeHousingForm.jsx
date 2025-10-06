import { useForm } from 'react-hook-form';
import { useEmployees } from '../hooks/useEmployees'; // hook para listar funcionários
import './EmployeeHousingForm.css';

export default function EmployeeHousingForm() {
  const { register, handleSubmit, reset } = useForm();
  const { employees } = useEmployees(); // lista de funcionários para o select

  // Função de criação embutida no componente
  const createHousing = async (data) => {
    try {
      const res = await fetch('/api/employees/housing/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access')}`,
        },
        body: JSON.stringify(data),
      });
      return res.ok;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const onSubmit = async (data) => {
    // Limpeza: "" -> null, números convertidos
    const cleaned = {
      ...data,
      employee: Number(data.employee), // id do funcionário
      rent: data.rent === '' ? null : Number(data.rent),
      monthly_payment: data.monthly_payment === '' ? null : Number(data.monthly_payment),
      management_fee: data.management_fee === '' ? null : Number(data.management_fee),
      parking_fee: data.parking_fee === '' ? null : Number(data.parking_fee),
      move_in_date: data.move_in_date || null,
      move_out_date: data.move_out_date || null,
    };

    const ok = await createHousing(cleaned);
    if (ok) {
      alert('Registro de moradia cadastrado com sucesso!');
      reset();
    } else {
      alert('Erro ao cadastrar registro de moradia.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form">
      <h2>Cadastro de Moradia</h2>

      <label>Funcionário</label>
      <select {...register('employee')} required>
        <option value="">Selecione</option>
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.employee_id} - {emp.name_en}
          </option>
        ))}
      </select>

      <label>Apartamento</label>
      <input {...register('apartment_name')} />

      <label>Número do Quarto</label>
      <input {...register('room_number')} />

      <label>Aluguel</label>
      <input type="number" {...register('rent')} />

      <label>Pagamento Mensal</label>
      <input type="number" {...register('monthly_payment')} />

      <label>Taxa de Administração</label>
      <input type="number" {...register('management_fee')} />

      <label>Estacionamento</label>
      <input type="number" {...register('parking_fee')} />

      <label>Data de Entrada</label>
      <input type="date" {...register('move_in_date')} />

      <label>Data de Saída</label>
      <input type="date" {...register('move_out_date')} />

      <label>Telefone</label>
      <input {...register('phone_number')} />

      <label>CEP</label>
      <input {...register('postal_code')} />

      <label>Endereço</label>
      <input {...register('address')} />

      <label>Ponto de Ônibus</label>
      <input {...register('bus_stop')} />

      <label>Número do Ônibus</label>
      <input {...register('bus_number')} />

      <button type="submit">Salvar</button>
    </form>
  );
}
