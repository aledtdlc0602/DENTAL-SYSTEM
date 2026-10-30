import { Controller, Get, Post, Patch, Body, Query, Param, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsArray, MinLength, IsIn, IsBoolean, Matches } from 'class-validator';
import { UsersService } from './users.service';
import { Roles, R, SkipMfa } from '../common/roles.decorator';

const STRONG = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

class CreateUserDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ description: 'Mínimo 8 caracteres con letras y números' }) @IsString() @Matches(STRONG, { message: 'La contraseña debe tener al menos 8 caracteres, con letras y números' }) password: string;
  @ApiProperty() @IsString() firstName: string;
  @ApiProperty() @IsString() lastName: string;
  @ApiPropertyOptional({ enum: ['ADMIN', 'DENTIST', 'RECEPTIONIST', 'ASSISTANT', 'ACCOUNTANT'] })
  @IsOptional() @IsIn(['ADMIN', 'DENTIST', 'RECEPTIONIST', 'ASSISTANT', 'ACCOUNTANT']) role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() specialties?: string[];
}

class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['ADMIN', 'DENTIST', 'RECEPTIONIST', 'ASSISTANT', 'ACCOUNTANT']) role?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() specialties?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(STRONG, { message: 'La contraseña debe tener al menos 8 caracteres, con letras y números' }) password?: string;
}

class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword: string;
  @ApiProperty() @IsString() @MinLength(8) @Matches(STRONG, { message: 'La contraseña debe tener al menos 8 caracteres, con letras y números' }) newPassword: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @Roles(...R.ALL_STAFF)
  @ApiOperation({ summary: 'Listar usuarios de la clínica' })
  @ApiQuery({ name: 'role', required: false, description: 'uno o varios separados por coma' })
  @ApiQuery({ name: 'includeInactive', required: false })
  findAll(@Request() req: any, @Query('role') role?: string, @Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(req.user.clinicId, role, includeInactive === 'true' && ['ADMIN', 'SUPERADMIN'].includes(req.user.role));
  }

  @Get('dentists')
  @Roles(...R.ALL_STAFF)
  @ApiOperation({ summary: 'Listar odontólogos' })
  findDentists(@Request() req: any) {
    return this.service.findDentists(req.user.clinicId);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Crear usuario (solo administrador)' })
  create(@Request() req: any, @Body() dto: CreateUserDto) {
    return this.service.create(req.user.clinicId, dto);
  }

  @Patch('me/password')
  @SkipMfa()
  @ApiOperation({ summary: 'Cambiar mi contraseña' })
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.service.changeOwnPassword(req.user.userId, dto.currentPassword, dto.newPassword);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Editar usuario: rol, especialidades, activar/desactivar, nueva contraseña' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(req.user.clinicId, id, req.user.userId, dto);
  }

  @Patch(':id/reset-mfa')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Quitar MFA a un usuario (pérdida de teléfono)' })
  resetMfa(@Request() req: any, @Param('id') id: string) {
    return this.service.resetMfa(req.user.clinicId, id);
  }
}
