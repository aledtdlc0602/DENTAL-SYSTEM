'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, setAuth } from '@/lib/api';
import AuthShell from '@/components/AuthShell';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (params.get('idle')) setInfo('Su sesión se cerró por inactividad. Vuelva a ingresar.');
    else if (params.get('expired')) setInfo('Su sesión expiró. Vuelva a ingresar.');
  }, [params]);

  function finish(data: any) {
    setAuth(data.accessToken, data.user, { idleTimeoutMin: data.idleTimeoutMin });
    router.push(data.mfaSetupRequired ? '/mfa?required=1' : '/dashboard');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mfaToken) {
        finish(await api('/auth/mfa/login', { method: 'POST', body: JSON.stringify({ mfaToken, code }) }));
        return;
      }
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (data.mfaRequired) {
        setMfaToken(data.mfaToken);
        setInfo('');
      } else finish(data);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="card p-8 sm:p-9">
        <div className="mb-8">
          <h1 className="text-[1.65rem] font-semibold">{mfaToken ? 'Verificación en dos pasos' : 'Bienvenido de nuevo'}</h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            {mfaToken ? 'Ingrese el código de 6 dígitos de su aplicación de autenticación.' : 'Inicia sesión para acceder a tu clínica.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {info && <div className="rounded-xl bg-amber-50 text-amber-800 text-sm px-4 py-3 border border-amber-200">{info}</div>}
          {error && (
            <div role="alert" className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 border border-red-200">
              {error}
            </div>
          )}

          {mfaToken ? (
            <div>
              <label className="label">Código MFA</label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="text-center text-2xl tracking-[0.5em] font-semibold"
                autoFocus
                required
              />
            </div>
          ) : (
            <>
              <div>
                <label className="label">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@clinica.com" autoComplete="email" required />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
              </div>
            </>
          )}

          <button type="submit" className="btn-primary w-full py-3 text-[15px]" disabled={loading || (!!mfaToken && code.length !== 6)}>
            {loading ? 'Verificando…' : mfaToken ? 'Verificar' : 'Iniciar sesión'}
          </button>
          {mfaToken && (
            <button type="button" className="w-full text-sm text-slate-500 hover:text-slate-800" onClick={() => { setMfaToken(null); setCode(''); }}>
              ← Volver
            </button>
          )}
        </form>

        {!mfaToken && (
          <div className="mt-7 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
            ¿Nueva clínica?{' '}
            <Link href="/register" className="text-brand-700 font-semibold hover:underline">
              Registrar clínica
            </Link>
            <p className="mt-3 text-xs text-slate-400">Demo: admin@demo.dental · Demo1234!</p>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
