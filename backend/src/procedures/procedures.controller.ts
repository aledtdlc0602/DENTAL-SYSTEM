import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProceduresService } from './procedures.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { Roles, R } from '../common/roles.decorator';

@ApiTags('Procedures')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('procedures')
export class ProceduresController {
  constructor(private readonly service: ProceduresService) {}

  @Post()
  @ApiOperation({ summary: 'Crear procedimiento en el catálogo' })
  create(@Request() req: any, @Body() dto: CreateProcedureDto) {
    return this.service.create(req.user.clinicId, dto);
  }

  @Post('seed')
  @ApiOperation({ summary: 'Cargar catálogo básico (idempotente: no duplica)' })
  seed(@Request() req: any) {
    return this.service.seedDefaults(req.user.clinicId);
  }

  @Post('cleanup-duplicates')
  @ApiOperation({ summary: 'Desactivar procedimientos duplicados (deja 1 por nombre)' })
  cleanup(@Request() req: any) {
    return this.service.cleanupDuplicates(req.user.clinicId);
  }

  @Get()
  @Roles(...R.ALL_STAFF)
  @ApiOperation({ summary: 'Listar catálogo de procedimientos' })
  @ApiQuery({ name: 'category', required: false })
  findAll(@Request() req: any, @Query('category') category?: string) {
    return this.service.findAll(req.user.clinicId, category);
  }

  @Get(':id')
  @Roles(...R.ALL_STAFF)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.clinicId, id);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateProcedureDto) {
    return this.service.update(req.user.clinicId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.clinicId, id);
  }
}
