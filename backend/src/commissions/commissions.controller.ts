import { Controller, Get, Post, Patch, Body, Param, Query, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CommissionsService } from './commissions.service';
import { Roles } from '../common/roles.decorator';

class RuleDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional({ enum: ['PERCENT_GROSS', 'PERCENT_AFTER_COST', 'FIXED_AMOUNT'] })
  @IsOptional() @IsIn(['PERCENT_GROSS', 'PERCENT_AFTER_COST', 'FIXED_AMOUNT']) type?: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) value: number;
  @ApiPropertyOptional() @IsOptional() @IsString() procedureId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dentistId?: string;
}

class UpdateRuleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['PERCENT_GROSS', 'PERCENT_AFTER_COST', 'FIXED_AMOUNT']) type?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) value?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('Commissions / Honorarios')
@ApiBearerAuth()
@Roles('ACCOUNTANT')
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly service: CommissionsService) {}

  @Post('rules')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'RF-13: crear regla (% bruto, % tras costos de laboratorio/materiales o monto fijo)' })
  createRule(@Request() req: any, @Body() body: RuleDto) {
    return this.service.createRule(req.user.clinicId, body);
  }

  @Patch('rules/:id')
  @Roles('ADMIN')
  updateRule(@Request() req: any, @Param('id') id: string, @Body() body: UpdateRuleDto) {
    return this.service.updateRule(req.user.clinicId, id, body);
  }

  @Get('rules')
  @Roles('ACCOUNTANT', 'DENTIST')
  listRules(@Request() req: any) {
    return this.service.listRules(req.user.clinicId);
  }

  @Get('settlement')
  @Roles('ACCOUNTANT', 'DENTIST')
  @ApiOperation({ summary: 'RF-13: liquidación de un odontólogo (el odontólogo solo ve la suya)' })
  @ApiQuery({ name: 'dentistId', required: true })
  @ApiQuery({ name: 'from', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: true, description: 'YYYY-MM-DD' })
  settlement(@Request() req: any, @Query('dentistId') dentistId: string, @Query('from') from: string, @Query('to') to: string) {
    if (req.user.role === 'DENTIST' && dentistId !== req.user.userId) throw new ForbiddenException('Solo puede consultar su propia liquidación');
    return this.service.calculateSettlement(req.user.clinicId, dentistId, from, to);
  }

  @Get('settlement/all')
  @ApiOperation({ summary: 'Resumen de honorarios de todos los odontólogos' })
  settlementAll(@Request() req: any, @Query('from') from: string, @Query('to') to: string) {
    return this.service.settlementAll(req.user.clinicId, from, to);
  }
}
