import {
  Controller, Get, Post, Body, Patch, Param, Request,
} from '@nestjs/common';
import { Roles, R } from '../common/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OdontogramService } from './odontogram.service';
import { CreateOdontogramDto, UpdateToothDto } from './dto/create-odontogram.dto';

@ApiTags('Odontogram')
@ApiBearerAuth()
@Roles(...R.CLINICAL)
@Controller('odontogram')
export class OdontogramController {
  constructor(private readonly service: OdontogramService) {}

  @Post()
  @Roles('DENTIST')
  @ApiOperation({ summary: 'RF-03: guardar nueva versión del odontograma (los Realizados se conservan, RN-01)' })
  create(@Request() req: any, @Body() dto: CreateOdontogramDto) {
    return this.service.create(req.user.clinicId, dto, req.user.userId);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Obtener odontograma actual del paciente' })
  getLatest(@Request() req: any, @Param('patientId') patientId: string) {
    return this.service.getLatest(req.user.clinicId, patientId);
  }

  @Get('patient/:patientId/history')
  @ApiOperation({ summary: 'Historial de versiones del odontograma' })
  getHistory(@Request() req: any, @Param('patientId') patientId: string) {
    return this.service.getHistory(req.user.clinicId, patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener odontograma por ID' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.clinicId, id);
  }

  @Patch('patient/:patientId/tooth/:toothNumber')
  @Roles('DENTIST')
  @ApiOperation({ summary: 'Actualizar o agregar condición de un diente' })
  upsertTooth(
    @Request() req: any,
    @Param('patientId') patientId: string,
    @Param('toothNumber') toothNumber: string,
    @Body() dto: UpdateToothDto,
  ) {
    return this.service.upsertTooth(
      req.user.clinicId,
      patientId,
      parseInt(toothNumber),
      dto,
      req.user.userId,
    );
  }
}
