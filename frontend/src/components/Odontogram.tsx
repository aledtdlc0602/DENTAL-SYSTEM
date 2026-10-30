'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';

/**
 * RF-03 Odontograma gráfico interactivo:
 * - Dentición permanente (32) y temporal (20), notación FDI o Universal.
 * - Marcado por superficie: mesial, distal, oclusal/incisal, vestibular, lingual/palatino.
 * - Colores: hallazgos/pendientes en ROJO, realizados/existentes en AZUL, sellantes en verde.
 * - RN-01: lo registrado como Realizado no puede quitarse (el servidor además lo conserva entre versiones).
 */

const PERM_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const PERM_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const DEC_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const DEC_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

/** FDI → Universal (ADA). */
export function toUniversal(fdi: number): string {
  const q = Math.floor(fdi / 10);
  const n = fdi % 10;
  if (q === 1) return String(9 - n);
  if (q === 2) return String(8 + n);
  if (q === 3) return String(25 - n);
  if (q === 4) return String(24 + n);
  if (q === 5) return 'ABCDE'[5 - n];
  if (q === 6) return 'FGHIJ'[n - 1];
  if (q === 7) return 'KLMNO'[5 - n];
  if (q === 8) return 'PQRST'[n - 1];
  return String(fdi);
}

type Cond = { value: string; label: string; scope: 'surface' | 'tooth'; mark?: string };
const CONDITIONS: Cond[] = [
  { value: 'CARIES', label: 'Caries', scope: 'surface' },
  { value: 'FILLING', label: 'Obturación / restauración', scope: 'surface' },
  { value: 'SEALANT', label: 'Sellante', scope: 'surface' },
  { value: 'FRACTURE', label: 'Fractura', scope: 'tooth', mark: 'FX' },
  { value: 'ENDODONTICS', label: 'Endodoncia', scope: 'tooth', mark: 'TC' },
  { value: 'CROWN', label: 'Corona', scope: 'tooth' },
  { value: 'BRIDGE', label: 'Puente (prótesis fija)', scope: 'tooth', mark: 'PF' },
  { value: 'PROSTHESIS', label: 'Prótesis removible', scope: 'tooth', mark: 'PR' },
  { value: 'IMPLANT', label: 'Implante', scope: 'tooth', mark: 'IMP' },
  { value: 'EXTRACTION_INDICATED', label: 'Exodoncia indicada', scope: 'tooth' },
  { value: 'MISSING', label: 'Ausente / extraído', scope: 'tooth' },
];
const LABEL: Record<string, string> = Object.fromEntries(CONDITIONS.map((c) => [c.value, c.label]));
const SURFACE_LABEL: Record<string, string> = { M: 'Mesial', D: 'Distal', O: 'Oclusal', I: 'Incisal', V: 'Vestibular', L: 'Lingual/Palatino' };
const RED = '#dc2626';
const BLUE = '#2563eb';
const GREEN = '#16a34a';

type Rec = { toothNumber: number; surface: string | null; condition: string; status: string; notes?: string | null; locked?: boolean };

function colorOf(r: Rec) {
  if (r.condition === 'SEALANT') return GREEN;
  if (r.condition === 'CARIES') return RED;
  return r.status === 'DONE' ? BLUE : RED;
}

/** Qué superficie corresponde a cada zona del dibujo según el cuadrante. */
function regions(t: number) {
  const q = Math.floor(t / 10);
  const upper = [1, 2, 5, 6].includes(q);
  const rightSide = [1, 4, 5, 8].includes(q); // lado derecho del paciente = izquierda en pantalla
  const posterior = t % 10 >= 4;
  return {
    top: upper ? 'V' : 'L',
    bottom: upper ? 'L' : 'V',
    left: rightSide ? 'D' : 'M',
    right: rightSide ? 'M' : 'D',
    center: posterior ? 'O' : 'I',
  };
}

const POLY: Record<'top' | 'right' | 'bottom' | 'left', string> = {
  top: '0,0 40,0 28,12 12,12',
  right: '40,0 40,40 28,28 28,12',
  bottom: '40,40 0,40 12,28 28,28',
  left: '0,40 0,0 12,12 12,28',
};

function Tooth({
  n, recs, selected, label, onSurface, onTooth,
}: { n: number; recs: Rec[]; selected: boolean; label: string; onSurface: (s: string) => void; onTooth: () => void }) {
  const reg = regions(n);
  const surf = (s: string) => recs.find((r) => r.surface === s);
  const whole = recs.filter((r) => !r.surface);
  const missing = whole.find((r) => r.condition === 'MISSING');
  const extraction = whole.find((r) => r.condition === 'EXTRACTION_INDICATED');
  const crown = whole.find((r) => r.condition === 'CROWN');
  const marks = whole.filter((r) => CONDITIONS.find((c) => c.value === r.condition)?.mark);
  const fill = (s: string) => {
    const r = surf(s);
    return r ? colorOf(r) : '#ffffff';
  };
  const upper = [1, 2, 5, 6].includes(Math.floor(n / 10));
  const number = (
    <button type="button" onClick={onTooth} className={`text-[11px] font-semibold tabular-nums ${selected ? 'text-brand-700' : 'text-slate-500'}`}>
      {label}
    </button>
  );
  return (
    <div className={`flex flex-col items-center gap-0.5 rounded-lg p-0.5 ${selected ? 'bg-brand-50 ring-2 ring-brand-400' : ''}`}>
      {upper && number}
      <svg viewBox="-3 -3 46 46" width={44} height={44} className="cursor-pointer select-none" role="img" aria-label={`Diente ${n}`}>
        {(['top', 'right', 'bottom', 'left'] as const).map((k) => (
          <polygon key={k} points={POLY[k]} fill={fill(reg[k])} stroke="#94a3b8" strokeWidth={1} onClick={() => onSurface(reg[k])}>
            <title>{`${n} · ${SURFACE_LABEL[reg[k]]}${surf(reg[k]) ? ` · ${LABEL[surf(reg[k])!.condition]}` : ''}`}</title>
          </polygon>
        ))}
        <rect x={12} y={12} width={16} height={16} fill={fill(reg.center)} stroke="#94a3b8" strokeWidth={1} onClick={() => onSurface(reg.center)}>
          <title>{`${n} · ${SURFACE_LABEL[reg.center]}`}</title>
        </rect>
        {crown && <circle cx={20} cy={20} r={22} fill="none" stroke={colorOf(crown)} strokeWidth={3} pointerEvents="none" />}
        {(missing || extraction) && (
          <g stroke={missing ? '#0f172a' : RED} strokeWidth={4} strokeLinecap="round" pointerEvents="none">
            <line x1={2} y1={2} x2={38} y2={38} />
            <line x1={38} y1={2} x2={2} y2={38} />
          </g>
        )}
      </svg>
      {!upper && number}
      <div className="flex h-3 gap-0.5">
        {marks.map((m, i) => (
          <span key={i} className="rounded px-0.5 text-[8px] font-semibold leading-3 text-white" style={{ background: colorOf(m) }}>
            {CONDITIONS.find((c) => c.value === m.condition)?.mark}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Odontogram({ patientId, readOnly = false, onSaved }: { patientId: string; readOnly?: boolean; onSaved?: () => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [viewVersion, setViewVersion] = useState<string>('current');
  const [recs, setRecs] = useState<Rec[]>([]);
  const [dentition, setDentition] = useState<'permanent' | 'deciduous'>('permanent');
  const [notation, setNotation] = useState<'FDI' | 'UNIVERSAL'>('FDI');
  const [tool, setTool] = useState<{ condition: string; status: string } | 'ERASE'>({ condition: 'CARIES', status: 'PENDING' });
  const [selected, setSelected] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function load() {
    const h = await api(`/odontogram/patient/${patientId}/history`).catch(() => []);
    setHistory(h);
    const latest = h[0];
    setRecs((latest?.teeth || []).map((t: any) => ({ ...t, locked: t.status === 'DONE' })));
    if (latest?.teeth?.some((t: any) => t.toothNumber > 50) && !latest.teeth.some((t: any) => t.toothNumber < 50)) setDentition('deciduous');
    setDirty(false);
    setViewVersion('current');
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const viewing = viewVersion === 'current' ? null : history.find((h) => h.id === viewVersion);
  const shown: Rec[] = viewing ? viewing.teeth : recs;
  const editable = !readOnly && !viewing;
  const byTooth = useMemo(() => {
    const m = new Map<number, Rec[]>();
    for (const r of shown) m.set(r.toothNumber, [...(m.get(r.toothNumber) || []), r]);
    return m;
  }, [shown]);

  function flash(text: string, tone: 'ok' | 'err' = 'err') {
    setMsg({ text, tone });
    setTimeout(() => setMsg(null), 3500);
  }

  function apply(n: number, surface: string | null) {
    setSelected(n);
    if (!editable) return;
    if (tool === 'ERASE') {
      const target = recs.filter((r) => r.toothNumber === n && (surface === null || r.surface === surface));
      if (target.some((r) => r.locked)) flash('Un procedimiento realizado no se puede borrar. Registre la corrección como adenda en la evolución.');
      setRecs(recs.filter((r) => !(target.includes(r) && !r.locked)));
      setDirty(true);
      return;
    }
    const cond = CONDITIONS.find((c) => c.value === tool.condition)!;
    if (cond.scope === 'surface' && surface === null) return; // clic en el número: solo selecciona
    const s = cond.scope === 'tooth' ? null : surface;
    const exists = recs.find((r) => r.toothNumber === n && r.surface === s && r.condition === tool.condition);
    if (exists) {
      if (exists.locked) return flash('Ya registrado como Realizado (no editable).');
      setRecs(recs.filter((r) => r !== exists));
    } else {
      // En una superficie solo puede haber un hallazgo activo no realizado
      const rest = recs.filter((r) => !(r.toothNumber === n && r.surface === s && !r.locked && cond.scope === 'surface'));
      setRecs([...rest, { toothNumber: n, surface: s, condition: tool.condition, status: tool.status }]);
    }
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await api('/odontogram', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          notes: notes || undefined,
          teeth: recs.map((r) => ({ toothNumber: r.toothNumber, surface: r.surface || undefined, condition: r.condition, status: r.status, notes: r.notes || undefined })),
        }),
      });
      setNotes('');
      await load();
      flash('Nueva versión del odontograma guardada', 'ok');
      onSaved?.();
    } catch (e: any) {
      flash(e.message);
    } finally {
      setSaving(false);
    }
  }

  const label = (n: number) => (notation === 'FDI' ? String(n) : toUniversal(n));
  const UPPER = dentition === 'permanent' ? PERM_UPPER : DEC_UPPER;
  const LOWER = dentition === 'permanent' ? PERM_LOWER : DEC_LOWER;
  const selectedRecs = selected ? byTooth.get(selected) || [] : [];
  const pending = shown.filter((r) => r.status !== 'DONE' && r.condition !== 'MISSING');
  const done = shown.filter((r) => r.status === 'DONE');

  const toggle = (opts: [string, string][], value: string, set: (v: any) => void) => (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
      {opts.map(([v, l]) => (
        <button key={v} type="button" onClick={() => set(v)} className={`rounded-md px-2.5 py-1 ${value === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold">Odontograma</h3>
          <p className="text-xs text-slate-500">
            {history.length ? `Versión ${history[0].version} · ${fmtDateTime(history[0].createdAt)}` : 'Sin registros previos'}
            {dirty && <span className="ml-2 font-semibold text-amber-600">· cambios sin guardar</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toggle([['permanent', 'Permanente (32)'], ['deciduous', 'Temporal (20)']], dentition, setDentition)}
          {toggle([['FDI', 'FDI'], ['UNIVERSAL', 'Universal']], notation, setNotation)}
          {history.length > 1 && (
            <select className="!w-auto !py-1 text-xs" value={viewVersion} onChange={(e) => setViewVersion(e.target.value)}>
              <option value="current">Versión actual</option>
              {history.slice(1).map((h) => (
                <option key={h.id} value={h.id}>v{h.version} · {fmtDateTime(h.createdAt)}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {viewing && <div className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">Viendo versión histórica v{viewing.version} (solo lectura)</div>}

      {editable && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-medium text-ink-muted mr-1">Herramienta:</span>
          {CONDITIONS.map((c) => {
            const active = tool !== 'ERASE' && tool.condition === c.value;
            const preview = colorOf({ toothNumber: 0, surface: null, condition: c.value, status: tool !== 'ERASE' ? tool.status : 'PENDING' });
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setTool({ condition: c.value, status: c.value === 'CARIES' || c.value === 'EXTRACTION_INDICATED' ? 'PENDING' : tool !== 'ERASE' ? tool.status : 'PENDING' })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: preview }} />
                {c.label}
              </button>
            );
          })}
          <button type="button" onClick={() => setTool('ERASE')} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tool === 'ERASE' ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200 text-slate-600'}`}>
            Borrar
          </button>
          {tool !== 'ERASE' && !['CARIES', 'EXTRACTION_INDICATED'].includes(tool.condition) && (
            <div className="ml-auto">
              {toggle([['PENDING', 'Requerido (rojo)'], ['DONE', 'Realizado / existente (azul)']], tool.status, (s: string) => setTool({ ...tool, status: s }))}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="mx-auto w-max space-y-3">
          {[UPPER, LOWER].map((row, ri) => (
            <div key={ri} className="flex items-start">
              {row.map((n, i) => (
                <div key={n} className={`flex ${i === row.length / 2 ? 'ml-3 border-l-2 border-dashed border-slate-200 pl-3' : ''}`}>
                  <Tooth n={n} recs={byTooth.get(n) || []} selected={selected === n} label={label(n)} onSurface={(s) => apply(n, s)} onTooth={() => apply(n, null)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: RED }} /> Caries / tratamiento requerido</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: BLUE }} /> Realizado / existente</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: GREEN }} /> Sellante</span>
        <span>✕ negro = ausente · ✕ rojo = exodoncia indicada · ○ = corona</span>
      </div>

      {msg && <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      {selected && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
          <div className="font-semibold mb-2">Diente {selected} (FDI) · {toUniversal(selected)} (Universal)</div>
          {selectedRecs.length === 0 ? (
            <p className="text-slate-400">Sin hallazgos.</p>
          ) : (
            <ul className="space-y-1">
              {selectedRecs.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(r) }} />
                  {LABEL[r.condition] || r.condition}
                  {r.surface && <span className="text-slate-500">· {SURFACE_LABEL[r.surface]}</span>}
                  <span className="text-slate-400">· {r.status === 'DONE' ? 'Realizado' : r.status === 'PLANNED' ? 'Planificado' : 'Pendiente'}</span>
                  {r.locked && <span className="rounded bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-600">BLOQUEADO</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
        <div>
          <div className="mb-1 font-semibold text-red-700">Pendientes ({pending.length})</div>
          <ul className="space-y-0.5 text-slate-600">
            {pending.slice(0, 12).map((r, i) => <li key={i}>{label(r.toothNumber)} · {LABEL[r.condition]}{r.surface ? ` (${r.surface})` : ''}</li>)}
          </ul>
        </div>
        <div>
          <div className="mb-1 font-semibold text-blue-700">Realizados ({done.length})</div>
          <ul className="space-y-0.5 text-slate-600">
            {done.slice(0, 12).map((r, i) => <li key={i}>{label(r.toothNumber)} · {LABEL[r.condition]}{r.surface ? ` (${r.surface})` : ''}</li>)}
          </ul>
        </div>
      </div>

      {editable && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input className="sm:max-w-sm" placeholder="Nota de esta versión (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button type="button" className="btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Guardando…' : 'Guardar nueva versión'}
          </button>
          {dirty && <button type="button" className="btn-secondary" onClick={load}>Descartar cambios</button>}
        </div>
      )}
    </div>
  );
}
