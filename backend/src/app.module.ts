import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AuditInterceptor } from './common/audit.interceptor';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ProceduresModule } from './procedures/procedures.module';
import { TreatmentPlansModule } from './treatment-plans/treatment-plans.module';
import { OdontogramModule } from './odontogram/odontogram.module';
import { UsersModule } from './users/users.module';
import { ClinicalNotesModule } from './clinical-notes/clinical-notes.module';
import { RoomsModule } from './rooms/rooms.module';
import { InvoicesModule } from './invoices/invoices.module';
import { InventoryModule } from './inventory/inventory.module';
import { ConsentsModule } from './consents/consents.module';
import { PeriodontogramModule } from './periodontogram/periodontogram.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CommissionsModule } from './commissions/commissions.module';
import { SeedModule } from './seed/seed.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    ProceduresModule,
    TreatmentPlansModule,
    OdontogramModule,
    ClinicalNotesModule,
    RoomsModule,
    InvoicesModule,
    InventoryModule,
    ConsentsModule,
    PeriodontogramModule,
    PrescriptionsModule,
    NotificationsModule,
    CommissionsModule,
    SeedModule,
    ReportsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    // RNF-05: JWT + MFA + RBAC en TODAS las rutas (las públicas se marcan con @Public())
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RNF-06: auditoría automática de escrituras y consultas de expedientes
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
