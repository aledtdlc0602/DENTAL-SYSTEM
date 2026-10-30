import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { Roles, R } from '../common/roles.decorator';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Post()
  @Roles(...R.CLINICAL, ...R.FRONT_DESK)
  @ApiOperation({ summary: 'Crear cita (valida RN-03: sillón, odontólogo y paciente sin solapamiento)' })
  create(@Request() req: any, @Body() dto: CreateAppointmentDto) {
    return this.service.create(req.user.clinicId, dto, req.user.userId);
  }

  @Get()
  @Roles(...R.ALL_STAFF)
  @ApiOperation({ summary: 'RF-09: listar citas (filtros: dentistId, roomId, patientId, from/to ISO, date, status)' })
  @ApiQuery({ name: 'dentistId', required: false })
  @ApiQuery({ name: 'roomId', required: false })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO-8601' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO-8601' })
  @ApiQuery({ name: 'status', required: false, description: 'uno o varios separados por coma' })
  findAll(
    @Request() req: any,
    @Query('dentistId') dentistId?: string,
    @Query('roomId') roomId?: string,
    @Query('patientId') patientId?: string,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(req.user.clinicId, { dentistId, roomId, patientId, date, from, to, status });
  }

  @Get(':id')
  @Roles(...R.ALL_STAFF)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.clinicId, id);
  }

  @Patch(':id')
  @Roles(...R.CLINICAL, ...R.FRONT_DESK)
  @ApiOperation({ summary: 'Editar / reprogramar cita (revalida RN-03)' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.service.update(req.user.clinicId, id, dto);
  }

  @Patch(':id/status/:status')
  @Roles(...R.CLINICAL, ...R.FRONT_DESK)
  @ApiOperation({ summary: 'RF-10: cambiar estado. COMPLETED descarga insumos (RF-14) y marca el ítem del presupuesto (RF-08)' })
  updateStatus(@Request() req: any, @Param('id') id: string, @Param('status') status: string) {
    return this.service.updateStatus(req.user.clinicId, id, status, req.user.userId);
  }

  @Delete(':id')
  @Roles(...R.CLINICAL, ...R.FRONT_DESK)
  @ApiOperation({ summary: 'Cancelar cita' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.clinicId, id);
  }
}
