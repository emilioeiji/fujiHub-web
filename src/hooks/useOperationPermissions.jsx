import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../config/api';
import { authFetch } from '../utils/authFetch';

const DEFAULT_FLAGS = {
  can_view_schedule: false,
  can_edit_schedule: false,
  can_import_employees: false,
  can_sync_assignments: false,
  can_manage_templates: false,
  can_view_hikitsugui: false,
  can_edit_hikitsugui: false,
  can_view_attendance_dashboard: false,
  can_view_employee_detail: false,
  can_view_admin_notes: false,
  can_create_admin_notes: false,
  can_edit_operations_settings: false,
  can_export_attendance: false,
  can_import_timecard: false,
  can_view_dashboard_tv: false,
  can_view_rbac: false,
  can_edit_rbac: false,
};

const DEFAULT_VALUE = {
  loading: true,
  role: null,
  roles: [],
  scopes: [],
  flags: DEFAULT_FLAGS,
  refresh: async () => {},
};

const OperationPermissionsContext = createContext(DEFAULT_VALUE);

export function OperationPermissionsProvider({ children }) {
  const [state, setState] = useState(DEFAULT_VALUE);

  const load = async () => {
    const token = localStorage.getItem('access');
    if (!token) {
      setState({ ...DEFAULT_VALUE, loading: false });
      return;
    }

    const res = await authFetch(apiUrl('/api/operations/me/permissions/'));
    if (!res.ok) {
      setState((current) => ({ ...current, loading: false }));
      return;
    }

    const data = await res.json();
    setState({
      loading: false,
      role: data?.role || null,
      roles: Array.isArray(data?.roles) ? data.roles : [],
      scopes: Array.isArray(data?.scopes) ? data.scopes : [],
      flags: { ...DEFAULT_FLAGS, ...(data?.flags || {}) },
      refresh: load,
    });
  };

  useEffect(() => {
    load();
  }, []);

  const value = useMemo(() => ({ ...state, refresh: load }), [state]);

  return <OperationPermissionsContext.Provider value={value}>{children}</OperationPermissionsContext.Provider>;
}

export function useOperationPermissions() {
  return useContext(OperationPermissionsContext);
}
