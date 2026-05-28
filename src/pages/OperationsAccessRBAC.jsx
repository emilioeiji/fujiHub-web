import { useEffect, useMemo, useState } from 'react';
import OperationsLayout from './OperationsLayout';
import { apiUrl } from '../config/api';
import { authFetch } from '../utils/authFetch';
import PermissionNotice from '../components/PermissionNotice';
import { formatApiError, forbiddenMessage, readJsonSafe, requestAccessMessage } from '../utils/apiErrors';
import { useOperationPermissions } from '../hooks/useOperationPermissions';

const EMPTY_FILTERS = { role: '', department: '', process: '', active: '' };
const EMPTY_FORM = { role: '', additional_roles: [], is_active: true, notes: '' };

function scopeParts(scope) {
  const parts = [];
  if (scope.department_code) parts.push(scope.department_code);
  if (scope.process_code) parts.push(scope.process_code);
  if (scope.shift_code) parts.push(scope.shift_code);
  if (scope.line) parts.push(`L:${scope.line}`);
  if (scope.area) parts.push(`S:${scope.area}`);
  return parts;
}

function PermissionBadge({ level }) {
  const map = {
    read: { label: 'Leitura', className: 'read' },
    write: { label: 'Edição', className: 'write' },
    none: { label: 'Sem acesso', className: 'none' },
  };
  const current = map[level] || map.none;
  return <span className={`rbac-perm-badge ${current.className}`}>{current.label}</span>;
}

function normalizeRoleCodes(metaRoles, roleIdList) {
  const roleById = new Map(metaRoles.map((r) => [String(r.id), r.code]));
  return (roleIdList || []).map((id) => roleById.get(String(id))).filter(Boolean);
}

export default function OperationsAccessRBAC() {
  const { flags } = useOperationPermissions();
  const canEdit = !!flags?.can_edit_rbac;
  const canView = !!flags?.can_view_rbac;

  const [meta, setMeta] = useState({ roles: [], departments: [], processes: [], shifts: [] });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('profile');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [scopes, setScopes] = useState([]);
  const [scopeDraft, setScopeDraft] = useState({ role: '', department: '', process: '', shift: '', line: '', area: '', notes: '' });
  const [auditRows, setAuditRows] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState(null);

  const loadMeta = async () => {
    const res = await authFetch(apiUrl('/api/operations/access-rbac/meta/'));
    if (!res.ok) return;
    setMeta(await res.json());
  };

  const loadRows = async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (filters.role) params.set('role', filters.role);
    if (filters.department) params.set('department', filters.department);
    if (filters.process) params.set('process', filters.process);
    if (filters.active) params.set('active', filters.active);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const res = await authFetch(apiUrl(`/api/operations/access-rbac/users/${suffix}`));
    const data = await readJsonSafe(res);
    if (!res.ok) {
      setError(formatApiError(data, 'Falha ao carregar acessos RBAC.'));
      setLoading(false);
      return;
    }
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const loadAudit = async (userId) => {
    setAuditLoading(true);
    const res = await authFetch(apiUrl(`/api/operations/access-rbac/audit/?user=${userId}`));
    const data = await readJsonSafe(res);
    if (!res.ok) {
      setAuditRows([]);
      setAuditLoading(false);
      return;
    }
    setAuditRows(Array.isArray(data) ? data : []);
    setAuditLoading(false);
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { if (canView) loadRows(); }, [filters.role, filters.department, filters.process, filters.active, canView]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.username,
        row.full_name,
        row.email,
        row.employee_code,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const effectivePermissions = useMemo(() => {
    if (!selected) return [];
    const roles = new Set([selected.role, ...(selected.additional_roles || [])].filter(Boolean));
    const has = (codes) => Array.from(codes).some((c) => roles.has(c));
    return [
      { label: 'Escala', level: has(new Set(['director', 'vice_director', 'hr', 'senior_manager', 'manager', 'supervisor', 'gl'])) ? 'write' : has(new Set(['kl', 'responsavel', 'viewer'])) ? 'read' : 'none' },
      { label: 'Hikitsugui', level: has(new Set(['director', 'vice_director', 'senior_manager', 'manager', 'supervisor', 'gl', 'kl'])) ? 'write' : has(new Set(['responsavel', 'viewer', 'hr'])) ? 'read' : 'none' },
      { label: 'Presença', level: has(new Set(['director', 'vice_director', 'hr', 'senior_manager', 'manager', 'supervisor', 'gl'])) ? 'write' : has(new Set(['kl', 'responsavel', 'viewer', 'dashboard_tv'])) ? 'read' : 'none' },
      { label: 'Admin notes', level: has(new Set(['director', 'vice_director', 'hr', 'manager'])) ? 'write' : has(new Set(['senior_manager', 'supervisor', 'responsavel'])) ? 'read' : 'none' },
      { label: 'Settings', level: has(new Set(['director', 'vice_director', 'hr'])) ? 'write' : has(new Set(['senior_manager', 'manager', 'responsavel'])) ? 'read' : 'none' },
      { label: 'RBAC', level: has(new Set(['director', 'vice_director', 'hr'])) ? 'write' : has(new Set(['manager', 'supervisor'])) ? 'read' : 'none' },
    ];
  }, [selected]);

  const isDirty = useMemo(() => {
    if (!initialSnapshot) return false;
    const current = JSON.stringify({ form, scopes });
    return current !== initialSnapshot;
  }, [form, scopes, initialSnapshot]);

  const openEditor = async (row) => {
    setError('');
    setMessage('');
    const res = await authFetch(apiUrl(`/api/operations/access-rbac/users/${row.user_id}/profile/`));
    const data = await readJsonSafe(res);
    if (!res.ok) {
      setError(formatApiError(data, 'Falha ao carregar perfil operacional.'));
      return;
    }

    const additionalRoleCodes = normalizeRoleCodes(meta.roles, data?.additional_roles || []);
    const selectedRow = { ...row, additional_roles: additionalRoleCodes };
    const nextForm = {
      role: data?.role || '',
      additional_roles: Array.isArray(data?.additional_roles) ? data.additional_roles : [],
      is_active: data?.is_active ?? true,
      notes: data?.notes || '',
    };
    const nextScopes = Array.isArray(data?.scopes) ? data.scopes : [];

    setSelected(selectedRow);
    setForm(nextForm);
    setScopes(nextScopes);
    setInitialSnapshot(JSON.stringify({ form: nextForm, scopes: nextScopes }));
    setDrawerTab('profile');
    setDrawerOpen(true);
    loadAudit(row.user_id);
  };

  const closeDrawer = () => {
    if (isDirty && canEdit) {
      const ok = window.confirm('Existem alterações não salvas. Deseja fechar mesmo assim?');
      if (!ok) return;
    }
    setDrawerOpen(false);
  };

  const addScope = () => {
    const scope = {
      role: scopeDraft.role || null,
      department: scopeDraft.department || null,
      process: scopeDraft.process || null,
      shift: scopeDraft.shift || null,
      line: scopeDraft.line || '',
      area: scopeDraft.area || '',
      notes: scopeDraft.notes || '',
      is_active: true,
      role_code: meta.roles.find((r) => String(r.id) === String(scopeDraft.role))?.code || null,
      department_code: meta.departments.find((d) => String(d.id) === String(scopeDraft.department))?.code || null,
      process_code: meta.processes.find((p) => String(p.id) === String(scopeDraft.process))?.code || null,
      shift_code: meta.shifts.find((s) => String(s.id) === String(scopeDraft.shift))?.code || null,
    };
    setScopes((prev) => [...prev, scope]);
    setScopeDraft({ role: '', department: '', process: '', shift: '', line: '', area: '', notes: '' });
  };

  const removeScope = (index) => setScopes((prev) => prev.filter((_, i) => i !== index));

  const saveProfile = async () => {
    if (!selected || !canEdit) return;
    setBusy(true);
    setError('');
    setMessage('');

    const profileRes = await authFetch(apiUrl(`/api/operations/access-rbac/users/${selected.user_id}/profile/`), {
      method: 'PATCH',
      body: JSON.stringify({
        role: form.role,
        additional_roles: form.additional_roles,
        is_active: form.is_active,
        notes: form.notes,
      }),
    });
    const profileData = await readJsonSafe(profileRes);
    if (!profileRes.ok) {
      setError(formatApiError(profileData, 'Falha ao salvar perfil.'));
      setBusy(false);
      return;
    }

    const scopesRes = await authFetch(apiUrl(`/api/operations/access-rbac/users/${selected.user_id}/scopes/`), {
      method: 'PUT',
      body: JSON.stringify(scopes.map((s) => ({
        role: s.role,
        department: s.department,
        process: s.process,
        shift: s.shift,
        line: s.line,
        area: s.area,
        notes: s.notes,
        is_active: true,
      }))),
    });
    const scopesData = await readJsonSafe(scopesRes);
    if (!scopesRes.ok) {
      setError(formatApiError(scopesData, 'Falha ao salvar escopos.'));
      setBusy(false);
      return;
    }

    setBusy(false);
    setMessage('Acessos RBAC atualizados com sucesso.');
    await loadRows();
    await loadAudit(selected.user_id);
    setInitialSnapshot(JSON.stringify({ form, scopes }));
  };

  if (!canView) {
    return (
      <OperationsLayout title="Acessos / RBAC" subtitle="Gestão operacional de permissões e escopos">
        <PermissionNotice title="Acesso negado" message={`${forbiddenMessage()} ${requestAccessMessage()}`} variant="blocked" />
      </OperationsLayout>
    );
  }

  return (
    <OperationsLayout title="Acessos / RBAC" subtitle="Gestão operacional de perfis, escopos e permissões efetivas">
      <section className="inventory-panel">
        <div className="operations-toolbar" style={{ marginBottom: '0.75rem' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuário, nome, email ou matrícula"
            style={{ minWidth: 280 }}
          />
          <select value={filters.role} onChange={(e) => setFilters((c) => ({ ...c, role: e.target.value }))}>
            <option value="">Todos os perfis</option>
            {meta.roles.map((role) => (<option key={role.id} value={role.code}>{role.name}</option>))}
          </select>
          <select value={filters.department} onChange={(e) => setFilters((c) => ({ ...c, department: e.target.value }))}>
            <option value="">Todos os departamentos</option>
            {meta.departments.map((item) => (<option key={item.id} value={item.id}>{item.code}</option>))}
          </select>
          <select value={filters.process} onChange={(e) => setFilters((c) => ({ ...c, process: e.target.value }))}>
            <option value="">Todos os processos</option>
            {meta.processes.map((item) => (<option key={item.id} value={item.id}>{item.code}</option>))}
          </select>
          <select value={filters.active} onChange={(e) => setFilters((c) => ({ ...c, active: e.target.value }))}>
            <option value="">Ativo/Inativo</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
          <button className="inventory-secondary-button" type="button" onClick={loadRows} disabled={loading}>Atualizar</button>
        </div>

        {message ? <p className="inventory-status">{message}</p> : null}
        {error ? <p className="inventory-status error">{error}</p> : null}

        <div className="inventory-table-wrap">
          <table className="inventory-table compact">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Nome</th>
                <th>Perfil</th>
                <th>Escopos</th>
                <th>Status</th>
                <th>Atualizado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Carregando...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={7}>Nenhum usuário encontrado para os filtros.</td></tr>
              ) : filteredRows.map((row) => (
                <tr key={row.user_id}>
                  <td>{row.username}</td>
                  <td>{row.full_name}</td>
                  <td>
                    <div className="rbac-role-block">
                      <span className="operations-badge">{row.role || '-'}</span>
                      {(row.additional_roles || []).slice(0, 2).map((role) => (
                        <span key={`${row.user_id}-${role}`} className="operations-badge muted small">{role}</span>
                      ))}
                      {(row.additional_roles || []).length > 2 ? <span className="operations-badge muted small">+{row.additional_roles.length - 2}</span> : null}
                    </div>
                  </td>
                  <td>
                    <div className="rbac-scope-badges">
                      {row.scopes?.length ? row.scopes.slice(0, 2).map((scope, idx) => (
                        <span key={`${row.user_id}-${idx}`} className="operations-badge muted small">{scopeParts(scope).join(' • ') || 'Geral'}</span>
                      )) : <span className="operations-badge muted small">Sem escopo</span>}
                      {row.scopes?.length > 2 ? <span className="operations-badge muted small">+ {row.scopes.length - 2} escopos</span> : null}
                    </div>
                  </td>
                  <td><span className={`operations-badge ${row.is_active ? 'ok' : 'warn'}`}>{row.is_active ? 'Ativo' : 'Inativo'}</span></td>
                  <td>{row.updated_at ? new Date(row.updated_at).toLocaleString('pt-BR') : '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="inventory-secondary-button"
                      onClick={() => openEditor(row)}
                      disabled={busy}
                    >
                      {canEdit ? 'Editar' : 'Visualizar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {drawerOpen && selected ? (
        <div className="operations-drawer-backdrop" onClick={closeDrawer}>
          <aside className="operations-drawer" onClick={(e) => e.stopPropagation()}>
            <header className="operations-drawer-header">
              <div>
                <h3>{selected.full_name}</h3>
                <small>{selected.username}</small>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!canEdit ? <span className="operations-badge muted">Somente leitura</span> : null}
                {isDirty && canEdit ? <span className="operations-badge warn">Não salvo</span> : null}
                <button type="button" onClick={closeDrawer}>Fechar</button>
              </div>
            </header>

            <div className="operations-drawer-tabs">
              <button type="button" className={drawerTab === 'profile' ? 'active' : ''} onClick={() => setDrawerTab('profile')}>Perfil</button>
              <button type="button" className={drawerTab === 'scopes' ? 'active' : ''} onClick={() => setDrawerTab('scopes')}>Escopos</button>
              <button type="button" className={drawerTab === 'audit' ? 'active' : ''} onClick={() => setDrawerTab('audit')}>Últimas alterações</button>
            </div>

            <div className="operations-drawer-body">
              {drawerTab === 'profile' ? (
                <>
                  <label className="inventory-field">
                    <span>Role principal</span>
                    <select value={form.role} onChange={(e) => setForm((c) => ({ ...c, role: Number(e.target.value) }))} disabled={!canEdit || busy}>
                      <option value="">Selecione</option>
                      {meta.roles.map((role) => (<option key={role.id} value={role.id}>{role.name}</option>))}
                    </select>
                  </label>

                  <label className="inventory-field">
                    <span>Roles adicionais</span>
                    <select
                      multiple
                      value={form.additional_roles.map(String)}
                      onChange={(e) => {
                        const values = Array.from(e.target.selectedOptions).map((opt) => Number(opt.value));
                        setForm((c) => ({ ...c, additional_roles: values }));
                      }}
                      disabled={!canEdit || busy}
                    >
                      {meta.roles.map((role) => (<option key={role.id} value={role.id}>{role.name}</option>))}
                    </select>
                  </label>

                  <div className="rbac-scope-badges">
                    <span className="operations-badge">{meta.roles.find((r) => String(r.id) === String(form.role))?.code || '-'}</span>
                    {normalizeRoleCodes(meta.roles, form.additional_roles).map((role) => (
                      <span key={role} className="operations-badge muted small">{role}</span>
                    ))}
                  </div>

                  <label className="inventory-field">
                    <span>Observações internas</span>
                    <textarea value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} disabled={!canEdit || busy} />
                  </label>

                  <label className="inventory-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((c) => ({ ...c, is_active: e.target.checked }))} disabled={!canEdit || busy} />
                    <span>Perfil operacional ativo</span>
                  </label>

                  <h4>Permissões efetivas</h4>
                  <div className="rbac-perm-grid">
                    {effectivePermissions.map((item) => (
                      <div key={item.label} className="rbac-perm-card">
                        <small>{item.label}</small>
                        <PermissionBadge level={item.level} />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {drawerTab === 'scopes' ? (
                <>
                  {canEdit ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.5rem' }}>
                      <select value={scopeDraft.department} onChange={(e) => setScopeDraft((c) => ({ ...c, department: e.target.value }))} disabled={busy}>
                        <option value="">Departamento</option>
                        {meta.departments.map((item) => (<option key={item.id} value={item.id}>{item.code}</option>))}
                      </select>
                      <select value={scopeDraft.process} onChange={(e) => setScopeDraft((c) => ({ ...c, process: e.target.value }))} disabled={busy}>
                        <option value="">Processo</option>
                        {meta.processes.map((item) => (<option key={item.id} value={item.id}>{item.code}</option>))}
                      </select>
                      <select value={scopeDraft.shift} onChange={(e) => setScopeDraft((c) => ({ ...c, shift: e.target.value }))} disabled={busy}>
                        <option value="">Turno</option>
                        {meta.shifts.map((item) => (<option key={item.id} value={item.id}>{item.code}</option>))}
                      </select>
                      <input placeholder="Linha" value={scopeDraft.line} onChange={(e) => setScopeDraft((c) => ({ ...c, line: e.target.value }))} disabled={busy} />
                      <input placeholder="Setor" value={scopeDraft.area} onChange={(e) => setScopeDraft((c) => ({ ...c, area: e.target.value }))} disabled={busy} />
                      <button type="button" className="inventory-secondary-button" onClick={addScope} disabled={busy}>Adicionar escopo</button>
                    </div>
                  ) : null}

                  <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.5rem' }}>
                    {scopes.length === 0 ? <small>Nenhum escopo definido.</small> : scopes.map((scope, idx) => (
                      <div key={`scope-${idx}`} className="rbac-scope-row">
                        <div className="rbac-scope-badges">
                          {scopeParts(scope).map((part, pidx) => (
                            <span key={`${idx}-${pidx}`} className="operations-badge muted small">{part}</span>
                          ))}
                          {scopeParts(scope).length === 0 ? <span className="operations-badge muted small">Geral</span> : null}
                        </div>
                        {canEdit ? <button type="button" className="inventory-secondary-button" onClick={() => removeScope(idx)} disabled={busy}>Remover</button> : null}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {drawerTab === 'audit' ? (
                <div className="rbac-audit-list">
                  {auditLoading ? <small>Carregando auditoria...</small> : null}
                  {!auditLoading && auditRows.length === 0 ? <small>Nenhuma alteração registrada.</small> : null}
                  {auditRows.map((row) => (
                    <article key={row.id} className="rbac-audit-item">
                      <div>
                        <strong>{new Date(row.created_at).toLocaleString('pt-BR')}</strong>
                        <small>{row.actor_username || '-'}</small>
                      </div>
                      <div>
                        <span className="operations-badge muted small">{row.action}</span>
                        <p>{row.action === 'profile_updated' ? 'Perfil alterado' : row.action === 'scopes_replaced' ? 'Escopos atualizados' : 'Alteração de acesso'}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>

            <footer className="operations-drawer-footer">
              <button type="button" className="inventory-secondary-button" onClick={closeDrawer} disabled={busy}>Cancelar</button>
              {canEdit ? (
                <button type="button" className="inventory-primary-button" onClick={saveProfile} disabled={busy || !isDirty}>
                  {busy ? 'Salvando...' : 'Salvar'}
                </button>
              ) : null}
            </footer>
          </aside>
        </div>
      ) : null}
    </OperationsLayout>
  );
}
