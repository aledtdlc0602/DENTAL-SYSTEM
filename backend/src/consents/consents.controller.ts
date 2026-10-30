import { Controller, Get, Post, Body, Param, Request, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';
import { ConsentsService } from './consents.service';
import { Roles, R } from '../common/roles.decorator';

class TemplateDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() bodyHtml: string;
  @ApiPropertyOptional() @IsOptional() @IsString() procedureCode?: string;
}

class CreateConsentDto {
  @ApiProperty() @IsString() patientId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() templateId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contentSnapshot?: string;
}

class SignConsentDto {
  @ApiPropertyOptional({ description: 'Firma manuscrita capturada en pantalla (data:image/png;base64,...)' })
  @IsOptional() @IsString() signatureData?: string;

  @ApiPropertyOptional({ description: 'Código OTP recibido por el paciente' })
  @IsOptional() @IsString() @Length(6, 6) otpCode?: string;
}

@ApiTags('Consents')
@ApiBearerAuth()
@Roles(...R.CLINICAL, ...R.FRONT_DESK)
@Controller('consents')
export class ConsentsController {
  constructor(private readonly service: ConsentsService) {}

  @Post('templates')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear plantilla de consentimiento' })
  createTemplate(@Request() req: any, @Body() dto: TemplateDto) {
    return this.service.createTemplate(req.user.clinicId, dto);
  }

  @Get('templates')
  listTemplates(@Request() req: any) {
    return this.service.listTemplates(req.user.clinicId);
  }

  @Post()
  @ApiOperation({ summary: 'RF-06: generar consentimiento (desde plantilla por procedimiento o texto libre)' })
  create(@Request() req: any, @Body() dto: CreateConsentDto) {
    return this.service.createConsent(req.user.clinicId, dto, req.user.userId);
  }

  @Get('patient/:patientId')
  listByPatient(@Request() req: any, @Param('patientId') patientId: string) {
    return this.service.listByPatient(req.user.clinicId, patientId);
  }

  @Post(':id/otp')
  @ApiOperation({ summary: 'RF-06: enviar código OTP al paciente' })
  sendOtp(@Request() req: any, @Param('id') id: string) {
    return this.service.sendOtp(req.user.clinicId, id);
  }

  @Patch(':id/sign')
  @ApiOperation({ summary: 'RF-06: firmar (firma en pantalla y/o código OTP)' })
  sign(@Request() req: any, @Param('id') id: string, @Body() dto: SignConsentDto) {
    return this.service.sign(req.user.clinicId, id, dto);
  }

  @Patch(':id/revoke')
  @ApiOperation({ summary: 'Revocar consentimiento' })
  revoke(@Request() req: any, @Param('id') id: string) {
    return this.service.revoke(req.user.clinicId, id);
  }
}
