import { Controller, Get, Post, Body, Param, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PeriodontogramService } from './periodontogram.service';
import { Roles, R } from '../common/roles.decorator';

class SiteDto {
  @ApiProperty()
  @IsNumber()
  toothNumber: number;

  @ApiProperty({ type: [Number], description: '6 puntos de sondaje (mm)' })
  @IsArray()
  probingDepths: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  gingivalMargin?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  clinicalAttachment?: number[];

  @ApiPropertyOptional({ type: [Boolean] })
  @IsOptional()
  @IsArray()
  bleeding?: boolean[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  mobility?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  furcation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class CreatePeriodontogramDto {
  @ApiProperty()
  @IsString()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [SiteDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SiteDto)
  sites: SiteDto[];
}

@ApiTags('Periodontogram')
@ApiBearerAuth()
@Roles(...R.CLINICAL)
@Controller('periodontogram')
export class PeriodontogramController {
  constructor(private readonly service: PeriodontogramService) {}

  @Post()
  @Roles('DENTIST')
  @ApiOperation({ summary: 'Crear versión de periodontograma (RF-04)' })
  create(@Request() req: any, @Body() dto: CreatePeriodontogramDto) {
    return this.service.create(req.user.clinicId, dto, req.user.userId);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Último periodontograma del paciente' })
  getLatest(@Request() req: any, @Param('patientId') patientId: string) {
    return this.service.getLatest(req.user.clinicId, patientId);
  }

  @Get('patient/:patientId/history')
  getHistory(@Request() req: any, @Param('patientId') patientId: string) {
    return this.service.getHistory(req.user.clinicId, patientId);
  }
}
