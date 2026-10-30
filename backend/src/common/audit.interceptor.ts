import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

/** Rutas cuya CONSULTA también se audita (expediente clínico e información financiera). */
const VIEW_AUDITED = [
  /^\/api\/patients\/[^/]+$/,
  /^\/api\/clinical-notes\/patient\//,
  /^\/api\/odontogram\/patient\//,
  /^\/api\/periodontogram\/patient\//,
  /^\/api\/consents\/patient\//,
  /^\/api\/prescriptions\/patient\//,
  /^\/api\/invoices\/[^/]+$/,
  /^\/api\/invoices\/[^/]+\/sri-xml$/,
  /^\/api\/commissions\/settlement/,
  /^\/api\/reports\//,
];

const ENTITY_BY_SEGMENT: Record<string, string> = {
  patients: 'Patient', appointments: 'Appointment', 'clinical-notes': 'ClinicalNote', odontogram: 'Odontogram',
  periodontogram: 'Periodontogram', consents: 'Consent', prescriptions: 'Prescription', 'treatment-plans': 'TreatmentPlan',
  invoices: 'Invoice', inventory: 'Inventory', procedures: 'Procedure', users: 'User', rooms: 'Room',
  commissions: 'Commission', notifications: 'Notification', reports: 'Report', auth: 'Auth', seed: 'Seed', settings: 'Settings',
};

export function describeRequest(method: string, path: string) {
  const clean = path.split('?')[0];
  const parts = clean.replace(/^\/api\//, '').split('/').filter(Boolean);
  const entity = ENTITY_BY_SEGMENT[parts[0]] ?? parts[0] ?? 'Unknown';
  const id = parts.find((p, i) => i > 0 && /^c[a-z0-9]{20,}$/i.test(p));
  let action = method === 'POST' ? 'CREATE' : method === 'PATCH' || method === 'PUT' ? 'UPDATE' : method === 'DELETE' ? 'DELETE' : 'VIEW';
  if (/\/sign$/.test(clean)) action = 'SIGN';
  if (/\/sri-xml$/.test(clean)) action = 'EXPORT';
  if (/\/addendum$/.test(clean)) action = 'ADDENDUM';
  if (/\/payments$/.test(clean)) action = 'PAYMENT';
  if (/\/issue$/.test(clean)) action = 'ISSUE';
  if (/blind-close$/.test(clean)) action = 'CASH_CLOSE';
  if (/\/status\//.test(clean)) action = 'STATUS_CHANGE';
  return { entity, entityId: id, action };
}

/**
 * RNF-06: registra automáticamente quién creó, modificó, firmó, exportó o CONSULTÓ
 * registros clínicos/financieros, con IP de origen, navegador y timestamp ISO-8601.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    const path: string = req.originalUrl || req.url || '';
    const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
    const isAuditedView = method === 'GET' && VIEW_AUDITED.some((r) => r.test(path.split('?')[0]));
    if (!isWrite && !isAuditedView) return next.handle();
    if (/\/api\/auth\/(login|mfa\/login|register-clinic)/.test(path)) return next.handle(); // el servicio de auth registra LOGIN

    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.ip || req.socket?.remoteAddress || '').trim();
    const ua = req.headers['user-agent'];
    const { entity, entityId, action } = describeRequest(method, path);

    return next.handle().pipe(
      tap((result: any) => {
        const user = req.user;
        if (!user?.clinicId) return;
        this.audit.log({
          clinicId: user.clinicId,
          userId: user.userId,
          action,
          entity,
          entityId: entityId ?? (result && typeof result === 'object' && typeof result.id === 'string' ? result.id : undefined),
          newData: isWrite ? { path: path.split('?')[0], body: req.body } : { path },
          ipAddress: ip,
          userAgent: ua,
        });
      }),
    );
  }
}
