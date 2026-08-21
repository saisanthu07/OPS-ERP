import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const emptyForm = { location: '', item: '', requiredQty: '', assignedUser: '' };

export default function WorkOrders() {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user.role === 'ADMIN';
  const isOps = user.role === 'OPERATIONS';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/work-orders');
      setWorkOrders(res.data.workOrders);
      if (isAdmin) {
        const usersRes = await api.get('/users', { params: { role: 'OPERATIONS' } });
        setUsers(usersRes.data.users);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await api.post('/work-orders', { ...form, requiredQty: Number(form.requiredQty) });
      setForm(emptyForm);
      setSuccess('Work order created with automatic stock check.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create work order');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id, status) => {
    setError('');
    setSuccess('');
    try {
      await api.patch(`/work-orders/${id}/status`, { status });
      setSuccess('Status updated.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const rerunStockCheck = async (id) => {
    setError('');
    try {
      await api.get(`/work-orders/${id}/stock-check`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to run stock check');
    }
  };

  const nextStatus = { ASSIGNED: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Work Orders</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Each work order automatically checks material availability and calculates any shortage.
        </p>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

      {isAdmin && (
        <form onSubmit={handleCreate} className="card p-5 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="label">Location</label>
            <input required className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="label">Item</label>
            <input required className="input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
          </div>
          <div>
            <label className="label">Required Qty</label>
            <input required type="number" min="1" className="input" value={form.requiredQty} onChange={(e) => setForm({ ...form, requiredQty: e.target.value })} />
          </div>
          <div>
            <label className="label">Assigned User</label>
            <select required className="input" value={form.assignedUser} onChange={(e) => setForm({ ...form, assignedUser: e.target.value })}>
              <option value="">Select…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Creating…' : 'Create Work Order'}
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-[#0f0f11] text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">WO Code</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-right px-4 py-3">Required</th>
              <th className="text-right px-4 py-3">Available</th>
              <th className="text-right px-4 py-3">Shortage</th>
              <th className="text-left px-4 py-3">Assigned</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading && <tr><td colSpan={9} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">Loading…</td></tr>}
            {!loading && workOrders.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">No work orders yet.</td></tr>
            )}
            {workOrders.map((wo) => (
              <tr key={wo.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                <td className="px-4 py-3 font-mono text-xs">{wo.workOrderCode}</td>
                <td className="px-4 py-3">{wo.location}</td>
                <td className="px-4 py-3">{wo.item}</td>
                <td className="px-4 py-3 text-right">{wo.requiredQty}</td>
                <td className="px-4 py-3 text-right">{wo.stockCheck?.availableAtLocation ?? '—'}</td>
                <td className={`px-4 py-3 text-right font-semibold ${wo.stockCheck?.shortage > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {wo.stockCheck?.shortage ?? 0}
                </td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">{wo.assignedUser?.name}</td>
                <td className="px-4 py-3"><StatusBadge status={wo.status} /></td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  <button className="text-xs text-zinc-200 hover:text-white" onClick={() => rerunStockCheck(wo.id)}>
                    Re-check
                  </button>
                  {(isAdmin || isOps) && nextStatus[wo.status] && (
                    <button
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                      onClick={() => updateStatus(wo.id, nextStatus[wo.status])}
                    >
                      Mark {nextStatus[wo.status].replace('_', ' ')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
