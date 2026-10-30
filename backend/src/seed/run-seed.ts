/**
 * Carga datos demo desde la terminal.
 *
 *   npm run seed                              -> crea/usa la clínica demo (admin@demo.dental / Demo1234!)
 *   npm run seed -- --email=tu@correo.com     -> siembra la clínica a la que pertenece ese usuario
 *   npm run seed -- --clinic=<clinicId>       -> siembra una clínica por id
 *   npm run seed -- --reset                   -> borra los datos operativos de esa clínica y los regenera
 *   npm run seed -- --patients=100            -> cambia la cantidad de pacientes (mínimo 20)
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedClinicDemoData, DEMO_PASSWORD } from './demo-data';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);

async function main() {
  const prisma = new PrismaClient();
  try {
    let clinicId: string;
    let adminId: string | null = null;

    if (args.clinic) {
      const clinic = await prisma.clinic.findUnique({ where: { id: args.clinic } });
      if (!clinic) throw new Error(`No existe la clínica ${args.clinic}`);
      clinicId = clinic.id;
      adminId = (await prisma.user.findFirst({ where: { clinicId, role: 'ADMIN' } }))?.id ?? null;
    } else if (args.email) {
      const user = await prisma.user.findFirst({ where: { email: args.email } });
      if (!user) throw new Error(`No existe un usuario con email ${args.email}`);
      clinicId = user.clinicId;
      adminId = user.id;
    } else {
      const email = 'admin@demo.dental';
      let admin = await prisma.user.findFirst({ where: { email } });
      if (!admin) {
        const clinic = await prisma.clinic.create({
          data: {
            name: 'Clínica Dental Sonrisa Andina',
            legalName: 'SONRISA ANDINA ODONTOLOGÍA S.A.',
            ruc: '1792345678001',
            address: 'Av. Amazonas N34-120 y Av. República, Quito',
            phone: '02 245 6789',
            email: 'info@sonrisaandina.ec',
            plan: 'PRO',
            settings: { noteLockHours: 24, requireMfa: false, idleTimeoutMin: 15, sri: { ambiente: '1', establecimiento: '001', puntoEmision: '001', obligadoContabilidad: false } },
          },
        });
        admin = await prisma.user.create({
          data: {
            clinicId: clinic.id,
            email,
            passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
            firstName: 'Admin',
            lastName: 'Demo',
            role: 'ADMIN',
          },
        });
        console.log(`Clínica demo creada: ${clinic.name}`);
      }
      clinicId = admin.clinicId;
      adminId = admin.id;
    }

    console.log(`Sembrando clínica ${clinicId}${args.reset ? ' (con reset)' : ''}...`);
    const t0 = Date.now();
    const result: any = await seedClinicDemoData(prisma, clinicId, adminId, {
      reset: args.reset === 'true',
      patients: args.patients ? Number(args.patients) : undefined,
    });
    if (result.alreadySeeded) {
      console.log(result.message);
      return;
    }
    console.table(result.summary);
    console.log(`Listo en ${((Date.now() - t0) / 1000).toFixed(1)} s. Contraseña de todos los usuarios demo: ${result.password}`);
    if (!args.clinic && !args.email) console.log('Admin: admin@demo.dental');
    console.table(result.logins);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
