import { Controller, Get, Post, Body, Patch, Param, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { ClinicalNotesService } from './clinical-notes.service';
import { Roles, R } from '../common/roles.decorator';

class CreateNoteDto {
  @ApiProperty() @IsString() patientId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() appointmentId?: string;
  @ApiPropertyOptional({ enum: ['SOAP', 'EVOLUTION'] }) @IsOptional() @IsIn(['SOAP', 'EVOLUTION']) noteType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subjective?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objective?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assessment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() plan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
}

class UpdateNoteDto extends PartialType(OmitType(CreateNoteDto, ['patientId', 'appointmentId', 'noteType'] as const)) {}

class AddendumDto {
  @ApiProperty() @IsString() content: string;
}

@ApiTags('Clinical Notes')
@ApiBearerAuth()
@Roles(...R.CLINICAL)
@Controller('clinical-notes')
export class ClinicalNotesController {
  constructor(private readonly service: ClinicalNotesService) {}

  @Post()
  @ApiOperation({ summary: 'RF-05: crear nota SOEP / evolución' })
  create(@Request() req: any, @Body() dto: CreateNoteDto) {
    return this.service.create(req.user.clinicId, dto, req.user.userId);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Bitácora cronológica de notas del paciente (auto-bloqueo por plazo)' })
  findByPatient(@Request() req: any, @Param('patientId') patientId: string) {
    return this.service.findByPatient(req.user.clinicId, patientId);
  }

  @Patch(':id/sign')
  @Roles('DENTIST')
  @ApiOperation({ summary: 'Firmar y bloquear la nota (solo el autor)' })
  sign(@Request() req: any, @Param('id') id: string) {
    return this.service.sign(req.user.clinicId, id, req.user.userId);
  }

  @Post(':id/addendum')
  @Roles('DENTIST')
  @ApiOperation({ summary: 'RN-01: adenda firmada que corrige una nota bloqueada' })
  addendum(@Request() req: any, @Param('id') id: string, @Body() dto: AddendumDto) {
    return this.service.addendum(req.user.clinicId, id, dto.content, req.user.userId);
  }

  @Get(':id/verify')
  @ApiOperation({ summary: 'Verificar integridad de la firma' })
  verify(@Request() req: any, @Param('id') id: string) {
    return this.service.verify(req.user.clinicId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar nota propia (solo si no está firmada ni vencida)' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.service.update(req.user.clinicId, id, dto, req.user.userId);
  }
}
