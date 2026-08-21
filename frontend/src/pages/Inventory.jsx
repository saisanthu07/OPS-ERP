import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';

const emptyForm = { item: '', category: '', location: '', batch: '', physicalQty: '' };

export default function Inventory() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [damageTarget, setDamageTarget] = useState(null);
  const [damageQty, setDamageQty] = useState('');

  const canManage = user.role === 'ADMIN' || user.role === 'OPERATIONS';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory');
      setItems(res.data.items);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inventory');
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
      await api.post('/inventory', {
        ...form,
        physicalQty: Number(form.physicalQty),
        idempotencyKey: crypto.randomUUID(),
      });
      setForm(emptyForm);
      setSuccess('Inventory updated successfully.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save inventory');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDamage = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post(`/inventory/${damageTarget._id}/damage`, {
        quantity: Number(damageQty),
        idempotencyKey: crypto.randomUUID(),
      });
      setSuccess(`Marked ${damageQty} unit(s) of ${damageTarget.item} as damaged.`);
      setDamageTarget(null);
      setDamageQty('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record damaged stock');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Physical, reserved, and available quantity across every location and batch.
        </p>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

      {canManage && (
        <form onSubmit={handleCreate} className="card p-5 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div className="col-span-2 md:col-span-1">
            <label className="label">Item</label>
            <input required className="input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
          </div>
          <div>
            <label className="label">Category</label>
            <input required className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
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
            <label className="label">Add Quantity</label>
            <input required type="number" min="0" className="input" value={form.physicalQty} onChange={(e) => setForm({ ...form, physicalQty: e.target.value })} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Saving…' : 'Stock In'}
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-[#0f0f11] text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Item</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3">Batch</th>
              <th className="text-right px-4 py-3">Physical</th>
              <th className="text-right px-4 py-3">Reserved</th>
              <th className="text-right px-4 py-3">Available</th>
              {canManage && <th className="text-right px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">No inventory records yet.</td></tr>
            )}
            {items.map((it) => (
              <tr key={it._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                <td className="px-4 py-3 font-medium">{it.item}</td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">{it.category}</td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">{it.location}</td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">{it.batch}</td>
                <td className="px-4 py-3 text-right">{it.physicalQty}</td>
                <td className="px-4 py-3 text-right">{it.reservedQty}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-400">{it.availableQty}</td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs text-rose-400 hover:text-rose-300" onClick={() => setDamageTarget(it)}>
                      Mark damaged
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {damageTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDamageTarget(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleDamage} className="card p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold">Mark stock as damaged</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">
              {damageTarget.item} · {damageTarget.location} · Batch {damageTarget.batch} — available: {damageTarget.availableQty}
            </p>
            <div>
              <label className="label">Quantity damaged</label>
              <input
                required
                type="number"
                min="1"
                max={damageTarget.availableQty}
                className="input"
                value={damageQty}
                onChange={(e) => setDamageQty(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-danger flex-1">Confirm</button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setDamageTarget(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
