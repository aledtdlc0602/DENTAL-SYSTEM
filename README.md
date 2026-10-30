# SIGO-Dental — Sistema Integral de Gestión Odontológica

SaaS multi-clínica para Ecuador · NestJS 11 + Prisma 6 + PostgreSQL · Next.js 15 + Tailwind.

```
DENTAL_SYSTEM/
├── backend/            API REST (NestJS) · Swagger en /docs
│   ├── prisma/schema.prisma
│   ├── src/            módulos: auth, patients, appointments, odontogram, periodontogram,
│   │                   clinical-notes, consents, prescriptions, treatment-plans, invoices,
│   │                   inventory, commissions, notifications, reports, settings, seed…
│   └── .env.example
├── frontend/           Web (Next.js)
├── docker-compose.yml  PostgreSQL local opcional
└── package.json        workspaces + scripts para correr todo junto
```

---

## Ejecutar en Visual Studio Code (local)

**Requisitos:** Node.js 22 LTS (o 20+) y VS Code. Para la base de datos puede usar la de Neon que ya está en `backend/.env`, o una local con Docker Desktop.

1. **Abrir el proyecto:** VS Code → *Archivo → Abrir carpeta…* → `DENTAL_SYSTEM`. Abra una terminal (*Terminal → Nueva terminal*).

2. **Instalar dependencias** (backend y frontend a la vez):
   ```bash
   npm install
   ```

3. **Base de datos** — elija una opción:
   - **A. Neon (ya configurada):** `backend/.env` ya tiene `DATABASE_URL`. No hay que hacer nada más.
   - **B. Local con Docker:** `npm run db:up` y en `backend/.env` ponga
     `DATABASE_URL="postgresql://sigo:sigo@localhost:5432/sigo_dental"`.
   - Si no existe `backend/.env`, cópielo del ejemplo: `copy backend\.env.example backend\.env` (Windows) o `cp backend/.env.example backend/.env` (Mac/Linux).

4. **Crear/actualizar las tablas:**
   ```bash
   npm run db:push
   ```

5. **Cargar datos demo** (20 usuarios, 60 pacientes, ~300 citas, facturas, inventario…):
   ```bash
   npm run seed
   ```

6. **Levantar API + Web:**
   ```bash
   npm run dev
   ```
   También puede usar *Terminal → Ejecutar tarea… → "SIGO: Iniciar todo"*.

7. **Abrir:**
   - Web: http://localhost:3000
   - API / Swagger: http://localhost:3001/docs
   - Health: http://localhost:3001/api/health

### Usuarios demo (clave `Demo1234!` para todos)

| Rol | Email | Qué puede hacer |
|---|---|---|
| Administrador | `admin@demo.dental` | Todo: configuración, usuarios, auditoría |
| Odontólogo | `dra.martinez@demo.dental` | Expediente, odontograma, notas SOEP, recetas, presupuestos |
| Recepción / caja | `recepcion1@demo.dental` | Pacientes, agenda, cobros, cierre de caja ciego |
| Asistente dental | `asistente1@demo.dental` | Agenda, notas clínicas, inventario |
| Contador / auditor | `caja@demo.dental` | Reportes, honorarios, cierres, inventario |

> Si `npm run db:push` falla en la base Neon por datos antiguos (por ejemplo números de factura repetidos), use una base vacía (opción B, o una nueva *branch* en Neon) y vuelva a los pasos 4 y 5.

### Otros comandos

```bash
npm test                         # pruebas unitarias del backend (Jest)
npm run seed -- --email=tu@correo.com            # datos demo en la clínica de un usuario existente
npm run seed:reset -- --email=tu@correo.com      # borra y regenera los datos de esa clínica
npm run db:studio                # explorar la base con Prisma Studio
```

---

## Cumplimiento del SRS v1.0

| Requisito | Implementación |
|---|---|
| **RF-01** Registro unificado | Ficha única con validación de cédula ecuatoriana; representante legal **obligatorio** si es menor; seguro/convenio. |
| **RF-02** Anamnesis y alertas | Anamnesis obligatoria (alergias, medicación, enfermedades, cirugías, anticoagulación, coagulopatías, embarazo). Las alertas críticas se generan solas y se muestran en rojo en la cabecera del expediente, en la agenda y en el buscador. Las recetas se bloquean si chocan con una alergia registrada. |
| **RF-03** Odontograma | 32 permanentes + 20 temporales, notación **FDI y Universal**, marcado por **superficie** (M, D, O/I, V, L), caries en rojo, realizados en azul, sellantes, endodoncia, coronas, implantes, prótesis, exodoncias. Versionado. |
| **RF-04** Periodontograma | 6 puntos por diente, margen gingival, **NIC calculado**, sangrado, movilidad, furca; resumen e historial. |
| **RF-05** Notas SOEP | Bloqueo automático por plazo **configurable** (24 h por defecto); firma solo del autor con huella SHA-256 verificable; correcciones por **adenda firmada**. |
| **RF-06** Consentimientos | Plantillas por procedimiento; firma manuscrita en pantalla táctil y/o **código OTP** enviado al paciente; impresión y revocación. |
| **RF-07** Presupuestos multinivel | Fases, costo de laboratorio, descuentos por ítem y generales; un descuento mayor al 10% necesita un administrador. |
| **RF-08** Aprobación y citas | Aprobación **total o parcial**; los ítems aprobados se convierten en citas enlazadas. Al atender la cita, el ítem queda como Realizado. |
| **RF-09** Agenda | Vista **día y semana**, columnas por sillón u odontólogo, filtros. |
| **RF-10** Estados de cita | Los 7 estados, con transiciones válidas controladas. |
| **RF-11** Notificaciones | Confirmación al agendar y recordatorios **48 h y 24 h** automáticos (cada 10 min, de 07:00 a 21:00, sin duplicados). Proveedores: WhatsApp Meta Cloud API, Twilio SMS y SendGrid Email; sin credenciales funcionan en modo prueba. |
| **RF-12** Facturación electrónica | Numeración SRI `001-001-000000123`, **clave de acceso de 49 dígitos (módulo 11)** y XML de la factura v1.1.0 descargable; pagos mixtos (efectivo, tarjeta, transferencia, seguro). |
| **RF-13** Honorarios | Reglas de % bruto, monto fijo por procedimiento o % después de laboratorio y materiales, con prioridad odontólogo+procedimiento → procedimiento → odontólogo → general. Liquidación por profesional y resumen. |
| **RF-14** Descargo de insumos | Al pasar una cita a *Atendido* se descuenta su receta de consumo una sola vez. Kardex y alertas de stock mínimo. |
| **RN-01** Inmutabilidad | Triggers en PostgreSQL impiden borrar o alterar procedimientos realizados, notas firmadas, recetas y consentimientos firmados. El odontograma conserva lo realizado entre versiones. |
| **RN-02** Cierre ciego | Recepción registra el conteo sin ver el total del sistema; la diferencia se revela al guardar; un cierre por día. |
| **RN-03** Sillones | Se valida al crear, reprogramar, reactivar y al agendar desde presupuestos (también el mismo odontólogo y el mismo paciente). |
| **RNF-04** Cifrado | TLS en el hosting; cabeceras de seguridad (HSTS en producción); cifrado en reposo del proveedor de BD (Neon/Railway, AES-256). |
| **RNF-05** Autenticación | RBAC en **todas** las rutas (guard global); **MFA TOTP real** (RFC 6238, QR para Google Authenticator) que la clínica puede exigir; cierre por **15 min de inactividad**; bloqueo tras 5 intentos fallidos. |
| **RNF-06** Auditoría | Interceptor global que registra creación, modificación, firma, exportación y **consulta** de expedientes con IP, navegador y fecha ISO-8601. Tabla inmutable por trigger. Pantalla de consulta para el administrador. |
| **Fase 3** Reportes BI | Ingresos por día y medio de pago, producción por odontólogo, ausentismo, conversión de presupuestos, costo de insumos. |
| **Fase 4** | Swagger OpenAPI 3, health check, pruebas unitarias de reglas de negocio (`backend/src/__tests__`). |

### Pendiente fuera del código (requiere servicios o credenciales externas)

- **SRI:** firmar el XML (XAdES-BES con su certificado `.p12`) y enviarlo a los web services de recepción y autorización. El sistema ya genera la clave de acceso y el XML; falta conectar un servicio de firma.
- **WhatsApp, SMS y Email reales:** cargar las credenciales en `backend/.env`. WhatsApp exige plantillas aprobadas por Meta para mensajes iniciados por la clínica.
- **Pasarela de pagos** (Stripe, dLocal, bancos), **PACS/DICOM**, portal **PWA** del paciente y **app móvil** (Fase 2 según el SRS).
- **Cobertura ≥80% y escaneo DAST/SAST:** requieren pruebas de integración con una base de pruebas y un pipeline de CI.

---

## Despliegue (Railway)

1. Root Directory: `backend` · Build: `npm install && npx prisma generate && npm run build` · Start: `npx prisma db push && node dist/main`
2. Variables: `DATABASE_URL`, `JWT_SECRET` (32+ caracteres), `NODE_ENV=production`, `CORS_ORIGIN=https://su-frontend`
3. Frontend (Vercel/Railway): `NEXT_PUBLIC_API_URL=https://su-api/api`
4. Datos demo en producción (opcional): `npm run seed:prod`
