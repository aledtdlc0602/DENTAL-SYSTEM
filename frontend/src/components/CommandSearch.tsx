'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, hasRole } from '@/lib/api';
import Icon from './Icons';

/**
 * Búsqueda global de pacientes (Ctrl+K / ⌘K): desde cualquier pantalla abre el expediente
 * escribiendo nombre, cédula o teléfono. Muestra las alertas médicas en el resultado.
 */
export default function CommandSearch() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const allowed = hasRole('DENTIST', 'ASSISTANT', 'RECEPTIONIST');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api(`/patients?search=${encodeURIComponent(q)}&limit=7`)
        .then((r) => {
          setResults(r.data || []);
          setActive(0);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function go(p: any) {
    setOpen(false);
    setQ('');
    ref.current?.blur();
    router.push(`/patients/${p.id}`);
  }

  if (!allowed) return null;

  return (
    <div className="relative w-full max-w-md">
      <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && results[active]) go(results[active]);
          if (e.key === 'Escape') { setOpen(false); ref.current?.blur(); }
        }}
        placeholder="Buscar paciente…"
        aria-label="Buscar paciente"
        className="!h-9 !min-h-0 !border-line !bg-slate-50 !pl-9 !pr-14 focus:!bg-white"
      />
      <kbd className="font-sans pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-white px-1.5 text-[11px] text-ink-muted sm:block">Ctrl K</kbd>
      {open && q.trim() && (
        <div className="popover absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden">
          {loading && !results.length ? (
            <div className="px-3 py-3 text-[13px] text-ink-muted">Buscando…</div>
          ) : !results.length ? (
            <div className="px-3 py-3 text-[13px] text-ink-muted">No hay pacientes con “{q}”.</div>
          ) : (
            <ul role="listbox">
              {results.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(p)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${i === active ? 'bg-brand-50' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{p.lastName}, {p.firstName}</span>
                      <span className="block text-[12px] tabular-nums text-ink-muted">{p.documentNumber}{p.phone ? ` · ${p.phone}` : ''}</span>
                    </span>
                    {p.medicalHistory?.alerts?.length > 0 && (
                      <span className="shrink-0 rounded bg-red-600 px-1.5 py-px text-[11px] font-semibold text-white" title={p.medicalHistory.alerts.join('\n')}>
                        {p.medicalHistory.alerts.length} alerta{p.medicalHistory.alerts.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
