/**
 * RF-04: cálculos del periodontograma.
 * Convención: margen gingival positivo = recesión (apical a la LAC), negativo = agrandamiento gingival.
 * NIC (nivel de inserción clínica) = profundidad de sondaje + margen gingival.
 */
export interface SiteInput {
  toothNumber: number;
  probingDepths: number[];
  gingivalMargin?: number[];
  bleeding?: boolean[];
  mobility?: number | null;
  furcation?: number | null;
}

export function calcAttachment(pd: number[], gm: number[] = []) {
  return pd.map((d, i) => d + (gm[i] ?? 0));
}

export function validateSite(s: SiteInput): string | null {
  const t = s.toothNumber;
  if (!(t >= 11 && t <= 48 && t % 10 >= 1 && t % 10 <= 8)) return `Diente ${t} no válido (FDI permanente)`;
  if (!Array.isArray(s.probingDepths) || s.probingDepths.length !== 6) return `Diente ${t}: se requieren 6 profundidades (MB, B, DB, ML, L, DL)`;
  if (s.probingDepths.some((d) => !Number.isFinite(d) || d < 0 || d > 15)) return `Diente ${t}: profundidad fuera de rango (0–15 mm)`;
  if (s.gingivalMargin && (s.gingivalMargin.length !== 6 || s.gingivalMargin.some((g) => !Number.isFinite(g) || g < -10 || g > 15))) return `Diente ${t}: margen gingival inválido`;
  if (s.bleeding && s.bleeding.length !== 6) return `Diente ${t}: el sangrado debe tener 6 valores`;
  if (s.mobility != null && (s.mobility < 0 || s.mobility > 3)) return `Diente ${t}: movilidad 0–3`;
  if (s.furcation != null && (s.furcation < 0 || s.furcation > 3)) return `Diente ${t}: furca 0–3`;
  return null;
}

export function summarize(sites: { probingDepths: number[]; clinicalAttachment: number[]; bleeding: boolean[]; mobility?: number | null }[]) {
  const pds = sites.flatMap((s) => s.probingDepths);
  const cals = sites.flatMap((s) => s.clinicalAttachment);
  const bleeding = sites.flatMap((s) => s.bleeding);
  const n = pds.length || 1;
  const maxCal = cals.length ? Math.max(...cals) : 0;
  const bop = bleeding.length ? (bleeding.filter(Boolean).length / bleeding.length) * 100 : 0;
  // Orientación según clasificación AAP/EFP 2017 (estadio por NIC interproximal máximo)
  const stage = maxCal <= 0 ? 'Sin pérdida de inserción' : maxCal <= 2 ? 'Estadio I' : maxCal <= 4 ? 'Estadio II' : 'Estadio III/IV';
  return {
    teeth: sites.length,
    sites: pds.length,
    meanProbingDepth: Math.round((pds.reduce((a, b) => a + b, 0) / n) * 10) / 10,
    meanAttachment: Math.round((cals.reduce((a, b) => a + b, 0) / (cals.length || 1)) * 10) / 10,
    bleedingPct: Math.round(bop),
    sitesGte4: pds.filter((d) => d >= 4).length,
    sitesGte6: pds.filter((d) => d >= 6).length,
    maxAttachmentLoss: maxCal,
    mobileTeeth: sites.filter((s) => (s.mobility ?? 0) > 0).length,
    stageHint: stage,
  };
}
