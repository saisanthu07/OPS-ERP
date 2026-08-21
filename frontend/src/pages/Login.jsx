import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../hooks/useTheme.js';
import Alert from '../components/Alert.jsx';

export default function Login() {
  const { login } = useAuth();
  const [isDark, setIsDark] = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/inventory');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#141416] transition-colors px-4 relative">
      <button onClick={() => setIsDark(!isDark)} className="absolute top-6 right-6 w-10 h-10 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
        {isDark ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        )}
      </button>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center font-bold text-xl text-white dark:text-black mb-3">
            O
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Ops ERP</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Sign in to the operations console</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && <Alert type="error" message={error} onDismiss={() => setError('')} />}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="input pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-6 text-center">
          Demo accounts: admin@opserp.com / Admin@12345 · ops@opserp.com / Ops@12345 · sales@opserp.com / Sales@12345
        </p>
        <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-4 flex justify-center gap-4">
          <Link to="/terms" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
