import React from 'react';

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Last updated: {new Date().toLocaleDateString()}</p>
      <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
        <p>Your privacy is important to us at Ops ERP.</p>
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-900 dark:text-zinc-100 mt-6">1. Information Collection</h2>
        <p>We only collect the operational data necessary to perform enterprise resource planning functions (e.g., inventory counts, user actions).</p>
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-900 dark:text-zinc-100 mt-6">2. Data Usage</h2>
        <p>This data is used solely to provide analytics and operational tools for your organization.</p>
      </div>
    </div>
  );
}