import {
  Controller, Get, Post, Body, Param, Query, Request, Patch, Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsIn, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { Roles, R } from '../common/roles.decorator';

class InvoiceItemDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

class CreateInvoiceDto {
  @ApiProperty()
  @IsString()
  patientId: string;

  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Emitir inmediatamente' })
  @IsOptional()
  @IsBoolean()
  issue?: boolean;
}

class BlindCloseDto {
  @ApiPropertyOptional({ description: 'YYYY-MM-DD (por defecto hoy)' }) @IsOptional() @IsString() date?: string;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) physicalCash: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) physicalCard?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) physicalTransfer?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

class CancelDto {
  @ApiProperty() @IsString() reason: string;
}

class PaymentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: ['CASH', 'CARD', 'TRANSFER', 'CHECK', 'INSURANCE', 'OTHER'] })
  @IsIn(['CASH', 'CARD', 'TRANSFER', 'CHECK', 'INSURANCE', 'OTHER'])
  method: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Invoices / Caja')
@ApiBearerAuth()
@Roles(...R.FRONT_DESK, ...R.FINANCE)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear factura (borrador o emitida con issue=true)' })
  create(@Request() req: any, @Body() dto: CreateInvoiceDto) {
    return this.service.create(req.user.clinicId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar facturas' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  findAll(@Request() req: any, @Query('patientId') patientId?: string, @Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.findAll(req.user.clinicId, { patientId, status, from, to });
  }

  @Get('reports/daily-close')
  @Roles(...R.FINANCE)
  @ApiOperation({ summary: 'Resumen teórico del día (solo contador/admin: RN-02)' })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  dailyClose(@Request() req: any, @Query('date') date?: string) {
    return this.service.dailyCashClose(req.user.clinicId, date);
  }

  @Get('reports/blind-close/status')
  @ApiOperation({ summary: 'Si la caja del día ya fue cerrada (sin revelar montos)' })
  blindStatus(@Request() req: any, @Query('date') date?: string) {
    return this.service.blindCloseStatus(req.user.clinicId, date);
  }

  @Post('reports/blind-close')
  @ApiOperation({ summary: 'RN-02 cierre de caja CIEGO: registrar conteo físico; luego se revela teórico y diferencia' })
  blindClose(@Request() req: any, @Body() body: BlindCloseDto) {
    return this.service.blindCashClose(req.user.clinicId, body, req.user);
  }

  @Get('reports/cash-closes')
  @Roles(...R.FINANCE)
  @ApiOperation({ summary: 'Historial de cierres de caja' })
  listCloses(@Request() req: any) {
    return this.service.listCashCloses(req.user.clinicId);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.clinicId, id);
  }

  @Get(':id/sri-xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiOperation({ summary: 'RF-12: XML del comprobante electrónico SRI (factura v1.1.0, sin firmar)' })
  sriXml(@Request() req: any, @Param('id') id: string) {
    return this.service.sriXml(req.user.clinicId, id);
  }

  @Patch(':id/issue')
  @ApiOperation({ summary: 'Emitir factura (numeración SRI + clave de acceso)' })
  issue(@Request() req: any, @Param('id') id: string) {
    return this.service.issue(req.user.clinicId, id);
  }

  @Patch(':id/cancel')
  @Roles(...R.FINANCE)
  @ApiOperation({ summary: 'Anular factura sin pagos' })
  cancel(@Request() req: any, @Param('id') id: string, @Body() dto: CancelDto) {
    return this.service.cancel(req.user.clinicId, id, dto.reason);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Registrar pago / abono (pagos mixtos)' })
  addPayment(@Request() req: any, @Param('id') id: string, @Body() dto: PaymentDto) {
    return this.service.addPayment(req.user.clinicId, id, dto);
  }
}
