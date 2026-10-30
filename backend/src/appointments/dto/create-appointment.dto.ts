import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export class CreateAppointmentDto {
  @ApiProperty()
  @IsString()
  patientId: string;

  @ApiProperty()
  @IsString()
  dentistId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiProperty({ example: '2026-11-05T09:00:00.000Z' })
  @IsDateString()
  startAt: string;

  @ApiPropertyOptional({ example: '2026-11-05T09:30:00.000Z', description: 'Si se omite se usa la duración del procedimiento' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ description: 'RF-14: procedimiento a realizar (descarga insumos al completar la cita)' })
  @IsOptional()
  @IsString()
  procedureId?: string;

  @ApiPropertyOptional({ description: 'RF-08: ítem del presupuesto que se agenda' })
  @IsOptional()
  @IsString()
  treatmentPlanItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus, default: 'SCHEDULED' })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
