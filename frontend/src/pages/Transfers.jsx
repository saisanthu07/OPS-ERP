import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const emptyForm = { sourceLocation: '', destinationLocation: '', item: '', batch: '', quantity: '' };

export default function Transfers() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [receiveQty, setReceiveQty] = useState('');

  const canManage = user.role === 'ADMIN' || user.role === 'OPERATIONS';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/transfers');
      setTransfers(res.data.transfers);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load transfers');
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
      await api.post('/transfers/request', { ...form, quantity: Number(form.quantity) });
      setForm(emptyForm);
      setSuccess('Transfer requested.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const dispatch = async (id) => {
    setError('');
    setSuccess('');
    try {
      await api.post(`/transfers/${id}/dispatch`, { idempotencyKey: crypto.randomUUID() });
      setSuccess('Transfer dispatched. Source inventory reduced.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to dispatch transfer');
    }
  };

  const openReceive = (t) => {
    setReceiveTarget(t);
    setReceiveQty(String(t.quantity - t.quantityReceived));
  };

  const handleReceive = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post(`/transfers/${receiveTarget.id}/receive`, {
        quantity: Number(receiveQty),
        idempotencyKey: crypto.randomUUID(),
      });
      setSuccess('Receipt recorded. Destination inventory updated.');
      setReceiveTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to receive transfer');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Internal Transfers</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Source inventory reduces on dispatch. Destination inventory only increases on receipt — never before.
        </p>
      </div>

      {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}
      {success && <Alert type="success" message={success} onDismiss={() => setSuccess('')} />}

      {canManage && (
        <form onSubmit={handleCreate} className="card p-5 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className="label">Source Location</label>
            <input required className="input" value={form.sourceLocation} onChange={(e) => setForm({ ...form, sourceLocation: e.target.value })} />
          </div>
          <div>
            <label className="label">Destination Location</label>
            <input required className="input" value={form.destinationLocation} onChange={(e) => setForm({ ...form, destinationLocation: e.target.value })} />
          </div>
          <div>
            <label className="label">Item</label>
            <input required className="input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
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
            {submitting ? 'Requesting…' : 'Request Transfer'}
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-[#0f0f11] text-zinc-500 dark:text-zinc-500 dark:text-zinc-400 text-xs uppercase sticky top-0 z-10 shadow-sm">
              <tr>
              <th className="text-left px-4 py-3">Transfer</th>
              <th className="text-left px-4 py-3">Item / Batch</th>
              <th className="text-left px-4 py-3">Route</th>
              <th className="text-right px-4 py-3">Qty</th>
              <th className="text-right px-4 py-3">Received</th>
              <th className="text-left px-4 py-3">Status</th>
              {canManage && <th className="text-right px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">Loading…</td></tr>}
            {!loading && transfers.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">No transfers yet.</td></tr>
            )}
            {transfers.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                <td className="px-4 py-3 font-mono text-xs">{t.transferCode}</td>
                <td className="px-4 py-3">{t.item} <span className="text-zinc-500 dark:text-zinc-400">/ {t.batch}</span></td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">{t.sourceLocation} → {t.destinationLocation}</td>
                <td className="px-4 py-3 text-right">{t.quantity}</td>
                <td className="px-4 py-3 text-right">{t.quantityReceived}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                {canManage && (
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {t.status === 'REQUESTED' && (
                      <button className="text-xs text-zinc-200 hover:text-white" onClick={() => dispatch(t.id)}>
                        Dispatch
                      </button>
                    )}
                    {['DISPATCHED', 'RECEIVED_PARTIAL'].includes(t.status) && (
                      <button className="text-xs text-emerald-400 hover:text-emerald-300" onClick={() => openReceive(t)}>
                        Receive
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {receiveTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setReceiveTarget(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleReceive} className="card p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold">Receive transfer {receiveTarget.transferCode}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">
              Remaining to receive: {receiveTarget.quantity - receiveTarget.quantityReceived}
            </p>
            <div>
              <label className="label">Quantity received now (partial allowed)</label>
              <input
                required
                type="number"
                min="1"
                max={receiveTarget.quantity - receiveTarget.quantityReceived}
                className="input"
                value={receiveQty}
                onChange={(e) => setReceiveQty(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">Confirm Receipt</button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setReceiveTarget(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
