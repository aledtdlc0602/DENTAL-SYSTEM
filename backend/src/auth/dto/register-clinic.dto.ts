import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterClinicDto {
  @ApiProperty({ example: 'Clínica Dental Sonrisa' })
  @IsString()
  clinicName: string;

  @ApiPropertyOptional({ example: '1791234567001' })
  @IsOptional()
  @IsString()
  ruc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  clinicEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'admin@clinicadental.com' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  adminPassword: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  adminFirstName: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  adminLastName: string;
}
