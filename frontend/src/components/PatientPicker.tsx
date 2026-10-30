'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AlertBadges } from './ui';

/** Buscador de pacientes con autocompletado. */
export default function PatientPicker({ value, onChange }: { value: any | null; onChange: (p: any | null) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api(`/patients?search=${encodeURIComponent(q)}&limit=8`).then((r) => setResults(r.data || [])).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{value.firstName} {value.lastName}</span>
          <span className="text-slate-500">{value.documentNumber}</span>
          <AlertBadges alerts={value.medicalHistory?.alerts} compact />
        </div>
        <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => onChange(null)}>Cambiar</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input placeholder="Buscar paciente por nombre o cédula…" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => { onChange(p); setOpen(false); setQ(''); }}>
                <span><span className="font-medium">{p.lastName}, {p.firstName}</span> <span className="text-slate-500">· {p.documentNumber}</span></span>
                <AlertBadges alerts={p.medicalHistory?.alerts} compact />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
