'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setAuth } from '@/lib/api';
import AuthShell from '@/components/AuthShell';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    clinicName: '',
    ruc: '',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/register-clinic', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setAuth(data.accessToken, data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="card p-8">
        <div className="mb-7">
          <h1 className="text-[1.5rem] font-semibold">Registrar nueva clínica</h1>
          <p className="text-slate-500 text-sm mt-1.5">Crea tu cuenta de administrador.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3 border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="label">Nombre de la clínica *</label>
            <input
              value={form.clinicName}
              onChange={(e) => update('clinicName', e.target.value)}
              placeholder="Clínica Dental Sonrisa"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">RUC</label>
              <input
                value={form.ruc}
                onChange={(e) => update('ruc', e.target.value)}
                placeholder="1791234567001"
              />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="0987654321"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre admin *</label>
              <input
                value={form.adminFirstName}
                onChange={(e) => update('adminFirstName', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Apellido admin *</label>
              <input
                value={form.adminLastName}
                onChange={(e) => update('adminLastName', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Email admin *</label>
            <input
              type="email"
              value={form.adminEmail}
              onChange={(e) => update('adminEmail', e.target.value)}
              placeholder="admin@clinica.com"
              required
            />
          </div>

          <div>
            <label className="label">Contraseña *</label>
            <input
              type="password"
              value={form.adminPassword}
              onChange={(e) => update('adminPassword', e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={8}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full py-3 text-[15px]" disabled={loading}>
            {loading ? 'Creando clínica...' : 'Crear clínica'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-500">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-brand-700 font-semibold hover:underline">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
