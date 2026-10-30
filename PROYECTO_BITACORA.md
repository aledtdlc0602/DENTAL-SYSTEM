# Bitácora del proyecto SIGO-Dental

## Revisión contra el SRS v1.0 — 30/10/2026

La bitácora anterior marcaba las 4 fases al 100%, pero la revisión del código encontró brechas importantes. Se corrigieron así:

| Hallazgo | Corrección |
|---|---|
| Sin control de acceso por rol: cualquier usuario podía hacer todo | Guard global con JWT, RBAC (`@Roles`) en todas las rutas y rol nuevo `RECEPTIONIST` |
| MFA ficticio (aceptaba `000000` o los últimos 6 caracteres del secreto) | TOTP real RFC 6238, con QR y login en dos pasos; la clínica puede exigirlo |
| Sin cierre de sesión por inactividad | Cierre a los 15 min (configurable), con aviso previo y sincronizado entre pestañas |
| La auditoría no registraba IP, navegador ni consultas | Interceptor global con IP, user-agent, consultas a expedientes y exportaciones; tabla inmutable |
| RN-03 se validaba solo al crear la cita | Validación compartida al crear, editar, reactivar y agendar desde presupuestos |
| RN-01: se podían sobrescribir procedimientos realizados; no había adenda | Triggers en PostgreSQL, odontograma versionado y adendas firmadas |
| RN-02: el total teórico era visible para todos | El total teórico es solo para contador y admin; la recepción ve la diferencia después del conteo; un cierre por día |
| RF-14: el descargo de insumos nunca se disparaba | Se ejecuta al completar la cita (campo `procedureId` en la cita) |
| RF-13: comisiones calculadas con el precio de "Consulta" para todo | Valor real del procedimiento, costos de laboratorio y materiales, y prioridad de reglas |
| RF-11: no había recordatorios automáticos | Planificador de 48 h y 24 h, y proveedores Meta/Twilio/SendGrid |
| RF-02: editar un paciente con alergias daba error; no se podía actualizar la anamnesis | Endpoint propio de anamnesis, alertas automáticas y control de alergias en recetas |
| RF-05: plazo de bloqueo fijo y cualquiera podía firmar | Plazo configurable; firma solo del autor con hash SHA-256 |
| RF-06: la firma era el texto "SIGNED_ON_SCREEN" | Firma en lienzo táctil y código OTP |
| RF-07/08: presupuesto de un solo ítem; sin aprobación parcial | Fases, laboratorio, descuentos autorizados, aprobación parcial y agendamiento |
| RF-12: número de factura `F-000001` sin SRI | Numeración SRI, clave de acceso de 49 dígitos y XML v1.1.0 |
| Frontend: periodontograma de texto, agenda sin semana ni filtros; sin pantallas de caja ciega, honorarios, reportes, usuarios y auditoría | Pantallas nuevas o reescritas |

### Verificación realizada
- Backend y frontend compilan con TypeScript en modo estricto.
- 118 escenarios de punta a punta sobre los servicios reales (con base simulada que valida el esquema Prisma).
- 26 pruebas unitarias de reglas de negocio, incluidos los vectores oficiales de TOTP del RFC 6238.
- Triggers de inmutabilidad probados en PostgreSQL 16 real.

### Pendiente real
- Firma XAdES y envío al SRI (requiere certificado `.p12` y un servicio de firma).
- Credenciales de WhatsApp Business, Twilio y SendGrid.
- Pasarela de pagos, PACS/DICOM y PWA para pacientes.
- Pruebas de integración con base real hasta ≥80% de cobertura, y DAST/SAST en CI.
