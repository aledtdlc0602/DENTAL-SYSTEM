'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icons';
import PatientPicker from '@/components/PatientPicker';
import { AlertBadges, Badge, ErrorBox, Modal, Notice, PageHeader } from '@/components/ui';
import { api, hasRole } from '@/lib/api';
import { APPT_STATUS, APPT_TRANSITIONS, addDays, capitalize, dateKey, drName, fmtDateTime, fmtTime, fullName, startOfDay, toLocalInput, plural } from '@/lib/format';

const START_H = 7;
const END_H = 20;
const SLOT = 30; // minutos
const ROW = 36; // px por slot
const STATUS_BG: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 border-blue-500 text-slate-800',
  CONFIRMED: 'bg-emerald-50 border-emerald-600 text-slate-800',
  WAITING: 'bg-amber-50 border-amber-500 text-slate-800',
  IN_PROGRESS: 'bg-violet-50 border-violet-500 text-slate-800',
  COMPLETED: 'bg-slate-100 border-slate-400 text-slate-500',
  CANCELLED: 'bg-white border-red-300 text-slate-400 line-through',
  NO_SHOW: 'bg-orange-50 border-orange-400 text-slate-500',
};

function mondayOf(d: Date) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;
  return addDays(x, -dow);
}

/** Reparte citas que se solapan en carriles para dibujarlas lado a lado. */
function lanes(list: any[]) {
  const sorted = [...list].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  const ends: number[] = [];
  const out = sorted.map((a) => {
    const s = +new Date(a.startAt);
    let lane = ends.findIndex((e) => e <= s);
    if (lane === -1) {
      lane = ends.length;
      ends.push(0);
    }
    ends[lane] = +new Date(a.endAt);
    return { a, lane };
  });
  return { items: out, count: Math.max(1, ends.length) };
}

export default function AppointmentsPage() {
  const [view, setView] = useState<'day' | 'week'>('day');
  const [groupBy, setGroupBy] = useState<'room' | 'dentist'>('room');
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [dentistId, setDentistId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [appts, setAppts] = useState<any[]>([]);
  const [dentists, setDentists] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [creating, setCreating] = useState<any>(null);
  const canWrite = hasRole('DENTIST', 'ASSISTANT', 'RECEPTIONIST');

  const range = useMemo(() => {
    const from = view === 'day' ? date : mondayOf(date);
    const to = addDays(from, view === 'day' ? 1 : 6);
    return { from, to };
  }, [view, date]);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ from: range.from.toISOString(), to: new Date(range.to.getTime() - 1).toISOString() });
      if (dentistId) qs.set('dentistId', dentistId);
      if (roomId) qs.set('roomId', roomId);
      setAppts(await api(`/appointments?${qs}`));
    } catch (e: any) {
      setError(e.message);
    }
  }, [range, dentistId, roomId]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    Promise.all([api('/users/dentists'), api('/rooms'), api('/procedures')])
      .then(([d, r, p]) => { setDentists(d); setRooms(r); setProcedures(p); })
      .catch((e) => setError(e.message));
  }, []);

  const visible = appts.filter((a) => showCancelled || !['CANCELLED'].includes(a.status));
  const days = view === 'day' ? [date] : Array.from({ length: 6 }, (_, i) => addDays(range.from, i));
  const columns: { key: string; title: string; filter: (a: any) => boolean; day: Date; roomId?: string; dentistId?: string }[] =
    view === 'week'
      ? days.map((d) => ({ key: dateKey(d), title: capitalize(d.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })), day: d, filter: (a: any) => dateKey(new Date(a.startAt)) === dateKey(d) }))
      : groupBy === 'room'
        ? [
            ...rooms.filter((r) => !roomId || r.id === roomId).filter((r) => roomId || visible.some((a) => a.roomId === r.id) || rooms.length <= 8).map((r) => ({ key: r.id, title: r.name, roomId: r.id, day: date, filter: (a: any) => a.roomId === r.id })),
            ...(visible.some((a) => !a.roomId) ? [{ key: 'none', title: 'Sin sillón', day: date, filter: (a: any) => !a.roomId }] : []),
          ]
        : dentists.filter((d) => !dentistId || d.id === dentistId).map((d) => ({ key: d.id, title: `${d.firstName} ${d.lastName}`, dentistId: d.id, day: date, filter: (a: any) => a.dentistId === d.id }));

  const shift = (n: number) => setDate(addDays(date, view === 'day' ? n : n * 7));
  const slots = Array.from({ length: ((END_H - START_H) * 60) / SLOT }, (_, i) => START_H * 60 + i * SLOT);

  function openCreate(day: Date, minutes: number, col?: { roomId?: string; dentistId?: string }) {
    if (!canWrite) return;
    const start = new Date(day);
    start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    setCreating({ start: toLocalInput(start), roomId: col?.roomId || roomId || '', dentistId: col?.dentistId || dentistId || '', duration: 30, patient: null, procedureId: '', reason: '', notes: '' });
  }

  const counts = visible.reduce((m: any, a) => ((m[a.status] = (m[a.status] || 0) + 1), m), {});

  return (
    <AppShell>
      <PageHeader
        title="Agenda"
        subtitle="Citas por día o semana. Un sillón no admite dos citas al mismo tiempo."
        actions={canWrite && <button className="btn-primary" onClick={() => openCreate(date, 9 * 60)}><Icon name="plus" size={18} /> Nueva cita</button>}
      />
      <ErrorBox error={error} onClose={() => setError('')} />

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-2.5 [&_select]:!h-9 [&_select]:!min-h-0 [&_select]:!py-0 [&_select]:!text-[13.5px] [&_input[type=date]]:!h-9 [&_input[type=date]]:!min-h-0 [&_input[type=date]]:!py-0">
        <div className="inline-flex h-9 rounded-md border border-line bg-[#f3f5f7] p-0.5 text-[13.5px] font-medium">
          {(['day', 'week'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded px-3 ${view === v ? 'bg-white text-ink shadow-[0_1px_2px_rgb(24_34_45/0.12)]' : 'text-ink-muted'}`}>{v === 'day' ? 'Día' : 'Semana'}</button>
          ))}
        </div>
        <button className="btn-secondary !w-9 !px-0" onClick={() => shift(-1)} aria-label="Anterior"><Icon name="chevron-left" size={18} /></button>
        <button className="btn-secondary" onClick={() => setDate(startOfDay(new Date()))}>Hoy</button>
        <button className="btn-secondary !w-9 !px-0" onClick={() => shift(1)} aria-label="Siguiente"><Icon name="chevron-right" size={18} /></button>
        <input type="date" className="!w-auto" value={dateKey(date)} onChange={(e) => e.target.value && setDate(startOfDay(new Date(e.target.value + 'T00:00')))} />
        <span className="px-1 text-[14px] font-semibold text-ink">
          {view === 'day' ? capitalize(date.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })) : `Semana del ${range.from.toLocaleDateString('es-EC', { day: 'numeric', month: 'long' })}`}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="!w-auto" value={dentistId} onChange={(e) => setDentistId(e.target.value)}>
            <option value="">Todos los odontólogos</option>
            {dentists.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
          </select>
          <select className="!w-auto" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Todos los sillones</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {view === 'day' && (
            <select className="!w-auto" value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}>
              <option value="room">Columnas: sillón</option>
              <option value="dentist">Columnas: odontólogo</option>
            </select>
          )}
          <label className="inline-flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Canceladas</label>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {Object.entries(APPT_STATUS).map(([k, v]) => (counts[k] ? <Badge key={k} cls={v.cls}>{v.label}: {counts[k]}</Badge> : null))}
        <span className="text-slate-400">{plural(visible.length, 'cita')}</span>
      </div>

      <div className="card overflow-auto">
        <div className="grid min-w-max" style={{ gridTemplateColumns: `56px repeat(${Math.max(columns.length, 1)}, minmax(${view === 'week' ? 150 : 170}px, 1fr))` }}>
          <div className="sticky left-0 top-0 z-20 border-b border-r border-slate-100 bg-white" />
          {columns.map((c) => (
            <div key={c.key} className="sticky top-0 z-10 border-b border-r border-line bg-[#f8fafb] px-2 py-2.5 text-center text-[12.5px] font-semibold text-ink">{c.title}</div>
          ))}
          {columns.length === 0 && <div className="p-6 text-sm text-slate-400">Sin columnas para mostrar</div>}

          <div className="sticky left-0 z-10 border-r border-slate-100 bg-white">
            {slots.map((m) => (
              <div key={m} style={{ height: ROW }} className="pr-1 text-right text-[10px] text-slate-400 tabular-nums">
                {m % 60 === 0 ? `${String(m / 60).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>

          {columns.map((c) => {
            const { items, count } = lanes(visible.filter(c.filter));
            return (
              <div key={c.key} className="relative border-r border-slate-100" style={{ height: slots.length * ROW }}>
                {slots.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-label="Agendar en este horario"
                    onClick={() => openCreate(c.day, m, c)}
                    className={`block w-full border-b ${m % 60 === 0 ? 'border-slate-100' : 'border-slate-50'} hover:bg-brand-50/60`}
                    style={{ height: ROW }}
                  />
                ))}
                {items.map(({ a, lane }) => {
                  const s = new Date(a.startAt);
                  const e = new Date(a.endAt);
                  const top = ((s.getHours() * 60 + s.getMinutes() - START_H * 60) / SLOT) * ROW;
                  const height = Math.max(ROW - 2, ((e.getTime() - s.getTime()) / 60000 / SLOT) * ROW - 2);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setSelected(a)}
                      className={`absolute overflow-hidden rounded border-l-[3px] px-1.5 py-1 text-left text-[11.5px] leading-tight ring-1 ring-inset ring-black/5 hover:z-10 hover:ring-black/15 ${STATUS_BG[a.status]}`}
                      style={{ top: Math.max(0, top) + 1, height, left: `calc(${(lane / count) * 100}% + 2px)`, width: `calc(${100 / count}% - 4px)` }}
                      title={`${fmtTime(a.startAt)}–${fmtTime(a.endAt)} ${fullName(a.patient)} · ${a.reason || ''}`}
                    >
                      <div className="flex items-center gap-1 font-semibold tabular-nums">
                        {fmtTime(a.startAt)} {a.patient?.medicalHistory?.alerts?.length ? <Icon name="alert" size={11} className="text-red-600" /> : null}
                      </div>
                      <div className="truncate font-semibold">{fullName(a.patient)}</div>
                      <div className="truncate opacity-80">{a.reason}</div>
                      {view === 'week' || groupBy === 'dentist' ? <div className="truncate opacity-70">{a.room?.name}</div> : <div className="truncate opacity-70">{a.dentist?.lastName}</div>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {selected && <AppointmentDetail appt={selected} canWrite={canWrite} dentists={dentists} rooms={rooms} onClose={() => setSelected(null)} onChanged={(a) => { load(); if (a) setSelected(a); }} />}
      {creating && <CreateAppointment initial={creating} dentists={dentists} rooms={rooms} procedures={procedures} onClose={() => setCreating(null)} onCreated={() => { setCreating(null); load(); }} />}
    </AppShell>
  );
}

function AppointmentDetail({ appt, canWrite, dentists, rooms, onClose, onChanged }: { appt: any; canWrite: boolean; dentists: any[]; rooms: any[]; onClose: () => void; onChanged: (a?: any) => void }) {
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resched, setResched] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function changeStatus(status: string) {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await api(`/appointments/${appt.id}/status/${status}`, { method: 'PATCH' });
      if (res.inventory?.length) {
        const fails = res.inventory.filter((i: any) => !i.ok);
        setInfo(`Se descargaron ${plural(res.inventory.length - fails.length, 'insumo')} del inventario${fails.length ? ` · ${fails.length} sin stock suficiente` : ''}.`);
      }
      onChanged({ ...appt, ...res });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveResched(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const start = new Date(resched.start);
      const end = new Date(start.getTime() + resched.duration * 60000);
      const res = await api(`/appointments/${appt.id}`, { method: 'PATCH', body: JSON.stringify({ startAt: start.toISOString(), endAt: end.toISOString(), roomId: resched.roomId || undefined, dentistId: resched.dentistId }) });
      setResched(null);
      onChanged(res);
    } catch (err: any) {
      setError(err.message);
    }
  }
  async function remind() {
    try {
      const r = await api(`/notifications/appointment/${appt.id}/reminders`, { method: 'POST' });
      setInfo(r.length ? `Recordatorio enviado por ${r.map((x: any) => x.channel).join(' y ')}` : 'El recordatorio ya había sido enviado');
    } catch (e: any) {
      setError(e.message);
    }
  }

  const next = APPT_TRANSITIONS[appt.status] || [];
  const editable = !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appt.status);
  const dur = Math.round((+new Date(appt.endAt) - +new Date(appt.startAt)) / 60000);

  return (
    <Modal open title="Detalle de la cita" onClose={onClose}>
      <ErrorBox error={error} />
      {info && <Notice tone="success">{info}</Notice>}
      <div className="space-y-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/patients/${appt.patient?.id}`} className="text-base font-semibold hover:text-brand-700">{fullName(appt.patient)}</Link>
            <div className="text-slate-500">{appt.patient?.documentNumber} · {appt.patient?.phone}</div>
          </div>
          <Badge cls={APPT_STATUS[appt.status]?.cls}>{APPT_STATUS[appt.status]?.label}</Badge>
        </div>
        <AlertBadges alerts={appt.patient?.medicalHistory?.alerts} />
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
          <div><div className="text-xs text-slate-500">Fecha</div><div className="font-medium">{fmtDateTime(appt.startAt)} ({dur} min)</div></div>
          <div><div className="text-xs text-slate-500">Odontólogo</div><div className="font-medium">{drName(appt.dentist)}</div></div>
          <div><div className="text-xs text-slate-500">Sillón</div><div className="font-medium">{appt.room?.name || '—'}</div></div>
          <div><div className="text-xs text-slate-500">Procedimiento</div><div className="font-medium">{appt.procedure?.name || appt.reason || '—'}</div></div>
          {appt.notes && <div className="col-span-2"><div className="text-xs text-slate-500">Notas</div><div>{appt.notes}</div></div>}
        </div>

        {canWrite && next.length > 0 && (
          <div>
            <div className="label">Cambiar estado</div>
            <div className="flex flex-wrap gap-2">
              {next.map((s) => (
                <button key={s} disabled={busy} onClick={() => changeStatus(s)} className={`btn ${s === 'CANCELLED' || s === 'NO_SHOW' ? 'bg-white border border-red-200 text-red-700 hover:bg-red-50' : s === 'COMPLETED' ? 'btn-primary' : 'btn-secondary'} !py-1.5 text-xs`}>
                  {APPT_STATUS[s].label}
                </button>
              ))}
            </div>
          </div>
        )}

        {canWrite && editable && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button className="btn-secondary !py-1.5 text-xs" onClick={() => setResched({ start: toLocalInput(new Date(appt.startAt)), duration: dur, roomId: appt.roomId || '', dentistId: appt.dentistId })}><Icon name="edit" size={14} /> Reprogramar</button>
            <button className="btn-secondary !py-1.5 text-xs" onClick={remind}><Icon name="bell" size={14} /> Enviar recordatorio</button>
          </div>
        )}

        {resched && (
          <form onSubmit={saveResched} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
            <div><label className="label">Inicio</label><input type="datetime-local" value={resched.start} onChange={(e) => setResched({ ...resched, start: e.target.value })} required /></div>
            <div><label className="label">Duración (min)</label><input type="number" min={10} step={5} value={resched.duration} onChange={(e) => setResched({ ...resched, duration: Number(e.target.value) })} /></div>
            <div><label className="label">Odontólogo</label><select value={resched.dentistId} onChange={(e) => setResched({ ...resched, dentistId: e.target.value })}>{dentists.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}</select></div>
            <div><label className="label">Sillón</label><select value={resched.roomId} onChange={(e) => setResched({ ...resched, roomId: e.target.value })}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
            <div className="sm:col-span-2 flex gap-2"><button className="btn-primary !py-1.5">Guardar</button><button type="button" className="btn-secondary !py-1.5" onClick={() => setResched(null)}>Cancelar</button></div>
          </form>
        )}
      </div>
    </Modal>
  );
}

function CreateAppointment({ initial, dentists, rooms, procedures, onClose, onCreated }: { initial: any; dentists: any[]; rooms: any[]; procedures: any[]; onClose: () => void; onCreated: () => void }) {
  const [f, setF] = useState<any>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.patient) return setError('Seleccione un paciente');
    setSaving(true);
    setError('');
    try {
      const start = new Date(f.start);
      await api('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: f.patient.id,
          dentistId: f.dentistId,
          roomId: f.roomId || undefined,
          procedureId: f.procedureId || undefined,
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + Number(f.duration) * 60000).toISOString(),
          reason: f.reason || undefined,
          notes: f.notes || undefined,
        }),
      });
      onCreated();
    } catch (err: any) {
      const c = err.data?.conflict;
      setError(c ? `${err.message} (${fmtTime(c.startAt)}–${fmtTime(c.endAt)}${c.patient ? ` · ${c.patient}` : ''})` : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Nueva cita" onClose={onClose} width="max-w-xl">
      <form onSubmit={submit} className="space-y-3">
        <ErrorBox error={error} />
        <div><label className="label">Paciente *</label><PatientPicker value={f.patient} onChange={(p) => setF({ ...f, patient: p })} /></div>
        <div>
          <label className="label">Procedimiento</label>
          <select value={f.procedureId} onChange={(e) => { const p = procedures.find((x) => x.id === e.target.value); setF({ ...f, procedureId: e.target.value, duration: p?.durationMin ? Math.ceil(p.durationMin / 15) * 15 : f.duration, reason: p?.name || f.reason }); }}>
            <option value="">— (consulta / sin procedimiento)</option>
            {procedures.map((p) => <option key={p.id} value={p.id}>{p.category} · {p.name}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Odontólogo *</label><select value={f.dentistId} onChange={(e) => setF({ ...f, dentistId: e.target.value })} required><option value="">Seleccionar…</option>{dentists.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}{d.specialties?.length ? ` · ${d.specialties.join(', ')}` : ''}</option>)}</select></div>
          <div><label className="label">Sillón / consultorio</label><select value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}><option value="">—</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
          <div><label className="label">Inicio *</label><input type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} required /></div>
          <div><label className="label">Duración (min)</label><input type="number" min={10} step={5} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></div>
        </div>
        <div><label className="label">Motivo</label><input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        <div><label className="label">Notas</label><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        <p className="text-xs text-slate-400">Al agendar se envía la confirmación al paciente; los recordatorios de 48 h y 24 h salen automáticamente </p>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" disabled={saving}>{saving ? 'Agendando…' : 'Agendar'}</button></div>
      </form>
    </Modal>
  );
}
