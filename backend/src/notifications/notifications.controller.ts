import { Controller, Get, Post, Body, Param, Request, Query, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsBoolean } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { Roles, R } from '../common/roles.decorator';
import { providerFor } from './providers';

class SendDto {
  @ApiProperty() @IsString() patientId: string;
  @ApiProperty({ enum: ['WHATSAPP', 'SMS', 'EMAIL'] }) @IsIn(['WHATSAPP', 'SMS', 'EMAIL']) channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  @ApiProperty() @IsString() toAddress: string;
  @ApiProperty() @IsString() body: string;
}

class TemplateDto {
  @ApiProperty({ enum: ['WHATSAPP', 'SMS', 'EMAIL'] }) @IsIn(['WHATSAPP', 'SMS', 'EMAIL']) channel: string;
  @ApiProperty({ example: 'REMINDER_24H' }) @IsString() eventType: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subject?: string;
  @ApiProperty() @IsString() body: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Roles(...R.FRONT_DESK, ...R.CLINICAL)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('send')
  @ApiOperation({ summary: 'Enviar mensaje manual al paciente' })
  send(@Request() req: any, @Body() body: SendDto) {
    return this.service.send(req.user.clinicId, { ...body, eventType: 'MANUAL' });
  }

  @Post('appointment/:id/reminders')
  @ApiOperation({ summary: 'Enviar recordatorio de una cita ahora' })
  remind(@Request() req: any, @Param('id') id: string) {
    return this.service.notifyAppointment(req.user.clinicId, id, 'REMINDER_24H');
  }

  @Post('run-reminders')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'RF-11: ejecutar ahora el planificador de recordatorios 48 h / 24 h para la clínica' })
  run(@Request() req: any) {
    return this.service.runReminders(new Date(), req.user.clinicId);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Historial de notificaciones' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'patientId', required: false })
  logs(@Request() req: any, @Query('status') status?: string, @Query('channel') channel?: string, @Query('patientId') patientId?: string) {
    return this.service.findLogs(req.user.clinicId, { status, channel, patientId });
  }

  @Get('providers')
  @ApiOperation({ summary: 'Proveedor activo por canal (meta / twilio / sendgrid / mock)' })
  providers() {
    return { WHATSAPP: providerFor('WHATSAPP'), SMS: providerFor('SMS'), EMAIL: providerFor('EMAIL') };
  }

  @Get('templates')
  templates(@Request() req: any) {
    return this.service.listTemplates(req.user.clinicId);
  }

  @Put('templates')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear/editar plantilla de mensaje (placeholders {{nombre}} {{fecha}} {{hora}} {{doctor}} {{clinica}})' })
  upsertTemplate(@Request() req: any, @Body() dto: TemplateDto) {
    return this.service.upsertTemplate(req.user.clinicId, dto);
  }
}
