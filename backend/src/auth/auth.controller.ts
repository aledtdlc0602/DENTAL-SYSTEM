import { Controller, Post, Body, Get, Request, Ip, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterClinicDto } from './dto/register-clinic.dto';
import { Public, SkipMfa } from '../common/roles.decorator';

class MfaCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}

class MfaLoginDto extends MfaCodeDto {
  @ApiProperty()
  @IsString()
  mfaToken: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register-clinic')
  @ApiOperation({ summary: 'Registrar nueva clínica + administrador' })
  registerClinic(@Body() dto: RegisterClinicDto) {
    return this.authService.registerClinic(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión (si el usuario tiene MFA devuelve mfaRequired + mfaToken)' })
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') ua: string) {
    return this.authService.login(dto, { ip, userAgent: ua });
  }

  @Public()
  @Post('mfa/login')
  @ApiOperation({ summary: 'RNF-05: segundo paso del login con código TOTP' })
  mfaLogin(@Body() dto: MfaLoginDto, @Ip() ip: string, @Headers('user-agent') ua: string) {
    return this.authService.loginWithMfa(dto.mfaToken, dto.code, { ip, userAgent: ua });
  }

  @SkipMfa()
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener usuario actual' })
  me(@Request() req: any) {
    return this.authService.me(req.user.userId);
  }

  @SkipMfa()
  @Post('mfa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'RNF-05: generar secreto TOTP y QR' })
  setupMfa(@Request() req: any) {
    return this.authService.setupMfa(req.user.userId);
  }

  @SkipMfa()
  @Post('mfa/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'RNF-05: confirmar código y activar MFA' })
  verifyMfa(@Request() req: any, @Body() body: MfaCodeDto) {
    return this.authService.verifyMfa(req.user.userId, body.code);
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar MFA (requiere código vigente)' })
  disableMfa(@Request() req: any, @Body() body: MfaCodeDto) {
    return this.authService.disableMfa(req.user.userId, body.code);
  }
}
