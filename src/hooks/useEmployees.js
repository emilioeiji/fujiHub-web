import { useEffect, useState } from 'react';
import { authFetchJson } from '../utils/authFetch';
import { apiUrl } from '../config/api';

const API_URL = apiUrl('/api/employees/');

export function useEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const listEmployees = async () => {
    setLoading(true);
    const { ok, data } = await authFetchJson(API_URL);
    if (ok) setEmployees(data);
    setLoading(false);
  };

  const createEmployee = async (employee) => {
    const { ok, data } = await authFetchJson(API_URL, {
      method: 'POST',
      body: JSON.stringify(employee),
    });
    if (ok) {
      setEmployees((prev) => [...prev, data]);
    }
    return ok;
  };

  const updateEmployee = async (id, employee) => {
    const { ok, data } = await authFetchJson(`${API_URL}${id}/`, {
      method: 'PUT',
      body: JSON.stringify(employee),
    });
    if (ok) {
      setEmployees((prev) => prev.map((e) => (e.employee_id === id ? data : e)));
    }
    return ok;
  };

  const deleteEmployee = async (id) => {
    const { ok } = await authFetchJson(`${API_URL}${id}/`, {
      method: 'DELETE',
    });
    if (ok) {
      setEmployees((prev) => prev.filter((e) => e.employee_id !== id));
    }
    return ok;
  };

  useEffect(() => {
    listEmployees();
  }, []);

  return { employees, loading, listEmployees, createEmployee, updateEmployee, deleteEmployee };
}
