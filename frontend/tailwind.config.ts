import type { Config } from 'tailwindcss';

/**
 * Sistema de diseño SIGO-Dental.
 * brand = petróleo clínico (acciones y selección) · ink = texto · line = bordes · canvas = fondo porcelana.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF5F6',
          100: '#D6E8EB',
          200: '#AFD0D6',
          300: '#7DB1BB',
          400: '#43909E',
          500: '#1D7486',
          600: '#0E5E6F',
          700: '#0B4D5B',
          800: '#0A3F4A',
          900: '#08323B',
        },
        ink: { DEFAULT: '#18222D', soft: '#46525F', muted: '#6B7682' },
        line: { DEFAULT: '#E1E6EA', strong: '#CBD3DA' },
        canvas: '#F5F7F8',
      },
      fontFamily: {
        sans: ['var(--font-plex)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
};

export default config;
