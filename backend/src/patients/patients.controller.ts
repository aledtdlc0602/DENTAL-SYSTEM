import { Controller, Get, Post, Body, Patch, Put, Param, Delete, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto, MedicalHistoryDto, GuardianDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Roles, R } from '../common/roles.decorator';

@ApiTags('Patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @Roles(...R.CLINICAL, ...R.FRONT_DESK)
  @ApiOperation({ summary: 'RF-01: crear paciente (incluye anamnesis obligatoria y representante si es menor)' })
  create(@Request() req: any, @Body() dto: CreatePatientDto) {
    return this.patientsService.create(req.user.clinicId, dto, req.user.userId);
  }

  @Get()
  @Roles(...R.ALL_STAFF)
  @ApiOperation({ summary: 'Listar pacientes (búsqueda por nombre, documento, teléfono o email)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'includeInactive', required: false })
  findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.patientsService.findAll(req.user.clinicId, search, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20, includeInactive === 'true');
  }

  @Get(':id')
  @Roles(...R.CLINICAL, ...R.FRONT_DESK)
  @ApiOperation({ summary: 'Expediente del paciente (auditado: VIEW)' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.patientsService.findOne(req.user.clinicId, id);
  }

  @Get(':id/timeline')
  @Roles(...R.CLINICAL)
  @ApiOperation({ summary: 'Línea de tiempo cronológica del expediente' })
  timeline(@Request() req: any, @Param('id') id: string) {
    return this.patientsService.timeline(req.user.clinicId, id);
  }

  @Patch(':id')
  @Roles(...R.CLINICAL, ...R.FRONT_DESK)
  @ApiOperation({ summary: 'Actualizar ficha del paciente' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(req.user.clinicId, id, dto, req.user.userId);
  }

  @Put(':id/medical-history')
  @Roles(...R.CLINICAL, ...R.FRONT_DESK)
  @ApiOperation({ summary: 'RF-02: actualizar anamnesis y recalcular alertas críticas' })
  updateMedical(@Request() req: any, @Param('id') id: string, @Body() dto: MedicalHistoryDto) {
    return this.patientsService.updateMedicalHistory(req.user.clinicId, id, dto, req.user.userId);
  }

  @Post(':id/guardians')
  @Roles(...R.CLINICAL, ...R.FRONT_DESK)
  @ApiOperation({ summary: 'RF-01: agregar representante legal / tutor' })
  addGuardian(@Request() req: any, @Param('id') id: string, @Body() dto: GuardianDto) {
    return this.patientsService.addGuardian(req.user.clinicId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Desactivar paciente (soft delete; el expediente nunca se borra)' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.patientsService.softDelete(req.user.clinicId, id);
  }
}
