import { useEffect, useState } from 'react';
import { authFetchJson } from '../utils/authFetch';
import { apiUrl } from '../config/api';

const API_URL = apiUrl('/api/employees/');

export function useEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null,
    page: 1,
    page_size: 25,
  });

  const listEmployees = async (filters = {}) => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params.set(key, String(value));
      }
    });
    const url = params.toString() ? `${API_URL}?${params.toString()}` : API_URL;
    const { ok, data } = await authFetchJson(url);
    if (ok) {
      const results = Array.isArray(data) ? data : data?.results || [];
      setEmployees(results);
      if (!Array.isArray(data) && data) {
        setPagination((current) => ({
          ...current,
          count: Number(data.count || 0),
          next: data.next || null,
          previous: data.previous || null,
          page: Number(filters.page || current.page || 1),
          page_size: Number(filters.page_size || current.page_size || 25),
        }));
      } else {
        setPagination((current) => ({
          ...current,
          count: results.length,
          next: null,
          previous: null,
        }));
      }
    }
    setLoading(false);
    return ok;
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
      method: 'PATCH',
      body: JSON.stringify(employee),
    });
    if (ok) {
      setEmployees((prev) => prev.map((e) => (e.employee_id === id ? data : e)));
    }
    return ok;
  };

  const deleteEmployee = async (id) => {
    const { ok, data } = await authFetchJson(`${API_URL}${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        active_end_month: false,
      }),
    });
    if (ok) {
      setEmployees((prev) => prev.map((e) => (e.employee_id === id ? data : e)));
    }
    return ok;
  };

  useEffect(() => {
    listEmployees();
  }, []);

  return { employees, loading, pagination, listEmployees, createEmployee, updateEmployee, deleteEmployee };
}
