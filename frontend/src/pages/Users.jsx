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
  
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'OPERATIONS' });
  const [confirmTarget, setConfirmTarget] = useState(null);

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
      setForm({ name: '', email: '', password: '', role: 'OPERATIONS' });
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

      <form onSubmit={handleCreate} className="card p-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
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
        <button type="submit" className="btn-primary">Invite User</button>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-[#0f0f11] text-zinc-500 dark:text-zinc-400 text-xs uppercase sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
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
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${u.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf ? (
                        <button onClick={() => setConfirmTarget(u)} className="text-xs text-indigo-400 hover:underline">
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-500 cursor-not-allowed" title="You cannot disable your own account">
                          {u.isActive ? 'Disable' : 'Enable'}
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
    </div>
  );
}
