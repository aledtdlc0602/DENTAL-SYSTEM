import { Controller, Get, Post, Patch, Body, Param, Request, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, R } from '../common/roles.decorator';

class CreateRoomDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

class UpdateRoomDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles(...R.ALL_STAFF)
  @ApiOperation({ summary: 'Listar sillones / consultorios' })
  findAll(@Request() req: any) {
    return this.prisma.room.findMany({ where: { clinicId: req.user.clinicId, isActive: true }, orderBy: { name: 'asc' } });
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear sillón / consultorio' })
  create(@Request() req: any, @Body() dto: CreateRoomDto) {
    return this.prisma.room.create({ data: { clinicId: req.user.clinicId, name: dto.name, description: dto.description } });
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Editar o desactivar sillón' })
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateRoomDto) {
    const room = await this.prisma.room.findFirst({ where: { id, clinicId: req.user.clinicId } });
    if (!room) throw new NotFoundException('Sillón no encontrado');
    return this.prisma.room.update({ where: { id }, data: dto });
  }
}
