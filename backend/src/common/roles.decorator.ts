import { SetMetadata } from '@nestjs/common';

export type AppRole = 'SUPERADMIN' | 'ADMIN' | 'DENTIST' | 'RECEPTIONIST' | 'ASSISTANT' | 'ACCOUNTANT' | 'PATIENT';

export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'isPublic';
export const SKIP_MFA_KEY = 'skipMfa';

/**
 * RNF-05: RBAC. Restringe la ruta a los roles indicados.
 * SUPERADMIN y ADMIN (dueño/administrador de la clínica) siempre tienen acceso.
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

/** Ruta sin autenticación (login, registro, health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Ruta accesible aunque el usuario aún no haya completado MFA (configurar MFA, /auth/me). */
export const SkipMfa = () => SetMetadata(SKIP_MFA_KEY, true);

/** Grupos de roles reutilizables (matriz RACI del SRS, sección 3). */
export const R = {
  CLINICAL: ['DENTIST', 'ASSISTANT'] as AppRole[],
  FRONT_DESK: ['RECEPTIONIST'] as AppRole[],
  FINANCE: ['ACCOUNTANT'] as AppRole[],
  ALL_STAFF: ['DENTIST', 'ASSISTANT', 'RECEPTIONIST', 'ACCOUNTANT'] as AppRole[],
};
