/** Configuración por clínica guardada en Clinic.settings (JSON). */
export interface ClinicSettings {
  /** RF-05: horas tras las cuales una nota SOEP queda bloqueada (por defecto 24). */
  noteLockHours: number;
  /** RNF-05: exigir MFA para acceder a expedientes e información financiera. */
  requireMfa: boolean;
  /** RNF-05: minutos de inactividad antes de cerrar sesión (por defecto 15). */
  idleTimeoutMin: number;
  /** RF-12: parámetros de facturación electrónica SRI. */
  sri: { ambiente: '1' | '2'; establecimiento: string; puntoEmision: string; obligadoContabilidad: boolean };
}

export const DEFAULT_SETTINGS: ClinicSettings = {
  noteLockHours: 24,
  requireMfa: false,
  idleTimeoutMin: 15,
  sri: { ambiente: '1', establecimiento: '001', puntoEmision: '001', obligadoContabilidad: false },
};

export function readSettings(raw: any): ClinicSettings {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    noteLockHours: Number(s.noteLockHours) > 0 ? Number(s.noteLockHours) : DEFAULT_SETTINGS.noteLockHours,
    requireMfa: Boolean(s.requireMfa),
    idleTimeoutMin: Number(s.idleTimeoutMin) > 0 ? Number(s.idleTimeoutMin) : DEFAULT_SETTINGS.idleTimeoutMin,
    sri: { ...DEFAULT_SETTINGS.sri, ...(s.sri || {}) },
  };
}
