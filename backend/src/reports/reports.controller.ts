import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Roles, R } from '../common/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('dashboard')
  @Roles(...R.ALL_STAFF)
  @ApiOperation({ summary: 'Indicadores del tablero según el rol (los montos solo para finanzas/admin)' })
  dashboard(@Request() req: any) {
    return this.service.dashboard(req.user.clinicId, req.user);
  }

  @Get('summary')
  @Roles(...R.FINANCE)
  @ApiOperation({ summary: 'Fase 3: reporte BI del período (ingresos, producción por odontólogo, ausentismo, conversión de presupuestos, materiales)' })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  summary(@Request() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.summary(req.user.clinicId, from, to);
  }
}
