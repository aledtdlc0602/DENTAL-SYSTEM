'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icons';
import { Badge, ErrorBox, Modal, Notice, PageHeader, Spinner, Tabs } from '@/components/ui';
import { api, getUser, hasRole } from '@/lib/api';
import { ROLE_LABELS, fmtDateTime } from '@/lib/format';

type Tab = 'account' | 'clinic' | 'security' | 'users' | 'rooms' | 'messages' | 'demo';

export default function SettingsPage() {
  const admin = hasRole();
  const [tab, setTab] = useState<Tab>('account');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'account', label: 'Mi cuenta' },
    ...(admin
      ? ([
          { id: 'clinic', label: 'Clínica y SRI' },
          { id: 'security', label: 'Seguridad' },
          { id: 'users', label: 'Usuarios y roles' },
          { id: 'rooms', label: 'Sillones' },
          { id: 'messages', label: 'Mensajería' },
          { id: 'demo', label: 'Datos demo' },
        ] as { id: Tab; label: string }[])
      : []),
  ];
  return (
    <AppShell>
      <PageHeader title="Configuración" />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'account' && <AccountTab />}
      {tab === 'clinic' && <ClinicTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'rooms' && <RoomsTab />}
      {tab === 'messages' && <MessagesTab />}
      {tab === 'demo' && <DemoTab />}
    </AppShell>
  );
}

function AccountTab() {
  const [me, setMe] = useState<any>(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api('/auth/me').then(setMe).catch((e) => setError(e.message));
  }, []);
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/users/me/password', { method: 'PATCH', body: JSON.stringify(pw) });
      setPw({ currentPassword: '', newPassword: '' });
      setMsg('Contraseña actualizada');
    } catch (err: any) {
      setError(err.message);
    }
  }
  async function disable(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) });
      setMe({ ...me, mfaEnabled: false });
      setMsg('MFA desactivado');
    } catch (err: any) {
      setError(err.message);
    }
  }
  if (!me) return <Spinner />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(error || msg) && <div className="lg:col-span-2"><ErrorBox error={error} onClose={() => setError('')} />{msg && <Notice tone="success">{msg}</Notice>}</div>}
      <section className="card p-5">
        <h3 className="font-semibold">{me.firstName} {me.lastName}</h3>
        <p className="text-sm text-slate-500">{me.email} · {ROLE_LABELS[me.role]}</p>
        <div className="mt-5 flex items-center justify-between rounded-lg bg-slate-50 p-4">
          <div>
            <div className="font-semibold">Autenticación de dos factores (MFA)</div>
            <div className="text-sm text-slate-500">{me.mfaEnabled ? 'Activa: se pide un código al iniciar sesión.' : 'Inactiva.'}{me.settings?.requireMfa ? ' La clínica la exige.' : ''}</div>
          </div>
          {me.mfaEnabled ? <Badge cls="bg-emerald-50 text-emerald-700 ring-emerald-600/20">Activa</Badge> : <Link href="/mfa" className="btn-primary">Activar</Link>}
        </div>
        {me.mfaEnabled && !me.settings?.requireMfa && (
          <form onSubmit={disable} className="mt-3 flex gap-2">
            <input className="!w-36" placeholder="Código actual" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <button className="btn-secondary">Desactivar MFA</button>
          </form>
        )}
        <p className="mt-4 text-xs text-slate-400">La sesión se cierra tras {me.settings?.idleTimeoutMin ?? 15} minutos de inactividad.</p>
      </section>
      <section className="card p-5">
        <h3 className="mb-3 font-semibold">Cambiar contraseña</h3>
        <form onSubmit={changePw} className="space-y-3">
          <div><label className="label">Contraseña actual</label><input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></div>
          <div><label className="label">Nueva contraseña (mín. 8, letras y números)</label><input type="password" minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required /></div>
          <button className="btn-primary">Actualizar</button>
        </form>
      </section>
    </div>
  );
}

function useSettings() {
  const [s, setS] = useState<any>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    api('/settings').then(setS).catch((e) => setError(e.message));
  }, []);
  const save = async (body: any) => {
    setError('');
    setMsg('');
    try {
      setS(await api('/settings', { method: 'PATCH', body: JSON.stringify(body) }));
      setMsg('Configuración guardada');
    } catch (e: any) {
      setError(e.message);
    }
  };
  return { s, setS, save, error, msg };
}

function ClinicTab() {
  const { s, setS, save, error, msg } = useSettings();
  if (!s) return <Spinner />;
  const f = (k: string, l: string, ph = '') => (
    <div><label className="label">{l}</label><input value={s[k] || ''} placeholder={ph} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></div>
  );
  const sri = s.settings.sri;
  const setSri = (patch: any) => setS({ ...s, settings: { ...s.settings, sri: { ...sri, ...patch } } });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save({ name: s.name, legalName: s.legalName || undefined, ruc: s.ruc || undefined, address: s.address || undefined, phone: s.phone || undefined, email: s.email || undefined, sri }); }} className="card max-w-3xl p-5 space-y-4">
      <ErrorBox error={error} />{msg && <Notice tone="success">{msg}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        {f('name', 'Nombre comercial')}
        {f('legalName', 'Razón social')}
        {f('ruc', 'RUC (13 dígitos)', '1792345678001')}
        {f('phone', 'Teléfono')}
        {f('email', 'Email')}
        {f('address', 'Dirección matriz')}
      </div>
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">Facturación electrónica SRI</legend>
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className="label">Ambiente</label><select value={sri.ambiente} onChange={(e) => setSri({ ambiente: e.target.value })}><option value="1">1 · Pruebas</option><option value="2">2 · Producción</option></select></div>
          <div><label className="label">Establecimiento</label><input maxLength={3} value={sri.establecimiento} onChange={(e) => setSri({ establecimiento: e.target.value.replace(/\D/g, '') })} /></div>
          <div><label className="label">Punto de emisión</label><input maxLength={3} value={sri.puntoEmision} onChange={(e) => setSri({ puntoEmision: e.target.value.replace(/\D/g, '') })} /></div>
          <label className="mt-6 inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={sri.obligadoContabilidad} onChange={(e) => setSri({ obligadoContabilidad: e.target.checked })} /> Obligado a llevar contabilidad</label>
        </div>
        <p className="mt-3 text-xs text-slate-500">Al emitir se genera el número (estab-ptoEmi-secuencial), la clave de acceso de 49 dígitos y el XML del comprobante v1.1.0. La firma XAdES con su certificado .p12 y el envío al SRI se conectan con su proveedor de firma (ver README).</p>
      </fieldset>
      <button className="btn-primary">Guardar</button>
    </form>
  );
}

function SecurityTab() {
  const { s, setS, save, error, msg } = useSettings();
  if (!s) return <Spinner />;
  const st = s.settings;
  const set = (patch: any) => setS({ ...s, settings: { ...st, ...patch } });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save({ requireMfa: st.requireMfa, idleTimeoutMin: Number(st.idleTimeoutMin), noteLockHours: Number(st.noteLockHours) }); }} className="card max-w-2xl p-5 space-y-4">
      <ErrorBox error={error} />{msg && <Notice tone="success">{msg}</Notice>}
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={st.requireMfa} onChange={(e) => set({ requireMfa: e.target.checked })} />
        <span><span className="font-semibold">Exigir MFA a todo el personal</span><br /><span className="text-sm text-slate-500">Quien no lo tenga configurado deberá activarlo antes de acceder a expedientes o información financiera. Configure el suyo primero.</span></span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Cierre por inactividad (minutos)</label><input type="number" min={5} max={120} value={st.idleTimeoutMin} onChange={(e) => set({ idleTimeoutMin: e.target.value })} /></div>
        <div><label className="label">Horas para bloquear notas clínicas</label><input type="number" min={1} max={168} value={st.noteLockHours} onChange={(e) => set({ noteLockHours: e.target.value })} /></div>
      </div>
      <p className="text-xs text-slate-500">Los cambios de MFA y del tiempo de inactividad aplican a partir del siguiente inicio de sesión de cada usuario.</p>
      <button className="btn-primary">Guardar</button>
    </form>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [error, setError] = useState('');
  const me = getUser();
  const load = useCallback(() => api('/users?includeInactive=true').then(setUsers).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const body: any = { firstName: edit.firstName, lastName: edit.lastName, phone: edit.phone || undefined, role: edit.role, specialties: String(edit.specialties || '').split(',').map((s: string) => s.trim()).filter(Boolean) };
      if (edit.id) {
        if (edit.password) body.password = edit.password;
        body.isActive = edit.isActive;
        await api(`/users/${edit.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await api('/users', { method: 'POST', body: JSON.stringify({ ...body, email: edit.email, password: edit.password }) });
      }
      setEdit(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <>
      <ErrorBox error={error} onClose={() => setError('')} />
      <div className="mb-4 flex justify-end"><button className="btn-primary" onClick={() => setEdit({ email: '', password: '', firstName: '', lastName: '', role: 'DENTIST', specialties: '', phone: '', isActive: true })}><Icon name="plus" size={18} /> Nuevo usuario</button></div>
      {!users ? <Spinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className="px-4 py-3 text-left">Usuario</th><th className="px-4 py-3 text-left">Rol</th><th className="px-4 py-3 text-left hidden md:table-cell">Especialidades</th><th className="px-4 py-3 text-left">MFA</th><th className="px-4 py-3 text-left hidden lg:table-cell">Último acceso</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? '' : 'opacity-50'}>
                  <td className="px-4 py-2.5"><div className="font-medium">{u.firstName} {u.lastName}{!u.isActive && ' (inactivo)'}</div><div className="text-xs text-slate-500">{u.email}</div></td>
                  <td className="px-4">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 hidden md:table-cell text-slate-600">{u.specialties?.join(', ')}</td>
                  <td className="px-4">{u.mfaEnabled ? <Badge cls="bg-emerald-50 text-emerald-700 ring-emerald-600/20">Sí</Badge> : <Badge>No</Badge>}</td>
                  <td className="px-4 hidden lg:table-cell text-xs text-slate-500">{fmtDateTime(u.lastLoginAt)}</td>
                  <td className="px-4 text-right whitespace-nowrap space-x-2">
                    <button className="text-xs font-semibold text-brand-700" onClick={() => setEdit({ ...u, specialties: (u.specialties || []).join(', '), password: '' })}>Editar</button>
                    {u.mfaEnabled && u.id !== me?.id && <button className="text-xs font-semibold text-slate-600" onClick={() => confirm('¿Quitar el MFA de este usuario?') && api(`/users/${u.id}/reset-mfa`, { method: 'PATCH' }).then(load)}>Reset MFA</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!edit} title={edit?.id ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setEdit(null)}>
        {edit && (
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Nombres</label><input value={edit.firstName} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} required /></div>
            <div><label className="label">Apellidos</label><input value={edit.lastName} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} required /></div>
            {!edit.id && <div className="sm:col-span-2"><label className="label">Email</label><input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} required /></div>}
            <div><label className="label">Rol</label><select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} disabled={edit.id === me?.id}>{['ADMIN', 'DENTIST', 'RECEPTIONIST', 'ASSISTANT', 'ACCOUNTANT'].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
            <div><label className="label">Celular</label><input value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
            {edit.role === 'DENTIST' && <div className="sm:col-span-2"><label className="label">Especialidades (separadas por coma)</label><input value={edit.specialties} onChange={(e) => setEdit({ ...edit, specialties: e.target.value })} /></div>}
            <div className="sm:col-span-2"><label className="label">{edit.id ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña inicial *'}</label><input type="password" minLength={8} value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} required={!edit.id} /></div>
            {edit.id && edit.id !== me?.id && <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Usuario activo</label>}
            <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancelar</button><button className="btn-primary">Guardar</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}

function RoomsTab() {
  const [rooms, setRooms] = useState<any[] | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const load = useCallback(() => api('/rooms').then(setRooms).catch((e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="max-w-3xl space-y-4">
      <ErrorBox error={error} onClose={() => setError('')} />
      <form onSubmit={(e) => { e.preventDefault(); api('/rooms', { method: 'POST', body: JSON.stringify(form) }).then(() => { setForm({ name: '', description: '' }); load(); }).catch((err) => setError(err.message)); }} className="card flex flex-wrap gap-2 p-4">
        <input className="!w-48" placeholder="Nombre (Sillón 13)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="flex-1" placeholder="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="btn-primary">Agregar</button>
      </form>
      {!rooms ? <Spinner /> : (
        <div className="card divide-y divide-slate-100">
          {rooms.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div><span className="font-medium">{r.name}</span> <span className="text-slate-500">· {r.description}</span></div>
              <button className="text-xs font-semibold text-red-600" onClick={() => confirm(`¿Desactivar ${r.name}?`) && api(`/rooms/${r.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: false }) }).then(load)}>Desactivar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const EVENTS: Record<string, string> = { CONFIRMATION: 'Confirmación al agendar', REMINDER_48H: 'Recordatorio 48 h', REMINDER_24H: 'Recordatorio 24 h', RESCHEDULED: 'Reprogramación', NO_SHOW_FOLLOWUP: 'Seguimiento por inasistencia', BIRTHDAY: 'Cumpleaños', POST_OP: 'Post-operatorio', PAYMENT_REMINDER: 'Cobranza', RECALL_6M: 'Control semestral' };

function MessagesTab() {
  const [providers, setProviders] = useState<any>(null);
  const [templates, setTemplates] = useState<any[] | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => {
    api('/notifications/providers').then(setProviders).catch(() => {});
    api('/notifications/templates').then(setTemplates).catch((e) => setError(e.message));
    api('/notifications/logs').then(setLogs).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="space-y-6">
      <ErrorBox error={error} onClose={() => setError('')} />
      {msg && <Notice tone="success">{msg}</Notice>}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Canales de envío</h3>
            <p className="text-sm text-slate-500">Recordatorios automáticos 48 h y 24 h antes de cada cita, en horario 07:00–21:00.</p>
          </div>
          <button className="btn-secondary" onClick={() => api('/notifications/run-reminders', { method: 'POST' }).then((r) => setMsg(r.skipped ? `Sin envío: ${r.skipped}` : `Recordatorios enviados: ${r.sent}`)).then(load).catch((e) => setError(e.message))}><Icon name="bell" size={16} /> Ejecutar ahora</button>
        </div>
        {providers && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {Object.entries(providers).map(([ch, p]: any) => <Badge key={ch} cls={p === 'mock' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'}>{ch}: {p === 'mock' ? 'modo prueba (sin credenciales)' : p}</Badge>)}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">Configure WHATSAPP_TOKEN / TWILIO_* / SENDGRID_* en el .env del backend para envíos reales.</p>
      </section>
      <section className="card p-5">
        <h3 className="mb-3 font-semibold">Plantillas</h3>
        <p className="mb-3 text-xs text-slate-500">Variables: {'{{nombre}} {{fecha}} {{hora}} {{doctor}} {{clinica}}'}</p>
        {!templates ? <Spinner /> : (
          <div className="divide-y divide-slate-100">
            {templates.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div><div className="font-semibold">{EVENTS[t.eventType] || t.eventType} · <span className="text-slate-500">{t.channel}</span></div><div className="text-slate-600">{t.body}</div></div>
                <button className="shrink-0 text-xs font-semibold text-brand-700" onClick={() => setEdit({ ...t })}>Editar</button>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="card p-5">
        <h3 className="mb-3 font-semibold">Últimos envíos</h3>
        <div className="max-h-80 overflow-y-auto text-sm">
          {logs.slice(0, 50).map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-3 border-b border-slate-50 py-1.5">
              <div className="min-w-0"><span className="text-xs text-slate-400">{fmtDateTime(l.createdAt)} · {l.channel} · {l.toAddress}</span><div className="truncate">{l.body}</div></div>
              <Badge cls={l.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : l.status === 'FAILED' ? 'bg-red-50 text-red-700 ring-red-600/20' : undefined}>{l.status}</Badge>
            </div>
          ))}
        </div>
      </section>
      <Modal open={!!edit} title="Editar plantilla" onClose={() => setEdit(null)}>
        {edit && (
          <form onSubmit={(e) => { e.preventDefault(); api('/notifications/templates', { method: 'PUT', body: JSON.stringify({ channel: edit.channel, eventType: edit.eventType, subject: edit.subject || undefined, body: edit.body, isActive: edit.isActive }) }).then(() => { setEdit(null); load(); }).catch((err) => setError(err.message)); }} className="space-y-3">
            {edit.channel === 'EMAIL' && <div><label className="label">Asunto</label><input value={edit.subject || ''} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></div>}
            <div><label className="label">Mensaje</label><textarea className="min-h-[120px]" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} required /></div>
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Activa</label>
            <div className="flex justify-end"><button className="btn-primary">Guardar</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function DemoTab() {
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(reset: boolean) {
    if (reset && !confirm('Esto BORRA pacientes, citas, facturas y demás datos operativos de la clínica y los reemplaza por datos demo. ¿Continuar?')) return;
    setBusy(true);
    setError('');
    try {
      setRes(await api(`/seed/demo${reset ? '?reset=true' : ''}`, { method: 'POST' }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card max-w-3xl p-5 space-y-4">
      <ErrorBox error={error} />
      <p className="text-sm text-slate-600">Carga datos de prueba coherentes en todas las áreas (20 usuarios, 60 pacientes, ~300 citas, facturas, cierres de caja, inventario, etc.). Todos los usuarios demo usan la clave <code>Demo1234!</code>.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => run(false)}>{busy ? 'Cargando…' : 'Cargar datos demo'}</button>
        <button className="btn-danger" disabled={busy} onClick={() => run(true)}>Reiniciar y regenerar</button>
      </div>
      {res && (
        <div className="text-sm">
          <Notice tone={res.alreadySeeded ? 'warn' : 'success'}>{res.message}</Notice>
          {res.summary && <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">{Object.entries(res.summary).map(([k, v]: any) => <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className="font-semibold tabular-nums">{v}</span></div>)}</div>}
          {res.logins && <details className="mt-3"><summary className="cursor-pointer font-semibold">Usuarios demo</summary><ul className="mt-2 grid gap-1 sm:grid-cols-2">{res.logins.map((l: any) => <li key={l.email} className="text-xs"><code>{l.email}</code> · {ROLE_LABELS[l.role]}</li>)}</ul></details>}
        </div>
      )}
    </div>
  );
}
