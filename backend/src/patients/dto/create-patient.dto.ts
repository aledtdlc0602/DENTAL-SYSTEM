import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsArray,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  UNKNOWN = 'UNKNOWN',
}

export class CreatePatientDto {
  @ApiPropertyOptional({ default: 'CEDULA' })
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiProperty({ example: '0102030405' })
  @IsString()
  documentNumber: string;

  @ApiProperty({ example: 'María' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'García López' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '0987654321' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insuranceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insuranceNumber?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  // Historia médica básica al crear
  @ApiPropertyOptional({ type: [String], example: ['penicilina'] })
  @IsOptional()
  @IsArray()
  allergies?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  medications?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  systemicDiseases?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  surgicalHistory?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  habits?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  anticoagulated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bleedingDisorder?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPregnant?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(42)
  pregnancyWeeks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodType?: string;

  @ApiPropertyOptional({ description: 'Representante legal (obligatorio si es menor de edad)' })
  @IsOptional()
  @IsString()
  guardianName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guardianDocument?: string;

  @ApiPropertyOptional({ example: 'Madre' })
  @IsOptional()
  @IsString()
  guardianRelationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  alerts?: string[];
}

export class MedicalHistoryDto {
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() allergies?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() medications?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() systemicDiseases?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() surgicalHistory?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() habits?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() anticoagulated?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() bleedingDisorder?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPregnant?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(42) pregnancyWeeks?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() bloodType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ type: [String], description: 'Alertas manuales adicionales' }) @IsOptional() @IsArray() alerts?: string[];
}

export class GuardianDto {
  @ApiProperty() @IsString() fullName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() documentNumber?: string;
  @ApiProperty({ example: 'Madre' }) @IsString() relationship: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
}