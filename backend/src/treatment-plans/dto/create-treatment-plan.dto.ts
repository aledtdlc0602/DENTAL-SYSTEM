import {
  IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsEnum, Min, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlanItemDto {
  @ApiProperty()
  @IsString()
  procedureId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  toothNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  surface?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ description: 'Costo de laboratorio por unidad (por defecto el del catálogo)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  labCost?: number;

  @ApiPropertyOptional({ description: 'Fase / sesión del tratamiento' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  phase?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTreatmentPlanDto {
  @ApiProperty()
  @IsString()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PENDING_APPROVAL'], default: 'DRAFT' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ type: [PlanItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanItemDto)
  items: PlanItemDto[];
}

export class ApproveDto {
  @ApiPropertyOptional({ type: [String], description: 'Ítems que el paciente autoriza (vacío = todos los pendientes)' })
  @IsOptional()
  @IsArray()
  itemIds?: string[];
}

export class ScheduleDto extends ApproveDto {
  @ApiProperty() @IsString() dentistId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() roomId?: string;
  @ApiProperty({ example: '2026-11-05T14:00:00.000Z' }) @IsString() startAt: string;
  @ApiPropertyOptional({ description: 'Minutos por ítem; si se omite se usa la duración del procedimiento' })
  @IsOptional() @IsNumber() @Min(10) durationMinPerItem?: number;
  @ApiPropertyOptional({ description: 'true = una cita por fase (agrupa los ítems de la misma fase)' })
  @IsOptional() @IsBoolean() groupByPhase?: boolean;
}
