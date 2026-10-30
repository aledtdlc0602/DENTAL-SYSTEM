'use client';

import { ReactNode, useEffect } from 'react';
import Icon, { IconName } from './Icons';

export function Modal({
  open,
  title,
  onClose,
  children,
  width = 'max-w-lg',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center" onMouseDown={onClose}>
      <div className={`card my-8 w-full ${width}`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost !h-8 !w-8 !px-0" aria-label="Cerrar">
            <Icon name="close" size={17} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * Estado con punto de color. Recibe las clases de las tablas de estado (bg-*-50 text-*-700 ...)
 * y las convierte en un chip sobrio de borde fino.
 */
export function Badge({ children, cls }: { children: ReactNode; cls?: string }) {
  const tone = /emerald/.test(cls || '') ? 'emerald' : /red/.test(cls || '') ? 'red' : /amber|orange/.test(cls || '') ? 'amber' : /blue|sky/.test(cls || '') ? 'blue' : /purple/.test(cls || '') ? 'purple' : 'slate';
  const dot: Record<string, string> = { emerald: 'bg-emerald-500', red: 'bg-red-500', amber: 'bg-amber-500', blue: 'bg-blue-500', purple: 'bg-violet-500', slate: 'bg-slate-400' };
  const text: Record<string, string> = { emerald: 'text-emerald-800', red: 'text-red-800', amber: 'text-amber-800', blue: 'text-blue-800', purple: 'text-violet-800', slate: 'text-slate-700' };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-2 py-0.5 text-[12px] font-medium ${text[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function ErrorBox({ error, onClose }: { error?: string; onClose?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-red-800">
      <Icon name="alert" size={17} className="mt-0.5 shrink-0" />
      <div className="flex-1">{error}</div>
      {onClose && (
        <button onClick={onClose} className="text-red-500 hover:text-red-800" aria-label="Cerrar">
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'warn' }) {
  const cls =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-brand-100 bg-brand-50 text-brand-900';
  return <div className={`mb-4 rounded-lg border px-4 py-3 text-[13.5px] ${cls}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1>{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[13.5px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Indicador: etiqueta pequeña, cifra y contexto. El ícono es discreto y acompaña a la etiqueta. */
export function Kpi({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: IconName; tone?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted">
        {icon && <Icon name={icon} size={14} className="text-slate-400" />}
        {label}
      </div>
      <div className="mt-1 text-[24px] font-semibold leading-tight tabular-nums text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-ink-muted">{hint}</div>}
    </div>
  );
}

/** Franja continua de indicadores (en lugar de tarjetas sueltas). */
export function StatStrip({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'alert' }[] }) {
  return (
    <div
      className="card grid grid-cols-2 divide-line overflow-hidden md:divide-x md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))] [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line md:[&>*:nth-child(n+3)]:border-t-0"
      style={{ ['--cols' as any]: items.length }}
    >
      {items.map((it) => (
        <div key={it.label} className="px-5 py-4">
          <div className="text-[12.5px] font-medium text-ink-muted">{it.label}</div>
          <div className={`mt-1 text-[26px] font-semibold leading-tight tabular-nums ${it.tone === 'alert' ? 'text-red-700' : 'text-ink'}`}>{it.value}</div>
          {it.hint && <div className="mt-0.5 text-[12px] text-ink-muted">{it.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; badge?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`relative whitespace-nowrap px-3 py-2.5 text-[13.5px] font-medium transition-colors ${value === t.id ? 'text-brand-700' : 'text-ink-muted hover:text-ink'}`}
        >
          {t.label}
          {t.badge ? <span className="ml-1.5 rounded bg-slate-100 px-1.5 text-[11px] text-slate-600">{t.badge}</span> : null}
          {value === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-brand-600" />}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center text-[13.5px] text-ink-muted">
      {children}
      {action}
    </div>
  );
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-[13.5px] text-ink-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
      {label}
    </div>
  );
}

/** Alertas médicas de alta visibilidad. Se mantienen en rojo sólido: son información crítica. */
export function AlertBadges({ alerts, compact = false }: { alerts?: string[]; compact?: boolean }) {
  if (!alerts?.length) return null;
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-px text-[11px] font-semibold text-white" title={alerts.join('\n')}>
        <Icon name="alert" size={11} /> {alerts.length}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5" role="alert" aria-label="Alertas médicas">
      {alerts.map((a, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-[13px] font-semibold text-white">
          <Icon name="alert" size={14} /> {a}
        </span>
      ))}
    </div>
  );
}

/** Barra horizontal para reportes. */
export function BarRow({ label, value, max, display }: { label: string; value: number; max: number; display?: string }) {
  const pct = max > 0 ? Math.max(1.5, (value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,11rem)_1fr_minmax(0,9.5rem)] items-center gap-3 text-[13px]">
      <span className="truncate text-ink-soft" title={label}>{label}</span>
      <span className="h-2 overflow-hidden rounded-sm bg-slate-100">
        <span className="block h-full rounded-sm bg-brand-500" style={{ width: `${pct}%` }} />
      </span>
      <span className="truncate text-right font-medium tabular-nums text-ink">{display ?? value}</span>
    </div>
  );
}

/** Encabezado de panel con título y acción opcional. */
export function PanelHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="panel-title">{title}</h2>
        {sub && <p className="text-[12.5px] text-ink-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
