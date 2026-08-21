import React from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#141416] transition-colors p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link to={-1} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
          &larr; Back
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Privacy Policy</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Last updated: {new Date().toLocaleDateString()}</p>
        <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
          <p>This privacy policy explains how Ops ERP collects and uses information.</p>
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mt-6">1. Data Collection</h2>
          <p>We log your name, email, and internal actions strictly to maintain an audit trail for inventory compliance.</p>
        </div>
      </div>
    </div>
  );
}
