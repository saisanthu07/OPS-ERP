import React from 'react';

export default function Alert({ type = 'error', message, onDismiss }) {
  if (!message) return null;
  const styles = {
    error: 'bg-rose-500/10 border-rose-600/40 text-rose-300',
    success: 'bg-emerald-500/10 border-emerald-600/40 text-emerald-300',
    info: 'bg-sky-500/10 border-sky-600/40 text-sky-300',
  };
  return (
    <div className={`border rounded-md px-4 py-3 text-sm flex items-start justify-between gap-4 ${styles[type]}`}>
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-70 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
}
