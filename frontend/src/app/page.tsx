'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    router.replace(token ? '/dashboard' : '/login');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-500">
      <div className="h-10 w-10 rounded-full border-[3px] border-brand-100 border-t-brand-600 animate-spin" />
      <span className="text-sm">Cargando…</span>
    </div>
  );
}
