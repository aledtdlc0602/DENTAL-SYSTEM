import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { seedClinicDemoData } from './demo-data';

@Injectable()
export class SeedService {
  constructor(private prisma: PrismaService) {}

  /** Carga datos demo en todas las áreas de la clínica del usuario autenticado. */
  seedDemo(clinicId: string, adminUserId: string, reset = false) {
    return seedClinicDemoData(this.prisma, clinicId, adminUserId, { reset });
  }
}
