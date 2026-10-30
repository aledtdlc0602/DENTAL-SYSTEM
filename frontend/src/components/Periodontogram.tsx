'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';

/**
 * RF-04 Periodontograma digital: 6 puntos por diente (MB, B, DB / ML, L, DL), margen gingival,
 * NIC calculado (sondaje + margen), sangrado al sondaje, movilidad (0-3) y furca (0-3, molares).
 */
const UPPER = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
const LOWER = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];
const isMolar = (t: number) => t % 10 >= 6;

type Site = { probingDepths: number[]; gingivalMargin: number[]; bleeding: boolean[]; mobility: number; furcation: number | null; missing: boolean };
const emptySite = (): Site => ({ probingDepths: [0, 0, 0, 0, 0, 0], gingivalMargin: [0, 0, 0, 0, 0, 0], bleeding: [false, false, false, false, false, false], mobility: 0, furcation: null, missing: false });

const depthColor = (d: number) => (d >= 6 ? 'bg-red-600 text-white' : d >= 4 ? 'bg-amber-300 text-amber-950' : 'bg-white');

function Row({ teeth, sites, idx, kind, set, readOnly }: { teeth: number[]; sites: Record<number, Site>; idx: number[]; kind: 'pd' | 'gm' | 'bop' | 'cal'; set: (t: number, s: Site) => void; readOnly: boolean }) {
  return (
    <>
      {teeth.map((t) => {
        const s = sites[t];
        return (
          <td key={t} className={`px-0.5 py-0.5 ${s.missing ? 'bg-slate-100' : ''}`}>
            <div className="flex justify-center gap-px">
              {idx.map((i) => {
                if (s.missing) return <span key={i} className="w-5" />;
                if (kind === 'bop')
                  return (
                    <button key={i} type="button" disabled={readOnly} onClick={() => set(t, { ...s, bleeding: s.bleeding.map((b, j) => (j === i ? !b : b)) })} className={`h-4 w-5 rounded-sm border ${s.bleeding[i] ? 'border-red-600 bg-red-500' : 'border-slate-200 bg-white'}`} aria-label={`Sangrado ${t} punto ${i + 1}`} />
                  );
                if (kind === 'cal') {
                  const v = s.probingDepths[i] + s.gingivalMargin[i];
                  return <span key={i} className={`w-5 text-center text-[11px] tabular-nums ${v >= 5 ? 'font-semibold text-red-700' : v >= 3 ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>{v}</span>;
                }
                const arr = kind === 'pd' ? s.probingDepths : s.gingivalMargin;
                return (
                  <input
                    key={i}
                    readOnly={readOnly}
                    inputMode="numeric"
                    value={String(arr[i])}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d-]/g, '');
                      const v = raw === '' || raw === '-' ? 0 : Math.max(kind === 'pd' ? 0 : -9, Math.min(15, parseInt(raw, 10)));
                      const next = arr.map((x, j) => (j === i ? v : x));
                      set(t, kind === 'pd' ? { ...s, probingDepths: next } : { ...s, gingivalMargin: next });
                    }}
                    className={`!w-5 !rounded-sm !border-slate-200 !p-0 !text-center !text-[11px] !shadow-none tabular-nums ${kind === 'pd' ? depthColor(arr[i]) : ''}`}
                  />
                );
              })}
            </div>
          </td>
        );
      })}
    </>
  );
}

export default function Periodontogram({ patientId, readOnly = false }: { patientId: string; readOnly?: boolean }) {
  const [sites, setSites] = useState<Record<number, Site>>(() => Object.fromEntries([...UPPER, ...LOWER].map((t) => [t, emptySite()])));
  const [latest, setLatest] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [l, h] = await Promise.all([api(`/periodontogram/patient/${patientId}`).catch(() => null), api(`/periodontogram/patient/${patientId}/history`).catch(() => [])]);
    setLatest(l);
    setHistory(h || []);
    const base: Record<number, Site> = Object.fromEntries([...UPPER, ...LOWER].map((t) => [t, { ...emptySite(), missing: !!l }]));
    for (const s of l?.sites || []) {
      if (!base[s.toothNumber]) continue;
      base[s.toothNumber] = {
        probingDepths: s.probingDepths?.length === 6 ? s.probingDepths : [0, 0, 0, 0, 0, 0],
        gingivalMargin: s.gingivalMargin?.length === 6 ? s.gingivalMargin : [0, 0, 0, 0, 0, 0],
        bleeding: s.bleeding?.length === 6 ? s.bleeding : [false, false, false, false, false, false],
        mobility: s.mobility ?? 0,
        furcation: s.furcation ?? null,
        missing: false,
      };
    }
    setSites(base);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const set = (t: number, s: Site) => setSites((prev) => ({ ...prev, [t]: s }));

  const summary = useMemo(() => {
    const present = Object.values(sites).filter((s) => !s.missing);
    const pd = present.flatMap((s) => s.probingDepths);
    const bop = present.flatMap((s) => s.bleeding);
    const cal = present.flatMap((s) => s.probingDepths.map((d, i) => d + s.gingivalMargin[i]));
    return {
      bleedingPct: bop.length ? Math.round((bop.filter(Boolean).length / bop.length) * 100) : 0,
      gte4: pd.filter((d) => d >= 4).length,
      gte6: pd.filter((d) => d >= 6).length,
      meanPd: pd.length ? (pd.reduce((a, b) => a + b, 0) / pd.length).toFixed(1) : '0',
      maxCal: cal.length ? Math.max(...cal) : 0,
    };
  }, [sites]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const payload = Object.entries(sites)
        .filter(([, s]) => !s.missing)
        .map(([t, s]) => ({ toothNumber: Number(t), probingDepths: s.probingDepths, gingivalMargin: s.gingivalMargin, bleeding: s.bleeding, mobility: s.mobility, furcation: isMolar(Number(t)) ? s.furcation ?? 0 : undefined }));
      await api('/periodontogram', { method: 'POST', body: JSON.stringify({ patientId, notes: notes || undefined, sites: payload }) });
      setNotes('');
      await load();
      setMsg({ text: 'Periodontograma guardado como nueva versión', ok: true });
    } catch (e: any) {
      setMsg({ text: e.message, ok: false });
    } finally {
      setSaving(false);
    }
  }

  const arch = (teeth: number[], title: string, upper: boolean) => (
    <div className="overflow-x-auto">
      <table className="mx-auto text-xs">
        <thead>
          <tr>
            <th className="w-28 text-left text-[11px] font-semibold text-slate-500">{title}</th>
            {teeth.map((t) => (
              <th key={t} className="px-0.5 pb-1">
                <button type="button" disabled={readOnly} onClick={() => set(t, { ...sites[t], missing: !sites[t].missing })} className={`w-full rounded px-1 font-semibold ${sites[t].missing ? 'text-slate-300 line-through' : 'text-slate-700 hover:bg-slate-100'}`} title="Marcar ausente / presente">
                  {t}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            { label: upper ? 'Vestibular · PS' : 'Lingual · PS', idx: upper ? [0, 1, 2] : [3, 4, 5], kind: 'pd' as const },
            { label: 'Margen gingival', idx: upper ? [0, 1, 2] : [3, 4, 5], kind: 'gm' as const },
            { label: 'Sangrado', idx: upper ? [0, 1, 2] : [3, 4, 5], kind: 'bop' as const },
            { label: 'NIC', idx: upper ? [0, 1, 2] : [3, 4, 5], kind: 'cal' as const },
          ].map((r) => (
            <tr key={r.label}>
              <td className="pr-2 text-[11px] text-slate-500">{r.label}</td>
              <Row teeth={teeth} sites={sites} idx={r.idx} kind={r.kind} set={set} readOnly={readOnly} />
            </tr>
          ))}
          <tr>
            <td className="pr-2 text-[11px] text-slate-500">Movilidad / furca</td>
            {teeth.map((t) => (
              <td key={t} className="px-0.5 py-1">
                {!sites[t].missing && (
                  <div className="flex justify-center gap-0.5">
                    <select disabled={readOnly} value={sites[t].mobility} onChange={(e) => set(t, { ...sites[t], mobility: Number(e.target.value) })} className="!w-8 !p-0 !text-[11px] !shadow-none" title="Movilidad">
                      {[0, 1, 2, 3].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    {isMolar(t) && (
                      <select disabled={readOnly} value={sites[t].furcation ?? 0} onChange={(e) => set(t, { ...sites[t], furcation: Number(e.target.value) })} className="!w-8 !p-0 !text-[11px] !shadow-none" title="Furca">
                        {[0, 1, 2, 3].map((v) => <option key={v} value={v}>F{v}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </td>
            ))}
          </tr>
          {[
            { label: upper ? 'Palatino · PS' : 'Vestibular · PS', idx: upper ? [3, 4, 5] : [0, 1, 2], kind: 'pd' as const },
            { label: 'Margen gingival', idx: upper ? [3, 4, 5] : [0, 1, 2], kind: 'gm' as const },
            { label: 'Sangrado', idx: upper ? [3, 4, 5] : [0, 1, 2], kind: 'bop' as const },
            { label: 'NIC', idx: upper ? [3, 4, 5] : [0, 1, 2], kind: 'cal' as const },
          ].map((r) => (
            <tr key={r.label + '2'}>
              <td className="pr-2 text-[11px] text-slate-500">{r.label}</td>
              <Row teeth={teeth} sites={sites} idx={r.idx} kind={r.kind} set={set} readOnly={readOnly} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold">Periodontograma</h3>
          <p className="text-xs text-slate-500">
            {latest ? `Versión ${latest.version} · ${fmtDateTime(latest.createdAt)}` : 'Sin registros previos'} · PS = profundidad de sondaje (mm) · NIC = PS + margen (calculado)
          </p>
        </div>
        <div className="grid grid-cols-5 gap-3 text-center text-xs">
          <div><div className="text-lg font-semibold">{summary.bleedingPct}%</div><div className="text-slate-500">Sangrado</div></div>
          <div><div className="text-lg font-semibold">{summary.meanPd}</div><div className="text-slate-500">PS media</div></div>
          <div><div className="text-lg font-semibold text-amber-600">{summary.gte4}</div><div className="text-slate-500">Sitios ≥4</div></div>
          <div><div className="text-lg font-semibold text-red-600">{summary.gte6}</div><div className="text-slate-500">Sitios ≥6</div></div>
          <div><div className="text-lg font-semibold">{summary.maxCal}</div><div className="text-slate-500">NIC máx.</div></div>
        </div>
      </div>
      {latest?.summary?.stageHint && <p className="mb-3 text-xs text-slate-500">Orientación diagnóstica (AAP/EFP 2017, NIC máximo): <strong>{latest.summary.stageHint}</strong></p>}

      <div className="space-y-6">
        {arch(UPPER, 'Arcada superior', true)}
        <div className="border-t border-dashed border-slate-200" />
        {arch(LOWER, 'Arcada inferior', false)}
      </div>

      {msg && <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}
      {!readOnly && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input className="sm:max-w-sm" placeholder="Notas / diagnóstico (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar periodontograma'}</button>
        </div>
      )}

      {history.length > 1 && (
        <div className="mt-6">
          <div className="mb-2 text-sm font-semibold">Evolución</div>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500"><th className="py-1">Versión</th><th>Fecha</th><th>Sangrado</th><th>PS media</th><th>Sitios ≥4</th><th>NIC máx.</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-slate-100">
                  <td className="py-1">v{h.version}</td><td>{fmtDateTime(h.createdAt)}</td><td>{h.summary.bleedingPct}%</td><td>{h.summary.meanProbingDepth}</td><td>{h.summary.sitesGte4}</td><td>{h.summary.maxAttachmentLoss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
