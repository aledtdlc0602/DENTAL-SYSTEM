import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const SELECT = {
  id: true, email: true, firstName: true, lastName: true, phone: true, role: true, specialties: true,
  isActive: true, mfaEnabled: true, lastLoginAt: true, createdAt: true,
};
const ROLES = ['ADMIN', 'DENTIST', 'RECEPTIONIST', 'ASSISTANT', 'ACCOUNTANT'];

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll(clinicId: string, role?: string, includeInactive = false) {
    const where: any = { clinicId };
    if (!includeInactive) where.isActive = true;
    if (role) where.role = { in: role.split(',') };
    return this.prisma.user.findMany({ where, select: SELECT, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] });
  }

  findDentists(clinicId: string) {
    return this.findAll(clinicId, 'DENTIST');
  }

  async create(clinicId: string, data: { email: string; password: string; firstName: string; lastName: string; role?: string; phone?: string; specialties?: string[] }) {
    if (data.role && !ROLES.includes(data.role)) throw new BadRequestException('Rol inválido');
    const existing = await this.prisma.user.findFirst({ where: { email: data.email } });
    if (existing) throw new ConflictException('Ese email ya está registrado');
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.user.create({
      data: {
        clinicId,
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: (data.role as any) || 'ASSISTANT',
        phone: data.phone,
        specialties: data.specialties || [],
      },
      select: SELECT,
    });
  }

  async update(clinicId: string, id: string, actorId: string, data: { firstName?: string; lastName?: string; phone?: string; role?: string; specialties?: string[]; isActive?: boolean; password?: string }) {
    const user = await this.prisma.user.findFirst({ where: { id, clinicId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (data.role && !ROLES.includes(data.role)) throw new BadRequestException('Rol inválido');
    if (id === actorId && (data.isActive === false || (data.role && data.role !== user.role))) {
      throw new BadRequestException('No puede desactivarse ni cambiarse el rol a sí mismo');
    }
    const { password, ...rest } = data;
    return this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        role: (rest.role as any) ?? undefined,
        ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
      },
      select: SELECT,
    });
  }

  /** El administrador puede quitar el MFA de un usuario que perdió su teléfono. */
  async resetMfa(clinicId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, clinicId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.prisma.user.update({ where: { id }, data: { twoFactorSecret: null, mfaEnabled: false }, select: SELECT });
  }

  async changeOwnPassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(current, user.passwordHash))) throw new BadRequestException('La contraseña actual no es correcta');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, 12) } });
    return { message: 'Contraseña actualizada' };
  }
}
