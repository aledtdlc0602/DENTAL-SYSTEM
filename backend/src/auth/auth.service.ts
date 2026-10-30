import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { generateSecret, otpauthUrl, verifyTotp } from '../common/totp';
import { readSettings } from '../common/clinic-settings';
import { assertNotRateLimited, clearFailures, registerFailure } from '../common/security';
import { LoginDto } from './dto/login.dto';
import { RegisterClinicDto } from './dto/register-clinic.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async registerClinic(dto: RegisterClinicDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.adminEmail },
    });
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: dto.clinicName,
          ruc: dto.ruc,
          email: dto.clinicEmail,
          phone: dto.phone,
          plan: 'BASIC',
        },
      });

      const admin = await tx.user.create({
        data: {
          clinicId: clinic.id,
          email: dto.adminEmail,
          passwordHash,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          role: 'ADMIN',
        },
      });

      await tx.room.create({
        data: {
          clinicId: clinic.id,
          name: 'Sillón 1',
        },
      });

      const defaults = [
        { name: 'Consulta / Evaluación', category: 'General', price: 20, durationMin: 30 },
        { name: 'Limpieza dental (profilaxis)', category: 'Preventiva', price: 35, durationMin: 45 },
        { name: 'Obturación simple', category: 'Operatoria', price: 40, durationMin: 40 },
        { name: 'Extracción simple', category: 'Cirugía', price: 50, durationMin: 30 },
        { name: 'Radiografía periapical', category: 'Diagnóstico', price: 10, durationMin: 10 },
      ];
      for (const d of defaults) {
        await tx.procedure.create({ data: { clinicId: clinic.id, ...d } });
      }

      const consentTemplates = [
        {
          name: 'Consentimiento general de atención odontológica',
          bodyHtml:
            'Yo, el/la paciente (o tutor legal), autorizo al profesional a realizar la evaluación y los procedimientos odontológicos necesarios. He sido informado(a) de los riesgos, beneficios y alternativas.',
        },
        {
          name: 'Consentimiento para extracción dental',
          bodyHtml:
            'Autorizo la extracción del/los diente(s) indicado(s). Se me ha explicado el procedimiento, posibles complicaciones y cuidados postoperatorios.',
        },
        {
          name: 'Consentimiento para endodoncia',
          bodyHtml:
            'Autorizo el tratamiento de conducto (endodoncia). Entiendo que el objetivo es conservar el diente.',
        },
      ];
      for (const t of consentTemplates) {
        await tx.consentTemplate.create({
          data: { clinicId: clinic.id, name: t.name, bodyHtml: t.bodyHtml },
        });
      }

      return { clinic, admin };
    });

    const token = this.signToken(result.admin, { mfa: false, mfaRequired: false });

    return {
      accessToken: token,
      user: {
        id: result.admin.id,
        email: result.admin.email,
        firstName: result.admin.firstName,
        lastName: result.admin.lastName,
        role: result.admin.role,
        clinicId: result.clinic.id,
        clinicName: result.clinic.name,
      },
    };
  }

  /**
   * Login con protección contra fuerza bruta y MFA (RNF-05).
   * - Si el usuario tiene MFA activo → devuelve { mfaRequired: true, mfaToken } y no entrega el token de acceso
   *   hasta validar el código TOTP en POST /auth/mfa/login.
   * - Si la clínica exige MFA y el usuario no lo configuró → token limitado (solo puede configurar MFA).
   */
  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string } = {}) {
    const key = `${meta.ip || 'ip?'}|${dto.email.toLowerCase()}`;
    assertNotRateLimited(key);

    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
      include: { clinic: true },
    });

    const valid = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !valid) {
      registerFailure(key);
      if (user) {
        await this.audit.log({ clinicId: user.clinicId, userId: user.id, action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, ipAddress: meta.ip, userAgent: meta.userAgent });
      }
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.clinic.isActive) {
      throw new UnauthorizedException('La clínica está desactivada');
    }
    clearFailures(key);

    const settings = readSettings(user.clinic.settings);

    if (user.mfaEnabled && user.twoFactorSecret) {
      const mfaToken = this.jwt.sign({ sub: user.id, purpose: 'mfa' }, { expiresIn: '5m' });
      return { mfaRequired: true, mfaToken, message: 'Ingrese el código de su aplicación de autenticación' };
    }

    return this.completeLogin(user, { mfa: false, mfaRequired: settings.requireMfa }, meta);
  }

  /** Segundo paso del login: valida el código TOTP y entrega el token de acceso. */
  async loginWithMfa(mfaToken: string, code: string, meta: { ip?: string; userAgent?: string } = {}) {
    let payload: any;
    try {
      payload = this.jwt.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('La verificación expiró. Inicie sesión nuevamente.');
    }
    if (payload.purpose !== 'mfa') throw new UnauthorizedException('Token inválido');
    const key = `mfa|${payload.sub}`;
    assertNotRateLimited(key);

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { clinic: true } });
    if (!user?.twoFactorSecret || !user.mfaEnabled) throw new UnauthorizedException('MFA no configurado');
    if (!verifyTotp(user.twoFactorSecret, code)) {
      registerFailure(key);
      await this.audit.log({ clinicId: user.clinicId, userId: user.id, action: 'MFA_FAILED', entity: 'User', entityId: user.id, ipAddress: meta.ip, userAgent: meta.userAgent });
      throw new UnauthorizedException('Código MFA inválido');
    }
    clearFailures(key);
    return this.completeLogin(user, { mfa: true, mfaRequired: readSettings(user.clinic.settings).requireMfa }, meta);
  }

  private async completeLogin(user: any, flags: { mfa: boolean; mfaRequired: boolean }, meta: { ip?: string; userAgent?: string }) {
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ clinicId: user.clinicId, userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, newData: { mfa: flags.mfa }, ipAddress: meta.ip, userAgent: meta.userAgent });
    const settings = readSettings(user.clinic.settings);
    return {
      accessToken: this.signToken(user, flags),
      mfaSetupRequired: flags.mfaRequired && !flags.mfa,
      idleTimeoutMin: settings.idleTimeoutMin,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        clinicId: user.clinicId,
        clinicName: user.clinic.name,
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { clinic: true },
    });
    if (!user) throw new UnauthorizedException();
    const settings = readSettings(user.clinic?.settings);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      clinicId: user.clinicId,
      clinicName: user.clinic?.name,
      mfaEnabled: user.mfaEnabled,
      settings: { requireMfa: settings.requireMfa, idleTimeoutMin: settings.idleTimeoutMin, noteLockHours: settings.noteLockHours },
    };
  }

  /** Paso 1 de la configuración MFA: genera un secreto (aún no activo) y el QR para la app. */
  async setupMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const secret = generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret, mfaEnabled: false } });
    const url = otpauthUrl(secret, user.email);
    let qrDataUrl: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const QRCode = require('qrcode');
      qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });
    } catch {
      qrDataUrl = null; // si el paquete qrcode no está instalado, se usa la clave manual
    }
    return {
      secret,
      otpauthUrl: url,
      qrDataUrl,
      message: 'Escanee el código QR (o ingrese la clave) en Google Authenticator, Authy o Microsoft Authenticator y confirme con un código.',
    };
  }

  /** Paso 2: confirma el primer código y activa MFA. Devuelve un token nuevo con MFA verificado. */
  async verifyMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { clinic: true } });
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('Primero genere el secreto MFA');
    }
    if (!verifyTotp(user.twoFactorSecret, code)) {
      throw new UnauthorizedException('Código MFA inválido');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    await this.audit.log({ clinicId: user.clinicId, userId, action: 'MFA_ENABLED', entity: 'User', entityId: userId });
    return {
      verified: true,
      message: 'MFA activado',
      accessToken: this.signToken(user, { mfa: true, mfaRequired: readSettings(user.clinic.settings).requireMfa }),
    };
  }

  async disableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { clinic: true } });
    if (!user) throw new UnauthorizedException();
    if (readSettings(user.clinic.settings).requireMfa) {
      throw new BadRequestException('La clínica exige MFA; no se puede desactivar.');
    }
    if (user.mfaEnabled && (!user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, code))) {
      throw new UnauthorizedException('Código MFA inválido');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: null, mfaEnabled: false } });
    await this.audit.log({ clinicId: user.clinicId, userId, action: 'MFA_DISABLED', entity: 'User', entityId: userId });
    return { message: 'MFA desactivado' };
  }

  private signToken(user: { id: string; email: string; role: string; clinicId: string }, flags: { mfa: boolean; mfaRequired: boolean }) {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId,
      mfa: flags.mfa,
      mfaRequired: flags.mfaRequired,
    });
  }
}
