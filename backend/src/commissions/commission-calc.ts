/** RF-13: cálculo configurable de comisiones / honorarios. */
export type RuleType = 'PERCENT_GROSS' | 'PERCENT_AFTER_COST' | 'FIXED_AMOUNT';
export interface RuleLike { id?: string; name?: string; type: string; value: number | any; procedureId?: string | null; dentistId?: string | null }

/** Prioridad: odontólogo+procedimiento > procedimiento > odontólogo > regla general de la clínica. */
export function pickRule<T extends RuleLike>(rules: T[], dentistId: string, procedureId?: string | null): T | null {
  const score = (r: T) => {
    if (r.dentistId && r.dentistId !== dentistId) return -1;
    if (r.procedureId && r.procedureId !== procedureId) return -1;
    return (r.procedureId ? 2 : 0) + (r.dentistId ? 1 : 0);
  };
  let best: T | null = null;
  let bestScore = -1;
  for (const r of rules) {
    const s = score(r);
    if (s > bestScore) {
      best = r;
      bestScore = s;
    }
  }
  return best;
}

export function commissionFor(rule: RuleLike | null, amount: number, costs: { lab: number; materials: number }, defaultPct = 40) {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const type = (rule?.type ?? 'PERCENT_GROSS') as RuleType;
  const value = Number(rule?.value ?? defaultPct);
  const base = type === 'PERCENT_AFTER_COST' ? Math.max(0, amount - costs.lab - costs.materials) : amount;
  const commission = type === 'FIXED_AMOUNT' ? value : (base * value) / 100;
  return { type, value, base: r2(base), commission: r2(commission) };
}
