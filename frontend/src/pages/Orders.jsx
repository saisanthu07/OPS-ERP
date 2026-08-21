import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const emptyForm = { customerName: '', item: '', location: '', batch: '', quantity: '' };

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const canManage = user.role === 'ADMIN' || user.role === 'SALES';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders');
      setOrders(res.data.orders);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await api.post('/orders', {
        ...form,
        quantity: Number(form.quantity),
        idempotencyKey: crypto.randomUUID(),
      });
      setForm(emptyForm);
      setSuccess('Order created and stock reserved.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create order — check available quantity.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id) => {
    setError('');
    setSuccess('');
    try {
      await api.post(`/orders/${id}/cancel`, { idempotencyKey: crypto.randomUUID() });
      setSuccess('Order cancelled and reserved stock released.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel order');
    }
  };

  const fulfill = async (id) => {
    setError('');
    setSuccess('');
    try {
      await api.post(`/orders/${id}/fulfill`);
      setSuccess('Order fulfilled.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fulfill order');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customer Orders</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Reservations are checked and applied atomically — two concurrent orders can never both
          exceed available stock.
        </p>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

      {canManage && (
        <form onSubmit={handleCreate} className="card p-5 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className="label">Customer</label>
            <input required className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          </div>
          <div>
            <label className="label">Item</label>
            <input required className="input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
          </div>
          <div>
            <label className="label">Location</label>
            <input required className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="label">Batch</label>
            <input required className="input" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} />
          </div>
          <div>
            <label className="label">Quantity</label>
            <input required type="number" min="1" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Reserving…' : 'Create Order'}
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-[#0f0f11] text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Order</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Item / Batch</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-right px-4 py-3">Qty</th>
              <th className="text-left px-4 py-3">Status</th>
              {canManage && <th className="text-right px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">Loading…</td></tr>}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">No orders yet.</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                <td className="px-4 py-3 font-mono text-xs">{o.orderCode}</td>
                <td className="px-4 py-3">{o.customerName}</td>
                <td className="px-4 py-3">{o.item} <span className="text-zinc-500 dark:text-zinc-400">/ {o.batch}</span></td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">{o.location}</td>
                <td className="px-4 py-3 text-right">{o.quantity}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                {canManage && (
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {o.status === 'RESERVED' && (
                      <>
                        <button className="text-xs text-emerald-400 hover:text-emerald-300" onClick={() => fulfill(o.id)}>
                          Fulfill
                        </button>
                        <button className="text-xs text-rose-400 hover:text-rose-300" onClick={() => cancel(o.id)}>
                          Cancel
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
