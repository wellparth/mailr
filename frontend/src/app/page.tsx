'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/api';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      window.location.href = '/app';
    } else {
      window.location.href = '/login';
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#070a12] text-slate-300">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        <p className="text-xs font-mono tracking-wider text-slate-400">Loading Mailr Client...</p>
      </div>
    </div>
  );
}
