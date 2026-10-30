import { Controller, Post, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import { Roles } from '../common/roles.decorator';

@ApiTags('Seed / Demo')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('seed')
export class SeedController {
  constructor(private readonly service: SeedService) {}

  @Post('demo')
  @ApiOperation({
    summary:
      'Cargar datos demo en TODAS las áreas (≥20 por entidad). Idempotente: si ya se cargaron no duplica. ' +
      'Con ?reset=true borra primero los datos operativos de la clínica.',
  })
  @ApiQuery({ name: 'reset', required: false, type: Boolean })
  seedDemo(@Request() req: any, @Query('reset') reset?: string) {
    return this.service.seedDemo(req.user.clinicId, req.user.userId, reset === 'true' || reset === '1');
  }
}
