import React from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#141416] transition-colors p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link to={-1} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
          &larr; Back
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Terms of Service</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Last updated: {new Date().toLocaleDateString()}</p>
        <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
          <p>Welcome to Ops ERP. By using our portal, you agree to these terms.</p>
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mt-6">1. Usage Rights</h2>
          <p>You are granted a limited, non-exclusive license to use this operations portal for your internal business purposes only.</p>
        </div>
      </div>
    </div>
  );
}
