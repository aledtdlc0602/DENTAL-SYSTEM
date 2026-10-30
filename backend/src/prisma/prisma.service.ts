import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { IMMUTABILITY_SQL } from './immutability';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  async onModuleInit() {
    await this.$connect();
    if (process.env.SKIP_DB_TRIGGERS === 'true') return;
    try {
      for (const sql of IMMUTABILITY_SQL) await this.$executeRawUnsafe(sql);
      this.logger.log('Reglas de inmutabilidad (RN-01 / RNF-06) aplicadas en la base de datos');
    } catch (e: any) {
      this.logger.warn(`No se pudieron aplicar los triggers de inmutabilidad: ${e?.message}. ¿Ejecutó "npx prisma db push"?`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
