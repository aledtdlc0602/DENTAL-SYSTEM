import { Controller, Get, Post, Body, Param, Request, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { Roles, R } from '../common/roles.decorator';

class RxItemDto {
  @ApiProperty()
  @IsString()
  medication: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

class CreateRxDto {
  @ApiProperty()
  @IsString()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  indications?: string;

  @ApiProperty({ type: [RxItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RxItemDto)
  items: RxItemDto[];

  @ApiPropertyOptional() @IsOptional() @IsString() appointmentId?: string;

  @ApiPropertyOptional({ description: 'Confirmar prescripción pese a alergia registrada (queda anotado)' })
  @IsOptional() @IsBoolean() overrideAllergy?: boolean;
}

@ApiTags('Prescriptions')
@ApiBearerAuth()
@Roles(...R.CLINICAL)
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly service: PrescriptionsService) {}

  @Post()
  @Roles('DENTIST')
  @ApiOperation({ summary: 'Crear receta (valida alergias del paciente, RF-02)' })
  create(@Request() req: any, @Body() dto: CreateRxDto) {
    return this.service.create(req.user.clinicId, dto, req.user.userId);
  }

  @Get('patient/:patientId')
  list(@Request() req: any, @Param('patientId') patientId: string) {
    return this.service.listByPatient(req.user.clinicId, patientId);
  }

  @Patch(':id/sign')
  @Roles('DENTIST')
  @ApiOperation({ summary: 'Firmar receta (solo quien prescribe)' })
  sign(@Request() req: any, @Param('id') id: string) {
    return this.service.sign(req.user.clinicId, id, req.user.userId);
  }
}
