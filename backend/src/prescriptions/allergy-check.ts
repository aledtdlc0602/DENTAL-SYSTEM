/** RF-02: cruza los medicamentos de una receta con las alergias registradas del paciente. */
const FAMILIES: { allergy: RegExp; drugs: RegExp; label: string }[] = [
  { allergy: /penicil|amoxic|ampicil|betalact/i, drugs: /penicil|amoxic|ampicil|dicloxac|clavul|cefal|cefa|cefur|ceftr/i, label: 'betalactámicos (penicilina)' },
  { allergy: /aine|ibupro|aspirin|ácido acetil|acido acetil|diclofen|ketorol|naprox|nimesul/i, drugs: /ibupro|aspirin|diclofen|ketorol|naprox|nimesul|meloxic|celecox|metamiz/i, label: 'AINEs' },
  { allergy: /sulf/i, drugs: /sulfa|trimetoprim|cotrimox/i, label: 'sulfas' },
  { allergy: /lidoca|articai|mepiva|anest/i, drugs: /lidoca|articai|mepiva|prilocai|bupivac/i, label: 'anestésicos locales' },
  { allergy: /clindam|lincosam/i, drugs: /clindam|lincomic/i, label: 'lincosamidas' },
  { allergy: /metronid|nitroimid/i, drugs: /metronid|tinidaz/i, label: 'nitroimidazoles' },
];

export function allergyConflicts(allergies: string[], medications: string[]) {
  const out: { medication: string; allergy: string; family: string }[] = [];
  for (const med of medications) {
    for (const allergy of allergies) {
      const fam = FAMILIES.find((f) => f.allergy.test(allergy) && f.drugs.test(med));
      if (fam || med.toLowerCase().includes(allergy.toLowerCase().trim())) {
        out.push({ medication: med, allergy, family: fam?.label ?? allergy });
      }
    }
  }
  return out;
}
