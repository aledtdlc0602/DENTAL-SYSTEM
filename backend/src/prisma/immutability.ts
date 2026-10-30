/**
 * RN-01 / RF-05 / RNF-06: reglas de inmutabilidad aplicadas en la propia base de datos (PostgreSQL),
 * para que ni un error de la aplicación ni un acceso directo puedan borrar o alterar:
 *   - el log de auditoría (ninguna modificación ni borrado),
 *   - notas clínicas firmadas/bloqueadas (ni borrado de ninguna nota),
 *   - procedimientos registrados como "Realizado" (DONE) en odontograma y planes,
 *   - recetas firmadas y consentimientos firmados.
 * Única excepción: el reinicio de datos demo, que activa `SET LOCAL sigo.allow_purge = 'on'` dentro de su transacción.
 * Las sentencias son idempotentes y se aplican al iniciar la API.
 */
const guard = (name: string, body: string) => `
CREATE OR REPLACE FUNCTION ${name}() RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('sigo.allow_purge', true), '') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  ${body}
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`;

const trigger = (name: string, table: string, events: string, fn: string) => [
  `DROP TRIGGER IF EXISTS ${name} ON "${table}"`,
  `CREATE TRIGGER ${name} BEFORE ${events} ON "${table}" FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
];

export const IMMUTABILITY_SQL: string[] = [
  guard('sigo_audit_immutable', `RAISE EXCEPTION 'RNF-06: el log de auditoría es inmutable';`),
  ...trigger('trg_audit_immutable', 'audit_logs', 'UPDATE OR DELETE', 'sigo_audit_immutable'),

  guard(
    'sigo_note_immutable',
    `IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'RN-01: las notas clínicas no se pueden borrar; use una adenda'; END IF;
  IF OLD."isLocked" THEN RAISE EXCEPTION 'RF-05: la nota está firmada/bloqueada; use una adenda'; END IF;`,
  ),
  ...trigger('trg_note_immutable', 'clinical_notes', 'UPDATE OR DELETE', 'sigo_note_immutable'),

  guard('sigo_done_immutable', `IF OLD."status"::text = 'DONE' THEN RAISE EXCEPTION 'RN-01: un procedimiento Realizado no se puede modificar ni borrar'; END IF;`),
  ...trigger('trg_tooth_done_immutable', 'tooth_records', 'UPDATE OR DELETE', 'sigo_done_immutable'),
  ...trigger('trg_planitem_done_immutable', 'treatment_plan_items', 'UPDATE OR DELETE', 'sigo_done_immutable'),

  guard('sigo_rx_immutable', `IF OLD."isSigned" THEN RAISE EXCEPTION 'Receta firmada: no se puede modificar ni borrar'; END IF;`),
  ...trigger('trg_rx_immutable', 'prescriptions', 'UPDATE OR DELETE', 'sigo_rx_immutable'),

  guard('sigo_consent_immutable', `IF OLD."status" = 'SIGNED' AND (TG_OP = 'DELETE' OR NEW."status" <> 'REVOKED') THEN RAISE EXCEPTION 'Consentimiento firmado: solo puede revocarse'; END IF;`),
  ...trigger('trg_consent_immutable', 'consents', 'UPDATE OR DELETE', 'sigo_consent_immutable'),
];
