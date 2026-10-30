import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AppRole, PUBLIC_KEY, ROLES_KEY, SKIP_MFA_KEY } from '../common/roles.decorator';

/**
 * Guard global (registrado como APP_GUARD):
 * 1. Valida el JWT (salvo rutas @Public()).
 * 2. RNF-05: si la clínica exige MFA y la sesión no lo completó, bloquea todo excepto @SkipMfa().
 * 3. RNF-05: RBAC con @Roles(...). ADMIN/SUPERADMIN pasan siempre.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector?.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { role: AppRole; mfaRequired?: boolean; mfa?: boolean };

    const skipMfa = this.reflector?.getAllAndOverride<boolean>(SKIP_MFA_KEY, targets);
    if (user.mfaRequired && !user.mfa && !skipMfa) {
      throw new ForbiddenException({ statusCode: 403, code: 'MFA_REQUIRED', message: 'Debe configurar y verificar la autenticación de dos factores (MFA) para continuar.' });
    }

    const roles = this.reflector?.getAllAndOverride<AppRole[]>(ROLES_KEY, targets);
    if (!roles || roles.length === 0) return true;
    if (user.role === 'SUPERADMIN' || user.role === 'ADMIN') return true;
    if (!roles.includes(user.role)) {
      throw new ForbiddenException('Su rol no tiene permiso para esta acción');
    }
    return true;
  }
}
