import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: any) {
    // Los tokens temporales del paso MFA no sirven para usar la API.
    if (payload.purpose === 'mfa') throw new UnauthorizedException('Complete la verificación MFA');
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      clinicId: payload.clinicId,
      mfa: Boolean(payload.mfa),
      mfaRequired: Boolean(payload.mfaRequired),
    };
  }
}
