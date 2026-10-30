import { Body, Controller, Get, Patch, Query, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiQuery } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { readSettings } from '../common/clinic-settings';
import { Roles, SkipMfa } from '../common/roles.decorator';

class SriDto {
  @ApiPropertyOptional({ enum: ['1', '2'], description: '1 = pruebas, 2 = producción' }) @IsOptional() @IsIn(['1', '2']) ambiente?: '1' | '2';
  @ApiPropertyOptional({ example: '001' }) @IsOptional() @IsString() establecimiento?: string;
  @ApiPropertyOptional({ example: '001' }) @IsOptional() @IsString() puntoEmision?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() obligadoContabilidad?: boolean;
}

class UpdateSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() legalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ruc?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ description: 'RF-05: horas para bloqueo de notas' }) @IsOptional() @IsInt() @Min(1) @Max(168) noteLockHours?: number;
  @ApiPropertyOptional({ description: 'RNF-05: exigir MFA a todo el personal' }) @IsOptional() @IsBoolean() requireMfa?: boolean;
  @ApiPropertyOptional({ description: 'RNF-05: minutos de inactividad' }) @IsOptional() @IsInt() @Min(5) @Max(120) idleTimeoutMin?: number;
  @ApiPropertyOptional({ type: SriDto }) @IsOptional() @ValidateNested() @Type(() => SriDto) sri?: SriDto;
}

@ApiTags('Settings / Audit')
@ApiBearerAuth()
@Controller()
export class SettingsController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  @Get('settings')
  @SkipMfa()
  @ApiOperation({ summary: 'Datos y configuración de la clínica' })
  async get(@Request() req: any) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: req.user.clinicId } });
    return { ...clinic, settings: readSettings(clinic?.settings) };
  }

  @Patch('settings')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Actualizar configuración (solo administrador)' })
  async update(@Request() req: any, @Body() dto: UpdateSettingsDto) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: req.user.clinicId } });
    const current = readSettings(clinic?.settings);
    const { noteLockHours, requireMfa, idleTimeoutMin, sri, ...info } = dto;
    const settings = {
      ...current,
      ...(noteLockHours !== undefined ? { noteLockHours } : {}),
      ...(requireMfa !== undefined ? { requireMfa } : {}),
      ...(idleTimeoutMin !== undefined ? { idleTimeoutMin } : {}),
      sri: { ...current.sri, ...(sri || {}) },
    };
    if (settings.sri.establecimiento) settings.sri.establecimiento = settings.sri.establecimiento.padStart(3, '0').slice(-3);
    if (settings.sri.puntoEmision) settings.sri.puntoEmision = settings.sri.puntoEmision.padStart(3, '0').slice(-3);
    const updated = await this.prisma.clinic.update({ where: { id: req.user.clinicId }, data: { ...info, settings: settings as any } });
    return { ...updated, settings: readSettings(updated.settings) };
  }

  @Get('audit')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'RNF-06: log de auditoría (inmutable). Filtros: userId, entity, entityId, action, from, to' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false })
  listAudit(
    @Request() req: any,
    @Query('userId') userId?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
  ) {
    return this.audit.list(req.user.clinicId, { userId, entity, entityId, action, from, to, page: page ? Number(page) : 1 });
  }
}
