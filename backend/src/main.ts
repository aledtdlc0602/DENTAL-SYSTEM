import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { securityHeaders } from './common/security';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // RNF-04/RNF-05: cabeceras de seguridad y sin firma del framework
  const http = app.getHttpAdapter().getInstance();
  http.disable?.('x-powered-by');
  http.set?.('trust proxy', 1); // IP real detrás de Railway / reverse proxy (auditoría RNF-06)
  app.use(securityHeaders);

  // CORS: en producción restringir
  const corsOrigin = process.env.CORS_ORIGIN;
  app.enableCors({
    origin: !corsOrigin || corsOrigin === 'true' ? true : corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api');

  // OpenAPI / Swagger v3 (criterio de aceptación Fase 4)
  const config = new DocumentBuilder()
    .setTitle('SIGO-Dental — Sistema Odontológico Integral')
    .setDescription(
      'API multi-tenant para clínicas dentales. ' +
        'Fases 1-4 (administrativo, clínico, finanzas/inventario/reportes, seguridad). ' +
        'Todas las rutas requieren JWT salvo login/registro/health. RBAC por rol y MFA TOTP. Documentación OpenAPI 3.0.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'JWT',
    )
    .addTag('Health', 'Health checks')
    .addTag('Auth', 'Autenticación y multi-tenant')
    .addTag('Patients', 'Gestión de pacientes')
    .addTag('Appointments', 'Agenda y turnos')
    .addTag('Treatment Plans', 'Planes y presupuestos')
    .addTag('Invoices / Caja', 'Facturación y cierre de caja')
    .addTag('Inventory', 'Inventario y descargo de insumos')
    .addTag('Commissions / Honorarios', 'Liquidación de profesionales')
    .addTag('Odontogram', 'Odontograma')
    .addTag('Periodontogram', 'Periodontograma')
    .addTag('Clinical Notes', 'Notas SOEP')
    .addTag('Consents', 'Consentimientos informados')
    .addTag('Prescriptions', 'Recetas')
    .addTag('Notifications', 'Notificaciones WhatsApp / SMS / Email (RF-11)')
    .addTag('Reports', 'Reportes BI y dashboard')
    .addTag('Settings / Audit', 'Configuración de la clínica y log de auditoría')
    .addTag('Users', 'Usuarios y roles')
    .addTag('Rooms', 'Sillones / consultorios')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Validación mínima de variables de entorno en producción
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.DATABASE_URL) {
      logger.error('DATABASE_URL es obligatoria en producción');
      process.exit(1);
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      logger.error('JWT_SECRET debe tener al menos 32 caracteres en producción');
      process.exit(1);
    }
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === 'true') {
      logger.warn('CORS_ORIGIN no está restringido: configure el dominio del frontend en producción');
    }
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}`);
  logger.log(`Swagger OpenAPI: http://localhost:${port}/docs`);
}
bootstrap();
