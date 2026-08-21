import React from 'react';

const COLORS = {
  ASSIGNED: 'bg-zinc-500/20 text-zinc-300 border-zinc-600/40',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-300 border-amber-600/40',
  COMPLETED: 'bg-emerald-500/20 text-emerald-300 border-emerald-600/40',
  REQUESTED: 'bg-zinc-500/20 text-zinc-300 border-zinc-600/40',
  DISPATCHED: 'bg-amber-500/20 text-amber-300 border-amber-600/40',
  RECEIVED_PARTIAL: 'bg-sky-500/20 text-sky-300 border-sky-600/40',
  RECEIVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-600/40',
  RESERVED: 'bg-amber-500/20 text-amber-300 border-amber-600/40',
  FULFILLED: 'bg-emerald-500/20 text-emerald-300 border-emerald-600/40',
  CANCELLED: 'bg-rose-500/20 text-rose-300 border-rose-600/40',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge border ${COLORS[status] || 'bg-zinc-700 text-zinc-300 border-zinc-600'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}
