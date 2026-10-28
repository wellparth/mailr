'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { apiFetch, setAuthToken } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // OAuth Modal State
  const [oauthModalProvider, setOauthModalProvider] = useState<'google' | 'microsoft' | null>(null);
  const [oauthEmail, setOauthEmail] = useState('');
  const [oauthName, setOauthName] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  // Standard Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiFetch<{
        token: string;
        user: { id: string; email: string; name: string };
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });

      setAuthToken(data.token);
      localStorage.setItem('mailr_user', JSON.stringify(data.user));
      router.push('/app');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // OAuth Direct Sign Up
  const handleOAuthClick = async (provider: 'google' | 'microsoft') => {
    try {
      setError('');
      const res = await apiFetch<{ configured: boolean; url: string | null }>(
        `/auth/${provider}/url`
      );
      if (res && res.configured && res.url) {
        window.location.href = res.url;
        return;
      }
      setOauthModalProvider(provider);
      setOauthEmail('');
      setOauthName('');
    } catch {
      setOauthModalProvider(provider);
      setOauthEmail('');
      setOauthName('');
    }
  };

  const handleOAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthEmail || !oauthModalProvider) return;

    setOauthLoading(true);
    setError('');

    try {
      const data = await apiFetch<{
        token: string;
        user: { id: string; email: string; name: string };
        account: { id: string; emailAddress: string; provider: string };
      }>('/auth/oauth', {
        method: 'POST',
        body: JSON.stringify({
          provider: oauthModalProvider,
          email: oauthEmail,
          name: oauthName || oauthEmail.split('@')[0],
        }),
      });

      setAuthToken(data.token);
      localStorage.setItem('mailr_user', JSON.stringify(data.user));
      setOauthModalProvider(null);
      router.push('/app');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OAuth registration failed');
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#090d16] text-slate-100 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[450px] bg-violet-600/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-2xl text-white">Mailr</span>
          </Link>
          <h2 className="text-2xl font-extrabold text-white">Create your Mailr account</h2>
          <p className="text-xs text-slate-400">
            One client for every inbox you own. Provider agnostic & AI-accelerated.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1-Click OAuth Buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => handleOAuthClick('google')}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-white font-medium text-xs transition-all shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.4 1.9 7.8l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                />
              </svg>
              <span>Sign up with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthClick('microsoft')}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-white font-medium text-xs transition-all shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              <span>Sign up with Microsoft Outlook</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center my-4">
            <div className="flex-1 border-t border-slate-800" />
            <span className="px-3 text-[11px] text-slate-500 uppercase tracking-wider whitespace-nowrap shrink-0">
              Or with email
            </span>
            <div className="flex-1 border-t border-slate-800" />
          </div>

          <form onSubmit={handleRegister} className="space-y-4 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Gorde"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Primary Account Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Master Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 active:scale-[0.99] transition-all"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="text-center pt-2 text-xs text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-400 hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      {/* OAUTH CONNECT MODAL */}
      {oauthModalProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  Link with {oauthModalProvider === 'google' ? 'Google' : 'Microsoft Outlook'}
                </span>
              </div>
              <button
                onClick={() => setOauthModalProvider(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                Your <strong>{oauthModalProvider === 'google' ? 'Google' : 'Microsoft'}</strong> email identity will be securely authenticated and automatically provisioned as your primary mailbox in Mailr.
              </span>
            </div>

            <form onSubmit={handleOAuthSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Your {oauthModalProvider === 'google' ? 'Gmail / Workspace' : 'Outlook'} Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder={oauthModalProvider === 'google' ? 'alex@gmail.com' : 'alex@outlook.com'}
                  value={oauthEmail}
                  onChange={(e) => setOauthEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Your Display Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Alex Gorde"
                  value={oauthName}
                  onChange={(e) => setOauthName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOauthModalProvider(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={oauthLoading || !oauthEmail}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-md disabled:opacity-40"
                >
                  {oauthLoading ? 'Provisioning...' : 'Authenticate & Open Inbox'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
