'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearAuth, getUser, hasRole, Role } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/format';
import Icon, { BrandMark, IconName } from './Icons';

type NavLink = { href: string; label: string; icon: IconName; roles?: Role[] };

/** Menú según la matriz de roles del SRS. ADMIN ve todo. */
export const NAV: { title: string; links: NavLink[] }[] = [
  { title: '', links: [{ href: '/dashboard', label: 'Inicio', icon: 'dashboard' }] },
  {
    title: 'Atención',
    links: [
      { href: '/appointments', label: 'Agenda', icon: 'calendar', roles: ['DENTIST', 'ASSISTANT', 'RECEPTIONIST', 'ACCOUNTANT'] },
      { href: '/patients', label: 'Pacientes', icon: 'users', roles: ['DENTIST', 'ASSISTANT', 'RECEPTIONIST'] },
      { href: '/treatment-plans', label: 'Presupuestos', icon: 'clipboard', roles: ['DENTIST', 'ASSISTANT', 'RECEPTIONIST', 'ACCOUNTANT'] },
      { href: '/procedures', label: 'Catálogo', icon: 'tooth', roles: ['DENTIST', 'ASSISTANT', 'RECEPTIONIST', 'ACCOUNTANT'] },
    ],
  },
  {
    title: 'Administración',
    links: [
      { href: '/invoices', label: 'Caja', icon: 'wallet', roles: ['RECEPTIONIST', 'ACCOUNTANT'] },
      { href: '/commissions', label: 'Honorarios', icon: 'coins', roles: ['ACCOUNTANT', 'DENTIST'] },
      { href: '/inventory', label: 'Inventario', icon: 'package', roles: ['ACCOUNTANT', 'ASSISTANT', 'DENTIST', 'RECEPTIONIST'] },
      { href: '/reports', label: 'Reportes', icon: 'chart', roles: ['ACCOUNTANT'] },
    ],
  },
  {
    title: 'Sistema',
    links: [
      { href: '/settings', label: 'Configuración', icon: 'settings' },
      { href: '/audit', label: 'Auditoría', icon: 'shield', roles: [] },
    ],
  },
];

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U';

  function logout() {
    clearAuth();
    router.push('/login');
  }

  const sections = NAV.map((s) => ({ ...s, links: s.links.filter((l) => !l.roles || hasRole(...l.roles)) })).filter((s) => s.links.length);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-line bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:translate-x-0 print:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Navegación principal"
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
          <BrandMark size={28} />
          <div className="min-w-0 leading-tight">
            <div className="text-[14px] font-semibold text-ink">SIGO-Dental</div>
            <div className="truncate text-[12px] text-ink-muted">{user?.clinicName || 'Clínica'}</div>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {sections.map((s, i) => (
            <div key={s.title || i}>
              {s.title && <div className="mb-1 px-2 text-[12px] font-medium text-ink-muted">{s.title}</div>}
              <div className="space-y-px">
                {s.links.map((l) => {
                  const active = pathname === l.href || pathname.startsWith(l.href + '/');
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-9 items-center gap-2.5 rounded-md px-2 text-[13.5px] font-medium transition-colors ${
                        active ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-slate-100 hover:text-ink'
                      }`}
                    >
                      <Icon name={l.icon} size={17} className={active ? 'text-brand-600' : 'text-slate-400'} />
                      {l.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-md px-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-800">{initials}</span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-medium text-ink">{user?.firstName} {user?.lastName}</div>
              <div className="truncate text-[12px] text-ink-muted">{ROLE_LABELS[user?.role || ''] || user?.role}</div>
            </div>
            <button onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión" className="btn-ghost !h-8 !w-8 !px-0">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
