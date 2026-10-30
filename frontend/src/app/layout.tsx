import type { Metadata } from 'next';
import { IBM_Plex_Sans, Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// Tipografía del sistema
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' });
// Tipografías de la pantalla de acceso (se mantienen sin cambios)
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'SIGO-Dental',
  description: 'Sistema Integral de Gestión Odontológica',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${plex.variable} ${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
