'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { clearAuth, getToken, getUser, hasRole, Role } from '@/lib/api';
import Sidebar, { NAV } from './Sidebar';
import CommandSearch from './CommandSearch';
import Icon from './Icons';

/** Ruta legible para la barra superior. */
function useCrumbs() {
  const pathname = usePathname() || '';
  const link = NAV.flatMap((s) => s.links).find((l) => pathname === l.href || pathname.startsWith(l.href + '/'));
  const crumbs: { label: string; href?: string }[] = [];
  if (link) crumbs.push({ label: link.label, href: pathname === link.href ? undefined : link.href });
  if (link && pathname !== link.href) crumbs.push({ label: link.href === '/patients' ? 'Expediente' : 'Detalle' });
  return crumbs;
}

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];

/**
 * RNF-05: cierre automático de sesión tras N minutos de inactividad (15 por defecto, configurable por clínica).
 * La última actividad se comparte entre pestañas mediante localStorage.
 */
function useIdleLogout(onTimeout: () => void) {
  const [warning, setWarning] = useState<number | null>(null);
  const cb = useRef(onTimeout);
  cb.current = onTimeout;

  useEffect(() => {
    let minutes = 15;
    try {
      minutes = Number(localStorage.getItem('idleTimeoutMin')) || 15;
    } catch {
      /* usar valor por defecto */
    }
    const limit = minutes * 60000;
    let last = Date.now();
    const touch = () => {
      last = Date.now();
      try {
        localStorage.setItem('lastActivity', String(last));
      } catch {
        /* ignorar */
      }
    };
    touch();
    let throttle = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - throttle > 5000) {
        throttle = now;
        touch();
      }
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const timer = window.setInterval(() => {
      let shared = last;
      try {
        shared = Math.max(last, Number(localStorage.getItem('lastActivity')) || 0);
      } catch {
        /* ignorar */
      }
      const left = limit - (Date.now() - shared);
      if (left <= 0) cb.current();
      else setWarning(left <= 60000 ? Math.ceil(left / 1000) : null);
    }, 1000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(timer);
    };
  }, []);

  return {
    warning,
    stay: () => {
      try {
        localStorage.setItem('lastActivity', String(Date.now()));
      } catch {
        /* ignorar */
      }
      setWarning(null);
    },
  };
}

export default function AppShell({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { warning, stay } = useIdleLogout(() => {
    clearAuth();
    router.replace('/login?idle=1');
  });

  useEffect(() => {
    if (!getToken() || !getUser()) router.replace('/login');
    else setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-500">
        <div className="h-10 w-10 rounded-full border-[3px] border-brand-100 border-t-brand-600 animate-spin" />
        <span className="text-sm">Cargando…</span>
      </div>
    );
  }

  const allowed = !roles || hasRole(...roles);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMenuOpen(true)} />

        {warning !== null && (
          <div className="flex flex-wrap items-center justify-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] font-medium text-amber-900 print:hidden" role="status">
            <Icon name="clock" size={15} /> La sesión se cerrará por inactividad en {warning} s.
            <button onClick={stay} className="btn-secondary !h-7 !px-2.5 !text-[12.5px]">
              Seguir conectado
            </button>
          </div>
        )}

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8">
            {allowed ? (
              children
            ) : (
              <div className="card mx-auto mt-16 max-w-md p-8 text-center">
                <Icon name="lock" size={22} className="mx-auto mb-3 text-ink-muted" />
                <h2 className="text-[16px] font-semibold">Sin acceso a esta sección</h2>
                <p className="mt-1 text-[13.5px] text-ink-muted">Su rol no incluye este módulo. Pida acceso al administrador de la clínica.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const crumbs = useCrumbs();
  const d = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = d.charAt(0).toUpperCase() + d.slice(1);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8 print:hidden">
      <button onClick={onMenu} aria-label="Abrir menú" className="btn-ghost -ml-2 !h-9 !w-9 !px-0 lg:hidden">
        <Icon name="menu" size={20} />
      </button>
      <nav aria-label="Ruta" className="hidden min-w-0 items-center gap-1.5 text-[13.5px] md:flex">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <Icon name="chevron-right" size={14} className="text-slate-300" />}
            {c.href ? (
              <Link href={c.href} className="text-ink-muted hover:text-ink">{c.label}</Link>
            ) : (
              <span className="font-medium text-ink">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="flex flex-1 justify-end md:justify-center">
        <CommandSearch />
      </div>
      <span className="hidden whitespace-nowrap text-[13px] text-ink-muted xl:block">{today}</span>
    </header>
  );
}
