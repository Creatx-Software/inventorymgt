import { useCallback, useEffect, useState } from 'react';
import { UserCog, Plus, Pencil, Power, Loader2, AlertCircle, CheckCircle2, X, Eye, EyeOff } from 'lucide-react';
import { usersApi, rolesApi } from '../api/rbac';
import { useAuth } from '../contexts/AuthContext';

interface UserRow {
  id: number;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
  role_id: number | null;
  role_name: string | null;
}

interface Role {
  id: number;
  name: string;
  is_system: boolean;
}

interface UserForm {
  username: string;
  email: string;
  full_name: string;
  password: string;
  role_id: string;
  is_active: boolean;
}

const EMPTY_FORM: UserForm = {
  username: '',
  email: '',
  full_name: '',
  password: '',
  role_id: '',
  is_active: true,
};

function roleBadge(roleName: string | null) {
  if (!roleName) {
    return (
      <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-slate-50 text-slate-500 border-slate-200">
        No Role
      </span>
    );
  }
  const styles: Record<string, string> = {
    superadmin: 'bg-purple-50 text-purple-700 border-purple-200',
    admin: 'bg-blue-50 text-blue-700 border-blue-200',
    user: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  const cls = styles[roleName] ?? 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return (
    <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full border capitalize ${cls}`}>
      {roleName}
    </span>
  );
}

export default function UsersPage() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([usersApi.list(), rolesApi.list()]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowPassword(false);
    setDrawerOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setForm({
      username: u.username,
      email: u.email,
      full_name: u.full_name,
      password: '',
      role_id: u.role_id !== null ? String(u.role_id) : '',
      is_active: u.is_active,
    });
    setFormError(null);
    setShowPassword(false);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingUser(null);
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.full_name.trim() || !form.username.trim() || !form.email.trim()) {
      setFormError('Full name, username, and email are required');
      return;
    }
    if (!editingUser && !form.password) {
      setFormError('Password is required for new users');
      return;
    }

    // Prevent demoting self
    if (editingUser && editingUser.id === currentUser?.id) {
      const chosenRole = roles.find((r) => r.id === Number(form.role_id));
      if (chosenRole && chosenRole.name !== currentUser?.role) {
        setFormError('You cannot change your own role');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim(),
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        role_id: form.role_id ? Number(form.role_id) : null,
        is_active: form.is_active,
      };
      if (form.password) payload.password = form.password;

      if (editingUser) {
        await usersApi.update(editingUser.id, payload);
        setMessage({ type: 'success', text: 'User updated successfully' });
      } else {
        await usersApi.create(payload);
        setMessage({ type: 'success', text: 'User created successfully' });
      }
      closeDrawer();
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: UserRow) => {
    if (u.id === currentUser?.id) {
      setMessage({ type: 'error', text: 'You cannot deactivate your own account' });
      return;
    }
    try {
      await usersApi.toggleActive(u.id);
      setMessage({
        type: 'success',
        text: `${u.full_name} has been ${u.is_active ? 'deactivated' : 'activated'}`,
      });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to toggle user status' });
    }
  };

  // Available roles in dropdown — non-superadmin cannot assign superadmin role
  const availableRoles = roles.filter((r) => {
    if (isSuperAdmin()) return true;
    return r.name !== 'superadmin';
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">Manage application users and their roles</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New User
        </button>
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

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading users...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Login</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {u.full_name}
                    {u.id === currentUser?.id && (
                      <span className="ml-2 text-[10px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-1.5 py-0.5">
                        You
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.username}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">{roleBadge(u.role_name)}</td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[11px] font-medium rounded-full border bg-slate-50 text-slate-500 border-slate-200">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleString('en-GB')
                      : <span className="text-slate-300">Never</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Edit user"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={u.id === currentUser?.id}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.id === currentUser?.id
                            ? 'text-slate-200 cursor-not-allowed'
                            : u.is_active
                            ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={u.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <UserCog className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/30" onClick={closeDrawer} />
          {/* Panel */}
          <div className="w-[480px] bg-white shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                {editingUser ? 'Edit User' : 'New User'}
              </h2>
              <button
                onClick={closeDrawer}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  className="input"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  required
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="label">Username</label>
                <input
                  type="text"
                  className="input"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  required
                  placeholder="jsmith"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="jsmith@example.com"
                />
              </div>

              <div>
                <label className="label">
                  Password
                  {editingUser && (
                    <span className="text-slate-400 font-normal ml-1">(leave blank to keep current)</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required={!editingUser}
                    placeholder={editingUser ? 'Leave blank to keep current' : 'Min 8 characters'}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={form.role_id}
                  onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}
                  disabled={editingUser?.id === currentUser?.id}
                >
                  <option value="">-- No Role --</option>
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {editingUser?.id === currentUser?.id && (
                  <p className="text-xs text-slate-400 mt-1">You cannot change your own role</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_active}
                  onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                    form.is_active ? 'bg-brand-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      form.is_active ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <label className="text-sm text-slate-700 select-none">
                  {form.is_active ? 'Active' : 'Inactive'}
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={closeDrawer} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
