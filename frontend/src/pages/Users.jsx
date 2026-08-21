import React, { useEffect, useState } from 'react';
import api from '../api/client';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OPERATIONS', assignedLocation: '' });
  const [confirmTarget, setConfirmTarget] = useState(null);
  
  // New state for editing
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.post('/users', form);
      setSuccess('User created successfully');
      setForm({ name: '', email: '', password: '', role: 'OPERATIONS', assignedLocation: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const toggleStatus = async () => {
    if (!confirmTarget) return;
    try {
      await api.put(`/users/${confirmTarget.id}`, { isActive: !confirmTarget.isActive });
      setConfirmTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      assignedLocation: user.assignedLocation || '',
      isActive: user.isActive,
      password: ''
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.put(`/users/${editingUser.id}`, editForm);
      setSuccess('User updated successfully');
      setEditingUser(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Manage team access and roles.</p>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

      <form onSubmit={handleCreate} className="card p-5 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div>
          <label className="label">Name</label>
          <input required className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        </div>
        <div>
          <label className="label">Email</label>
          <input required type="email" className="input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        </div>
        <div>
          <label className="label">Password</label>
          <input required type="password" className="input" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
            <option value="OPERATIONS">Operations</option>
            <option value="SALES">Sales</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div>
          <label className="label">Location (Opt)</label>
          <input className="input" placeholder="e.g. Warehouse-A" value={form.assignedLocation} onChange={e => setForm({...form, assignedLocation: e.target.value})} />
        </div>
        <button type="submit" className="btn-primary w-full whitespace-nowrap">Invite User</button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-[#0f0f11] text-zinc-500 dark:text-zinc-400 text-xs uppercase sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {users.map(u => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-medium">{u.name} {isSelf && <span className="text-xs text-zinc-400 ml-1">(You)</span>}</td>
                    <td className="px-4 py-3 text-zinc-500">{u.email}</td>
                    <td className="px-4 py-3">{u.role}</td>
                    <td className="px-4 py-3 text-zinc-500">{u.assignedLocation || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${u.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button onClick={() => startEdit(u)} className="text-xs text-blue-400 hover:underline">
                        Edit
                      </button>
                      {!isSelf ? (
                        <button onClick={() => setConfirmTarget(u)} className="text-xs text-indigo-400 hover:underline">
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-500 cursor-not-allowed" title="You cannot disable your own account">
                          Disable
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disable/Enable Confirm Modal */}
      {confirmTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setConfirmTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="card p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Confirm Action</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Are you sure you want to {confirmTarget.isActive ? 'disable' : 'enable'} <strong>{confirmTarget.name}</strong>'s account?
            </p>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={toggleStatus} 
                className={confirmTarget.isActive ? "btn-danger flex-1" : "btn-primary flex-1"}
              >
                Yes, {confirmTarget.isActive ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => setConfirmTarget(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingUser(null)}>
          <div onClick={(e) => e.stopPropagation()} className="card p-6 w-full max-w-md space-y-4">
            <h2 className="font-semibold text-lg">Edit User</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input required className="input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div>
                <label className="label">Email</label>
                <input required type="email" className="input" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
              </div>
              <div>
                <label className="label">New Password (Optional)</label>
                <input type="password" placeholder="Leave blank to keep current" className="input" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})}>
                  <option value="OPERATIONS">Operations</option>
                  <option value="SALES">Sales</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="label">Assigned Location</label>
                <input className="input" placeholder="e.g. Warehouse-A" value={editForm.assignedLocation} onChange={e => setEditForm({...editForm, assignedLocation: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Save Changes</button>
                <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
