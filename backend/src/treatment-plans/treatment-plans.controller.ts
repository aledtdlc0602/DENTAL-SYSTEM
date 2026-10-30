import { Controller, Get, Post, Body, Patch, Param, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, PartialType } from '@nestjs/swagger';
import { TreatmentPlansService } from './treatment-plans.service';
import { ApproveDto, CreateTreatmentPlanDto, ScheduleDto } from './dto/create-treatment-plan.dto';
import { Roles, R } from '../common/roles.decorator';

class UpdatePlanDto extends PartialType(CreateTreatmentPlanDto) {}

@ApiTags('Treatment Plans')
@ApiBearerAuth()
@Roles(...R.CLINICAL, ...R.FRONT_DESK)
@Controller('treatment-plans')
export class TreatmentPlansController {
  constructor(private readonly service: TreatmentPlansService) {}

  @Post()
  @Roles('DENTIST')
  @ApiOperation({ summary: 'RF-07: crear presupuesto multinivel (fases, laboratorio, descuentos autorizados)' })
  create(@Request() req: any, @Body() dto: CreateTreatmentPlanDto) {
    return this.service.create(req.user.clinicId, dto, req.user);
  }

  @Get()
  @Roles(...R.ALL_STAFF)
  @ApiOperation({ summary: 'Listar presupuestos' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(@Request() req: any, @Query('patientId') patientId?: string, @Query('status') status?: string) {
    return this.service.findAll(req.user.clinicId, patientId, status);
  }

  @Get(':id')
  @Roles(...R.ALL_STAFF)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.clinicId, id);
  }

  @Patch(':id')
  @Roles('DENTIST')
  @ApiOperation({ summary: 'Editar presupuesto (solo borrador / pendiente)' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.service.update(req.user.clinicId, id, dto, req.user.role);
  }

  @Patch(':id/status/:status')
  @ApiOperation({ summary: 'Cambiar estado del plan' })
  updateStatus(@Request() req: any, @Param('id') id: string, @Param('status') status: string) {
    return this.service.updateStatus(req.user.clinicId, id, status);
  }

  @Patch(':planId/items/:itemId/status/:status')
  @Roles('DENTIST')
  @ApiOperation({ summary: 'Cambiar estado de un ítem (los Realizados no se modifican, RN-01)' })
  updateItemStatus(@Request() req: any, @Param('planId') planId: string, @Param('itemId') itemId: string, @Param('status') status: string) {
    return this.service.updateItemStatus(req.user.clinicId, planId, itemId, status);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'RF-08: registrar aprobación total o parcial del paciente' })
  approve(@Request() req: any, @Param('id') id: string, @Body() dto: ApproveDto) {
    return this.service.approve(req.user.clinicId, id, dto.itemIds);
  }

  @Post(':id/approve-and-schedule')
  @ApiOperation({ summary: 'RF-08: aprobar y convertir los ítems autorizados en citas (valida RN-03)' })
  approveAndSchedule(@Request() req: any, @Param('id') id: string, @Body() dto: ScheduleDto) {
    return this.service.approveAndSchedule(req.user.clinicId, id, dto, req.user.userId);
  }
}
