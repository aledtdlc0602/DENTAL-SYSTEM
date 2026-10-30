import Icon, { LogoMark } from './Icons';

/** Pantalla de acceso: fondo de color con formas orgánicas y tarjeta de vidrio esmerilado. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="glass relative min-h-screen overflow-hidden flex flex-col"
      style={{
        background:
          'linear-gradient(135deg, #0b3b3a 0%, #0f766e 38%, #14b8a6 72%, #5eead4 100%)',
      }}
    >
      {/* Formas orgánicas */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span
          className="blob absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full"
          style={{ background: 'radial-gradient(circle at 30% 30%, #99f6e4, transparent 65%)', opacity: 0.55 }}
        />
        <span
          className="blob blob-b absolute top-1/3 -right-40 h-[38rem] w-[38rem] rounded-full"
          style={{ background: 'radial-gradient(circle at 60% 40%, #7dd3fc, transparent 65%)', opacity: 0.4 }}
        />
        <span
          className="blob blob-c absolute -bottom-52 left-1/4 h-[34rem] w-[34rem] rounded-full"
          style={{ background: 'radial-gradient(circle at 50% 50%, #0b3b3a, transparent 65%)', opacity: 0.7 }}
        />
        {/* Diente grande de línea */}
        <Icon
          name="tooth"
          size={620}
          strokeWidth={0.35}
          className="absolute -right-24 -bottom-24 text-white opacity-[0.18] hidden md:block"
        />
        <Icon
          name="tooth"
          size={260}
          strokeWidth={0.5}
          className="absolute left-[6%] bottom-[12%] text-white opacity-[0.12] -rotate-12 hidden lg:block"
        />
      </div>

      {/* Marca */}
      <header className="relative z-10 flex items-center gap-3 px-6 sm:px-10 pt-6 sm:pt-8 text-white">
        <LogoMark size={40} />
        <span className="text-lg font-semibold tracking-tight">Sistema Dental</span>
      </header>

      {/* Contenido */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-md animate-fade-up">
          {children}
          <p className="mt-6 text-center text-sm text-white/80">
            Pacientes, agenda y caja en un solo lugar.
          </p>
        </div>
      </main>

      <footer className="relative z-10 px-6 sm:px-10 pb-6 text-xs text-white/60">
        © {new Date().getFullYear()} Sistema Odontológico Integral
      </footer>
    </div>
  );
}
