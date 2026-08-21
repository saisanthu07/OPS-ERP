import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';

const emptyForm = { item: '', category: '', location: '', batch: '', physicalQty: '' };

export default function Inventory() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [damageTarget, setDamageTarget] = useState(null);
  const [damageQty, setDamageQty] = useState('');

  const canManage = user.role === 'ADMIN' || user.role === 'OPERATIONS';

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (page = meta.page) => {
    setLoading(true);
    try {
      const res = await api.get('/inventory', {
        params: { page, limit: 10, search: debouncedSearch }
      });
      setItems(res.data.items);
      setMeta(res.data.meta);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, meta.page]);

  useEffect(() => {
    load(1);
  }, [debouncedSearch]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSubmitting(true);
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
    setError(''); setSuccess('');
    try {
      await api.post(`/inventory/${damageTarget.id}/damage`, {
        quantity: Number(damageQty),
        idempotencyKey: crypto.randomUUID(),
      });
      setSuccess(`Marked ${damageQty} unit(s) of ${damageTarget.item} as damaged.`);
      setDamageTarget(null); setDamageQty('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record damaged stock');
    }
  };

  const exportCSV = () => {
    const headers = ['Item,Category,Location,Batch,Physical,Reserved,Available'];
    const rows = items.map(it => {
      const available = it.availableQty ?? (it.physicalQty - it.reservedQty);
      return `"${it.item}","${it.category}","${it.location}","${it.batch}",${it.physicalQty},${it.reservedQty},${available}`;
    });
    const csv = headers.concat(rows).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Physical, reserved, and available quantity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            placeholder="Search items..." 
            className="input w-64"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={exportCSV} className="btn-secondary whitespace-nowrap">
            Export CSV
          </button>
        </div>
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
            <label className="label">Add Qty</label>
            <input required type="number" min="0" className="input" value={form.physicalQty} onChange={(e) => setForm({ ...form, physicalQty: e.target.value })} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Saving…' : 'Stock In'}
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-[#0f0f11] text-zinc-500 dark:text-zinc-400 text-xs uppercase sticky top-0 z-10 shadow-sm">
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
              {loading && <tr><td colSpan={8} className="px-4 py-6 text-center text-zinc-500">Loading…</td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-zinc-500">No inventory found.</td></tr>
              )}
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                  <td className="px-4 py-3 font-medium">{it.item}</td>
                  <td className="px-4 py-3 text-zinc-500">{it.category}</td>
                  <td className="px-4 py-3 text-zinc-500">{it.location}</td>
                  <td className="px-4 py-3 text-zinc-500">{it.batch}</td>
                  <td className="px-4 py-3 text-right">{it.physicalQty}</td>
                  <td className="px-4 py-3 text-right">{it.reservedQty}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-400">{(it.availableQty ?? (it.physicalQty - it.reservedQty))}</td>
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
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-zinc-500">Showing {items.length} of {meta.total} items</span>
          <div className="flex gap-2">
            <button 
              disabled={meta.page <= 1} 
              onClick={() => { setMeta({...meta, page: meta.page - 1}); load(meta.page - 1); }}
              className="btn-secondary px-3 py-1 text-xs"
            >
              Prev
            </button>
            <button 
              disabled={meta.page >= meta.totalPages} 
              onClick={() => { setMeta({...meta, page: meta.page + 1}); load(meta.page + 1); }}
              className="btn-secondary px-3 py-1 text-xs"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {damageTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDamageTarget(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleDamage} className="card p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold">Mark stock as damaged</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-500 dark:text-zinc-400">
              {damageTarget.item} · {damageTarget.location}
            </p>
            <div>
              <label className="label">Quantity damaged</label>
              <input required type="number" min="1" className="input" value={damageQty} onChange={(e) => setDamageQty(e.target.value)} />
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
