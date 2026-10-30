'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, clearAuth, getToken, setToken, getUser } from '@/lib/api';
import AuthShell from '@/components/AuthShell';

/** RNF-05: configuración de MFA (TOTP) con QR para Google Authenticator / Authy / Microsoft Authenticator. */
function MfaSetup() {
  const router = useRouter();
  const params = useSearchParams();
  const required = !!params.get('required');
  const [setup, setSetup] = useState<any>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api('/auth/mfa/setup', { method: 'POST' }).then(setSetup).catch((e) => setError(e.message));
  }, [router]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ code }) });
      if (res.accessToken) setToken(res.accessToken);
      const u = getUser();
      if (u) localStorage.setItem('user', JSON.stringify({ ...u, mfaEnabled: true }));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="card p-8 sm:p-9">
        <h1 className="text-[1.5rem] font-semibold">Autenticación de dos factores</h1>
        <p className="text-slate-500 mt-1.5 text-sm">
          {required ? 'Su clínica exige MFA para acceder a expedientes e información financiera. ' : ''}
          Escanee el código con Google Authenticator, Authy o Microsoft Authenticator.
        </p>
        {error && <div className="mt-4 rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 border border-red-200">{error}</div>}
        {setup && (
          <div className="mt-6 space-y-5">
            <div className="flex flex-col items-center gap-3">
              {setup.qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={setup.qrDataUrl} alt="Código QR para MFA" width={200} height={200} className="rounded-xl border border-slate-200 bg-white p-2" />
              ) : (
                <p className="text-sm text-slate-500">Ingrese esta clave manualmente en su aplicación:</p>
              )}
              <code className="select-all rounded-lg bg-slate-100 px-3 py-2 text-sm font-mono tracking-wider break-all text-center">{setup.secret}</code>
            </div>
            <form onSubmit={verify} className="space-y-4">
              <div>
                <label className="label">Código de 6 dígitos</label>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-[0.5em] font-semibold"
                  autoFocus
                  required
                />
              </div>
              <button className="btn-primary w-full py-3" disabled={loading || code.length !== 6}>
                {loading ? 'Verificando…' : 'Activar MFA'}
              </button>
            </form>
          </div>
        )}
        <div className="mt-6 flex justify-between text-sm">
          {!required ? (
            <button className="text-slate-500 hover:text-slate-800" onClick={() => router.push('/settings')}>← Volver</button>
          ) : (
            <span />
          )}
          <button className="text-slate-500 hover:text-slate-800" onClick={() => { clearAuth(); router.push('/login'); }}>Cerrar sesión</button>
        </div>
      </div>
    </AuthShell>
  );
}

export default function MfaPage() {
  return (
    <Suspense fallback={null}>
      <MfaSetup />
    </Suspense>
  );
}
