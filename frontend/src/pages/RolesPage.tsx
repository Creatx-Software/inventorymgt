import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck, Lock, Plus, Trash2, Save, Loader2, AlertCircle, CheckCircle2, X,
} from 'lucide-react';
import { rolesApi } from '../api/rbac';
import { useAuth } from '../contexts/AuthContext';

interface Role {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  permission_count: number;
  permissions?: string[];
}

type Action = 'view' | 'create' | 'edit' | 'delete';

interface PermCategory {
  label: string;
  resource: string;
  actions: Action[];
}

const PERM_CATEGORIES: PermCategory[] = [
  { label: 'Dashboard',        resource: 'dashboard',       actions: ['view'] },
  { label: 'Endpoints',        resource: 'endpoints',       actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Monitors',         resource: 'monitors',        actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Mobile Devices',   resource: 'mobile_devices',  actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'IP Phones',        resource: 'ip_phones',       actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Servers',          resource: 'servers',         actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Printers',         resource: 'printers',        actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Network Devices',  resource: 'network_devices', actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Other Assets',     resource: 'other_assets',    actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Incidents',        resource: 'incidents',       actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Employees',        resource: 'employees',       actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Departments',      resource: 'departments',     actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Locations',        resource: 'locations',       actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Vendors',          resource: 'vendors',         actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Consumable Stock', resource: 'consumables',     actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Notes',           resource: 'notes',            actions: ['view', 'create', 'delete'] as Action[] },
  { label: 'Activities',      resource: 'activities',       actions: ['view', 'create', 'edit', 'delete'] },
  { label: 'Audit Logs',       resource: 'audit_logs',      actions: ['view'] },
  {
    label: 'User Management',
    resource: 'users',
    actions: ['view' as Action],
    // special keys users_manage and roles_manage handled separately
  },
];

// Special permissions outside the matrix
const SPECIAL_PERMISSIONS = [
  { key: 'users_manage', label: 'Manage Users (create/edit/deactivate)' },
  { key: 'roles_manage', label: 'Manage Roles (create/edit/delete)' },
];

function permKey(resource: string, action: Action): string {
  return `${resource}_${action}`;
}

interface NewRoleForm {
  name: string;
  description: string;
}

export default function RolesPage() {
  const { isSuperAdmin } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState<NewRoleForm>({ name: '', description: '' });
  const [creatingRole, setCreatingRole] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Superadmin can edit any role except the superadmin role itself.
  // Non-superadmin users can only edit custom (non-system) roles.
  const isReadOnly = selectedRole
    ? (isSuperAdmin() ? selectedRole.name === 'superadmin' : selectedRole.is_system)
    : true;

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const res = await rolesApi.list();
      setRoles(res.data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load roles' });
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // All permission keys that exist in the matrix + special permissions
  const ALL_PERMISSION_KEYS = new Set<string>([
    ...PERM_CATEGORIES.flatMap((c) => c.actions.map((a) => `${c.resource}_${a}`)),
    ...SPECIAL_PERMISSIONS.map((sp) => sp.key),
  ]);

  const selectRole = async (role: Role) => {
    setSelectedRole(role);
    setLoadingPerms(true);
    try {
      const res = await rolesApi.get(role.id);
      // Superadmin bypasses all permission checks — always show every box ticked
      if (role.name === 'superadmin') {
        setSelectedPermissions(new Set(ALL_PERMISSION_KEYS));
      } else {
        setSelectedPermissions(new Set(res.data.permissions as string[]));
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load role permissions' });
    } finally {
      setLoadingPerms(false);
    }
  };

  const togglePermission = (key: string) => {
    if (isReadOnly) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAllForCategory = (category: PermCategory) => {
    if (isReadOnly) return;
    const keys = category.actions.map((a) => permKey(category.resource, a));
    const allChecked = keys.every((k) => selectedPermissions.has(k));
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        keys.forEach((k) => next.delete(k));
      } else {
        keys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedRole || isReadOnly) return;
    setSaving(true);
    try {
      await rolesApi.setPermissions(selectedRole.id, Array.from(selectedPermissions));
      setMessage({ type: 'success', text: `Permissions saved for "${selectedRole.name}"` });
      loadRoles();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save permissions' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole || selectedRole.is_system) return;
    if (!window.confirm(`Delete role "${selectedRole.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await rolesApi.delete(selectedRole.id);
      setMessage({ type: 'success', text: `Role "${selectedRole.name}" deleted` });
      setSelectedRole(null);
      setSelectedPermissions(new Set());
      loadRoles();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete role' });
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newRoleForm.name.trim()) {
      setCreateError('Role name is required');
      return;
    }
    setCreatingRole(true);
    try {
      const res = await rolesApi.create({
        name: newRoleForm.name.trim(),
        description: newRoleForm.description.trim() || null,
        permissions: [],
      });
      setShowNewRoleForm(false);
      setNewRoleForm({ name: '', description: '' });
      await loadRoles();
      // Auto-select the newly created role
      selectRole(res.data);
      setMessage({ type: 'success', text: `Role "${res.data.name}" created` });
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create role');
    } finally {
      setCreatingRole(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Roles &amp; Permissions</h1>
        <p className="text-sm text-slate-500 mt-1">Manage roles and the permissions assigned to them</p>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex gap-6 items-start">
        {/* Left panel — role list */}
        <div className="w-64 shrink-0 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Roles</span>
            <button
              onClick={() => { setShowNewRoleForm((v) => !v); setCreateError(null); }}
              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              New Role
            </button>
          </div>

          {showNewRoleForm && (
            <form onSubmit={handleCreateRole} className="card p-3 space-y-2 mb-3">
              <input
                type="text"
                className="input text-sm py-1.5"
                placeholder="Role name"
                value={newRoleForm.name}
                onChange={(e) => setNewRoleForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
              <input
                type="text"
                className="input text-sm py-1.5"
                placeholder="Description (optional)"
                value={newRoleForm.description}
                onChange={(e) => setNewRoleForm((f) => ({ ...f, description: e.target.value }))}
              />
              {createError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {createError}
                </p>
              )}
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-xs py-1 flex-1" disabled={creatingRole}>
                  {creatingRole && <Loader2 className="w-3 h-3 animate-spin" />}
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewRoleForm(false); setCreateError(null); }}
                  className="btn-ghost text-xs py-1 flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loadingRoles ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            roles.map((role) => (
              <button
                key={role.id}
                onClick={() => selectRole(role)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  selectedRole?.id === role.id
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {role.is_system ? (
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                )}
                <span className="flex-1 capitalize">{role.name}</span>
                <span className="text-[11px] text-slate-400">{role.permission_count}</span>
              </button>
            ))
          )}
        </div>

        {/* Right panel — permission matrix */}
        <div className="flex-1 min-w-0">
          {!selectedRole ? (
            <div className="card flex items-center justify-center py-20 text-slate-400">
              <div className="text-center">
                <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a role to view its permissions</p>
              </div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {/* Role header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  {selectedRole.is_system ? (
                    <Lock className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  )}
                  <div>
                    <div className="font-semibold text-slate-900 capitalize">{selectedRole.name}</div>
                    {selectedRole.description && (
                      <div className="text-xs text-slate-500">{selectedRole.description}</div>
                    )}
                  </div>
                  {isReadOnly && (
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 rounded-full uppercase tracking-wider">
                      System — read only
                    </span>
                  )}
                </div>
                {!isReadOnly && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeleteRole}
                      disabled={deleting}
                      className="btn-ghost text-sm text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-1.5"
                    >
                      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete Role
                    </button>
                    <button
                      onClick={handleSavePermissions}
                      disabled={saving}
                      className="btn-primary text-sm flex items-center gap-1.5"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Permissions
                    </button>
                  </div>
                )}
              </div>

              {/* Matrix */}
              {loadingPerms ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading permissions...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-56">
                          Resource
                        </th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                          View
                        </th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                          Create
                        </th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                          Edit
                        </th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                          Delete
                        </th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">
                          All
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {PERM_CATEGORIES.filter((c) => c.resource !== 'users').map((category) => {
                        const allKeys = category.actions.map((a) => permKey(category.resource, a));
                        const allChecked = allKeys.length > 0 && allKeys.every((k) => selectedPermissions.has(k));
                        const someChecked = allKeys.some((k) => selectedPermissions.has(k));

                        return (
                          <tr key={category.resource} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-slate-700">{category.label}</td>
                            {(['view', 'create', 'edit', 'delete'] as Action[]).map((action) => {
                              const hasAction = category.actions.includes(action);
                              const key = permKey(category.resource, action);
                              const checked = selectedPermissions.has(key);
                              return (
                                <td key={action} className="text-center px-4 py-2.5">
                                  {hasAction ? (
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => togglePermission(key)}
                                      disabled={isReadOnly}
                                      className="w-4 h-4 rounded text-brand-600 border-slate-300 cursor-pointer disabled:cursor-default disabled:opacity-60"
                                    />
                                  ) : (
                                    <span className="text-slate-200 text-lg leading-none">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="text-center px-4 py-2.5">
                              {allKeys.length > 1 ? (
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  ref={(el) => {
                                    if (el) el.indeterminate = !allChecked && someChecked;
                                  }}
                                  onChange={() => toggleAllForCategory(category)}
                                  disabled={isReadOnly}
                                  className="w-4 h-4 rounded text-brand-600 border-slate-300 cursor-pointer disabled:cursor-default disabled:opacity-60"
                                />
                              ) : (
                                <span className="text-slate-200 text-lg leading-none">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Separator for special permissions */}
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-t border-b border-slate-200"
                        >
                          Administrative Permissions
                        </td>
                      </tr>
                      {SPECIAL_PERMISSIONS.map((sp) => (
                        <tr key={sp.key} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-slate-700" colSpan={1}>
                            {sp.label}
                          </td>
                          <td className="text-center px-4 py-2.5" colSpan={4}>
                            <input
                              type="checkbox"
                              checked={selectedPermissions.has(sp.key)}
                              onChange={() => togglePermission(sp.key)}
                              disabled={isReadOnly}
                              className="w-4 h-4 rounded text-brand-600 border-slate-300 cursor-pointer disabled:cursor-default disabled:opacity-60"
                            />
                          </td>
                          <td />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
