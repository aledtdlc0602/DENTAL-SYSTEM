import { createHash } from 'crypto';

/** RF-05: huella de la firma = SHA-256(id, autor, contenido S/O/E/P/libre, fecha de firma). */
export function signatureHashOf(
  note: { id: string; authorId: string; subjective?: string | null; objective?: string | null; assessment?: string | null; plan?: string | null; content?: string | null },
  signedAt: Date,
) {
  const payload = JSON.stringify([note.id, note.authorId, note.subjective ?? null, note.objective ?? null, note.assessment ?? null, note.plan ?? null, note.content ?? null, signedAt.toISOString()]);
  return createHash('sha256').update(payload).digest('hex');
}
