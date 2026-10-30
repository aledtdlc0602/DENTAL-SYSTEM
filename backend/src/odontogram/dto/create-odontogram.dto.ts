import {
  IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum ToothSurface {
  V = 'V', L = 'L', M = 'M', D = 'D', O = 'O', I = 'I',
}

enum ToothCondition {
  HEALTHY = 'HEALTHY',
  CARIES = 'CARIES',
  FILLING = 'FILLING',
  ENDODONTICS = 'ENDODONTICS',
  CROWN = 'CROWN',
  BRIDGE = 'BRIDGE',
  IMPLANT = 'IMPLANT',
  MISSING = 'MISSING',
  EXTRACTION_INDICATED = 'EXTRACTION_INDICATED',
  FRACTURE = 'FRACTURE',
  SEALANT = 'SEALANT',
  PROSTHESIS = 'PROSTHESIS',
  OTHER = 'OTHER',
}

enum TreatmentStatus {
  PENDING = 'PENDING',
  DONE = 'DONE',
  PLANNED = 'PLANNED',
}

class ToothRecordDto {
  @ApiProperty({ example: 16, description: 'Número FDI del diente' })
  @IsNumber()
  toothNumber: number;

  @ApiPropertyOptional({ enum: ToothSurface })
  @IsOptional()
  @IsEnum(ToothSurface)
  surface?: ToothSurface;

  @ApiProperty({ enum: ToothCondition })
  @IsEnum(ToothCondition)
  condition: ToothCondition;

  @ApiPropertyOptional({ enum: TreatmentStatus, default: 'PENDING' })
  @IsOptional()
  @IsEnum(TreatmentStatus)
  status?: TreatmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  procedureId?: string;
}

export class CreateOdontogramDto {
  @ApiProperty()
  @IsString()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [ToothRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToothRecordDto)
  teeth: ToothRecordDto[];
}

export class UpdateToothDto {
  @ApiPropertyOptional({ enum: ToothCondition })
  @IsOptional()
  @IsEnum(ToothCondition)
  condition?: ToothCondition;

  @ApiPropertyOptional({ enum: TreatmentStatus })
  @IsOptional()
  @IsEnum(TreatmentStatus)
  status?: TreatmentStatus;

  @ApiPropertyOptional({ enum: ToothSurface })
  @IsOptional()
  @IsEnum(ToothSurface)
  surface?: ToothSurface;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
