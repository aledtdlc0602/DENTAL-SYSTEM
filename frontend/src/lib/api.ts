export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export type Role = 'SUPERADMIN' | 'ADMIN' | 'DENTIST' | 'RECEPTIONIST' | 'ASSISTANT' | 'ACCOUNTANT';
export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  clinicId: string;
  clinicName?: string;
  mfaEnabled?: boolean;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.code = data?.code;
    this.data = data;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: SessionUser, extra?: { idleTimeoutMin?: number }) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  if (extra?.idleTimeoutMin) localStorage.setItem('idleTimeoutMin', String(extra.idleTimeoutMin));
  localStorage.setItem('lastActivity', String(Date.now()));
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearAuth() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivity');
  } catch {
    /* sin almacenamiento */
  }
}

export function getUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** ADMIN y SUPERADMIN tienen acceso total (igual que el backend). */
export function hasRole(...roles: Role[]) {
  const u = getUser();
  if (!u) return false;
  return u.role === 'ADMIN' || u.role === 'SUPERADMIN' || roles.includes(u.role);
}

function messageOf(data: any, status: number) {
  const m = data?.message;
  if (Array.isArray(m)) return m.join('. ');
  if (typeof m === 'string') return m;
  if (m && typeof m === 'object' && typeof m.message === 'string') return m.message;
  return data?.error || `Error ${status}`;
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. ¿Está encendido el backend?', 0);
  }

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/mfa/login')) {
    clearAuth();
    if (typeof window !== 'undefined') window.location.href = '/login?expired=1';
    throw new ApiError('Sesión expirada', 401, data);
  }
  if (res.status === 403 && data?.code === 'MFA_REQUIRED' && typeof window !== 'undefined' && !window.location.pathname.startsWith('/mfa')) {
    window.location.href = '/mfa?required=1';
  }
  if (!res.ok) throw new ApiError(messageOf(data, res.status), res.status, data);
  return data as T;
}

/** Descarga un archivo autenticado (ej. XML del SRI). */
export async function download(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(messageOf(data, res.status), res.status, data);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
