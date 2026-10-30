'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Icon, { IconName } from '@/components/Icons';
import { AlertBadges, Badge, PanelHeader, StatStrip } from '@/components/ui';
import { api, getUser, hasRole } from '@/lib/api';
import { APPT_STATUS, fmtTime, fullName, money, pct } from '@/lib/format';

export default function DashboardPage() {
  const user = getUser();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    api('/reports/dashboard').then(setD).catch((e) => setError(e.message));
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const finance = hasRole('ACCOUNTANT');
  const canBook = hasRole('DENTIST', 'ASSISTANT', 'RECEPTIONIST');
  const v = (x: any) => (d ? x : <span className="inline-block h-6 w-10 animate-pulse rounded bg-slate-100" />);
  const list: any[] = d?.today.list || [];
  const nowIndex = list.findIndex((a) => new Date(a.endAt) > now);
  const by = d?.today.byStatus || {};

  const pending: { label: string; count: number; href: string; icon: IconName; tone?: 'alert' }[] = d
    ? [
        { label: 'Notas clínicas sin firmar', count: d.unsignedNotes, href: '/patients', icon: 'pen' as IconName },
        { label: 'Presupuestos por aprobar', count: d.pendingPlans, href: '/treatment-plans', icon: 'clipboard' as IconName },
        { label: 'Insumos bajo el stock mínimo', count: d.lowStock, href: '/inventory', icon: 'package' as IconName, tone: 'alert' as const },
      ].filter((p) => p.count > 0)
    : [];

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>{greeting}, {user?.firstName || 'Admin'}</h1>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            {d ? (d.today.total ? `Hoy hay ${d.today.total} cita${d.today.total > 1 ? 's' : ''} en la agenda${user?.role === 'DENTIST' ? ' para usted' : ''}.` : 'No hay citas agendadas para hoy.') : 'Cargando el resumen del día…'}
          </p>
        </div>
        {canBook && (
          <div className="flex gap-2">
            <Link href="/patients" className="btn-secondary"><Icon name="users" size={16} /> Nuevo paciente</Link>
            <Link href="/appointments" className="btn-primary"><Icon name="plus" size={16} /> Nueva cita</Link>
          </div>
        )}
      </div>
      {error && <p className="mb-4 text-[13.5px] text-red-700">{error}</p>}

      <StatStrip
        items={[
          { label: 'Citas de hoy', value: v(d?.today.total), hint: d ? `${by.COMPLETED || 0} atendidas · ${(by.CONFIRMED || 0) + (by.SCHEDULED || 0)} por llegar` : undefined },
          { label: 'En sala de espera', value: v((by.WAITING || 0) + (by.IN_PROGRESS || 0)), hint: d ? `${by.IN_PROGRESS || 0} en atención ahora` : undefined },
          finance
            ? { label: 'Ingresos del mes', value: v(money(d?.revenueMonth)), hint: d ? `Hoy ${money(d.revenueToday)} · por cobrar ${money(d.accountsReceivable)}` : undefined }
            : { label: 'Pacientes activos', value: v(d?.patients), hint: d ? `${d.newPatientsThisMonth} nuevos este mes` : undefined },
          { label: 'Ausentismo, 30 días', value: v(pct(d?.noShowRate30d)), hint: 'Citas sin asistencia', tone: d && d.noShowRate30d > 15 ? 'alert' : 'default' },
        ]}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card overflow-hidden">
          <PanelHeader
            title="Agenda de hoy"
            sub={user?.role === 'DENTIST' ? 'Sus pacientes' : 'Todos los sillones'}
            action={<Link href="/appointments" className="btn-ghost !h-8 text-[13px]">Abrir agenda <Icon name="chevron-right" size={15} /></Link>}
          />
          {!d ? (
            <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-11 animate-pulse rounded bg-slate-50" />)}</div>
          ) : list.length === 0 ? (
            <div className="px-5 py-14 text-center text-[13.5px] text-ink-muted">Sin citas para hoy. Use “Nueva cita” para agendar.</div>
          ) : (
            <ol className="max-h-[560px] overflow-y-auto">
              {list.map((a, i) => {
                const past = new Date(a.endAt) <= now;
                return (
                  <Fragment key={a.id}>
                    {i === nowIndex && (
                      <li className="flex items-center gap-3 px-5 py-1" aria-label="Hora actual">
                        <span className="w-12 text-right text-[11.5px] font-semibold tabular-nums text-brand-600">{fmtTime(now)}</span>
                        <span className="h-px flex-1 bg-brand-500" />
                      </li>
                    )}
                    <li className={`border-b border-[#edf0f2] last:border-0 ${past ? 'bg-slate-50/50' : ''}`}>
                      <Link href={`/patients/${a.patient.id}`} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center [&>*:last-child]:justify-self-end gap-x-4 px-5 py-2.5 transition-colors hover:bg-slate-50 sm:grid-cols-[3rem_minmax(0,1.4fr)_minmax(0,1fr)_9.5rem]">
                        <span className={`text-right text-[13.5px] font-semibold tabular-nums ${past ? 'text-ink-muted' : 'text-ink'}`}>{fmtTime(a.startAt)}</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className={`truncate text-[13.5px] font-medium ${past ? 'text-ink-soft' : 'text-ink'}`}>{fullName(a.patient)}</span>
                            <AlertBadges alerts={a.patient.medicalHistory?.alerts} compact />
                          </span>
                          <span className="block truncate text-[12.5px] text-ink-muted">{a.reason || 'Consulta'}</span>
                        </span>
                        <span className="hidden min-w-0 text-[12.5px] text-ink-muted sm:block">
                          <span className="block truncate">Dr(a). {a.dentist?.lastName}</span>
                          <span className="block truncate">{a.room?.name || 'Sin sillón'}</span>
                        </span>
                        <Badge cls={APPT_STATUS[a.status]?.cls}>{APPT_STATUS[a.status]?.label}</Badge>
                      </Link>
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="space-y-6">
          <section className="card overflow-hidden">
            <PanelHeader title="Pendientes" />
            {!d ? (
              <div className="p-5"><div className="h-20 animate-pulse rounded bg-slate-50" /></div>
            ) : pending.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-ink-muted">Todo al día.</p>
            ) : (
              <ul>
                {pending.map((p) => (
                  <li key={p.label} className="border-b border-[#edf0f2] last:border-0">
                    <Link href={p.href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50">
                      <Icon name={p.icon} size={16} className={p.tone === 'alert' ? 'text-red-600' : 'text-slate-400'} />
                      <span className="flex-1 text-[13.5px] text-ink">{p.label}</span>
                      <span className={`min-w-[1.75rem] rounded px-1.5 text-center text-[12.5px] font-semibold tabular-nums ${p.tone === 'alert' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-ink-soft'}`}>{p.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card px-5 py-4">
            <h2 className="panel-title mb-3">Accesos</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/appointments', label: 'Agenda', icon: 'calendar' as IconName, ok: true },
                { href: '/invoices', label: 'Caja', icon: 'wallet' as IconName, ok: hasRole('RECEPTIONIST', 'ACCOUNTANT') },
                { href: '/treatment-plans', label: 'Presupuestos', icon: 'clipboard' as IconName, ok: true },
                { href: '/reports', label: 'Reportes', icon: 'chart' as IconName, ok: finance },
                { href: '/inventory', label: 'Inventario', icon: 'package' as IconName, ok: true },
                { href: '/settings', label: 'Configuración', icon: 'settings' as IconName, ok: true },
              ]
                .filter((x) => x.ok)
                .map((x) => (
                  <Link key={x.href} href={x.href} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink">
                    <Icon name={x.icon} size={15} className="text-slate-400" /> {x.label}
                  </Link>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
