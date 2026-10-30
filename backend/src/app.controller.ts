import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './common/roles.decorator';

@ApiTags('Health')
@Public()
@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Root' })
  root() {
    return {
      name: 'SIGO-Dental API',
      version: '1.0.0',
      docs: '/docs',
      health: '/api/health',
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check (producción / Railway / load balancer)' })
  async health() {
    let db = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    return {
      status: db === 'ok' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: db,
      uptime: process.uptime(),
    };
  }
}
