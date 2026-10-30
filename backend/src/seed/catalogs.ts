/**
 * Catálogos estáticos usados por el generador de datos demo.
 * Todo el contenido es ficticio, pensado para una clínica odontológica en Ecuador.
 */

export const ROOMS = [
  ...Array.from({ length: 12 }, (_, i) => ({
    name: `Sillón ${i + 1}`,
    description: i < 4 ? 'Sillón de operatoria general' : i < 8 ? 'Sillón de especialidades' : 'Sillón de higiene y prevención',
  })),
  { name: 'Consultorio A', description: 'Valoración y primeras consultas' },
  { name: 'Consultorio B', description: 'Valoración y primeras consultas' },
  { name: 'Consultorio C', description: 'Ortodoncia' },
  { name: 'Consultorio D', description: 'Odontopediatría' },
  { name: 'Quirófano 1', description: 'Cirugía oral e implantología' },
  { name: 'Quirófano 2', description: 'Cirugía periodontal' },
  { name: 'Sala de Rayos X', description: 'Radiografía periapical y panorámica' },
  { name: 'Sala de Estética', description: 'Blanqueamiento y carillas' },
];

// Incluye los 3 odontólogos del seed anterior para reutilizarlos si ya existen.
export const STAFF = [
  { email: 'dra.martinez@demo.dental', firstName: 'Ana', lastName: 'Martínez', role: 'DENTIST', specialties: ['Operatoria', 'Endodoncia'] },
  { email: 'dr.lopez@demo.dental', firstName: 'Carlos', lastName: 'López', role: 'DENTIST', specialties: ['Cirugía', 'Implantología'] },
  { email: 'dra.ruiz@demo.dental', firstName: 'Elena', lastName: 'Ruiz', role: 'DENTIST', specialties: ['Ortodoncia', 'Estética'] },
  { email: 'dr.andrade@demo.dental', firstName: 'Santiago', lastName: 'Andrade', role: 'DENTIST', specialties: ['Periodoncia'] },
  { email: 'dra.cevallos@demo.dental', firstName: 'Gabriela', lastName: 'Cevallos', role: 'DENTIST', specialties: ['Odontopediatría'] },
  { email: 'dr.paredes@demo.dental', firstName: 'Marco', lastName: 'Paredes', role: 'DENTIST', specialties: ['Rehabilitación oral', 'Prótesis'] },
  { email: 'dra.villacis@demo.dental', firstName: 'Daniela', lastName: 'Villacís', role: 'DENTIST', specialties: ['Endodoncia'] },
  { email: 'dr.jaramillo@demo.dental', firstName: 'Xavier', lastName: 'Jaramillo', role: 'DENTIST', specialties: ['Cirugía maxilofacial'] },
  { email: 'dra.proano@demo.dental', firstName: 'Verónica', lastName: 'Proaño', role: 'DENTIST', specialties: ['Ortodoncia'] },
  { email: 'dr.chiriboga@demo.dental', firstName: 'Esteban', lastName: 'Chiriboga', role: 'DENTIST', specialties: ['Implantología', 'Rehabilitación oral'] },
  { email: 'dra.salazar@demo.dental', firstName: 'Paola', lastName: 'Salazar', role: 'DENTIST', specialties: ['Estética', 'Operatoria'] },
  { email: 'dr.benitez@demo.dental', firstName: 'Pablo', lastName: 'Benítez', role: 'DENTIST', specialties: ['Odontología general'] },
  { email: 'recepcion1@demo.dental', firstName: 'Katherine', lastName: 'Moreira', role: 'RECEPTIONIST', specialties: [] },
  { email: 'recepcion2@demo.dental', firstName: 'Jessica', lastName: 'Toapanta', role: 'RECEPTIONIST', specialties: [] },
  { email: 'asistente1@demo.dental', firstName: 'Mishell', lastName: 'Quishpe', role: 'ASSISTANT', specialties: [] },
  { email: 'asistente2@demo.dental', firstName: 'Byron', lastName: 'Cedeño', role: 'ASSISTANT', specialties: [] },
  { email: 'asistente3@demo.dental', firstName: 'Doménica', lastName: 'Viteri', role: 'ASSISTANT', specialties: [] },
  { email: 'caja@demo.dental', firstName: 'Wilson', lastName: 'Espinoza', role: 'ACCOUNTANT', specialties: [] },
  { email: 'contabilidad@demo.dental', firstName: 'Rosa', lastName: 'Aguirre', role: 'ACCOUNTANT', specialties: [] },
  { email: 'gerencia@demo.dental', firstName: 'Fernando', lastName: 'Pazmiño', role: 'ADMIN', specialties: [] },
] as const;

// Nombres exactos de los procedimientos que ya crean el registro y el seed anterior se reutilizan.
export const PROCEDURES = [
  { code: 'GEN-01', name: 'Consulta / Evaluación', category: 'General', price: 20, durationMin: 30 },
  { code: 'GEN-02', name: 'Consulta de urgencia', category: 'General', price: 30, durationMin: 30 },
  { code: 'GEN-03', name: 'Control post-operatorio', category: 'General', price: 10, durationMin: 20 },
  { code: 'DX-01', name: 'Radiografía periapical', category: 'Diagnóstico', price: 10, durationMin: 10 },
  { code: 'DX-02', name: 'Radiografía panorámica', category: 'Diagnóstico', price: 25, durationMin: 15 },
  { code: 'DX-03', name: 'Radiografía de aleta de mordida', category: 'Diagnóstico', price: 12, durationMin: 10 },
  { code: 'DX-04', name: 'Tomografía CBCT (zona)', category: 'Diagnóstico', price: 80, durationMin: 20 },
  { code: 'DX-05', name: 'Modelos de estudio', category: 'Diagnóstico', price: 30, durationMin: 20 },
  { code: 'PRE-01', name: 'Limpieza dental (profilaxis)', category: 'Preventiva', price: 35, durationMin: 45 },
  { code: 'PRE-02', name: 'Aplicación de flúor', category: 'Preventiva', price: 15, durationMin: 15 },
  { code: 'PRE-03', name: 'Sellante de fosas y fisuras (por diente)', category: 'Preventiva', price: 15, durationMin: 15 },
  { code: 'PRE-04', name: 'Destartraje supragingival', category: 'Preventiva', price: 40, durationMin: 45 },
  { code: 'OP-01', name: 'Obturación simple', category: 'Operatoria', price: 40, durationMin: 40 },
  { code: 'OP-02', name: 'Obturación simple (1 superficie)', category: 'Operatoria', price: 40, durationMin: 40 },
  { code: 'OP-03', name: 'Obturación compuesta (2 superficies)', category: 'Operatoria', price: 55, durationMin: 50 },
  { code: 'OP-04', name: 'Obturación compleja (3+ superficies)', category: 'Operatoria', price: 70, durationMin: 60 },
  { code: 'OP-05', name: 'Reconstrucción con poste de fibra', category: 'Operatoria', price: 90, durationMin: 60 },
  { code: 'END-01', name: 'Endodoncia unirradicular', category: 'Endodoncia', price: 120, durationMin: 90 },
  { code: 'END-02', name: 'Endodoncia birradicular', category: 'Endodoncia', price: 160, durationMin: 90 },
  { code: 'END-03', name: 'Endodoncia multirradicular', category: 'Endodoncia', price: 220, durationMin: 120 },
  { code: 'END-04', name: 'Retratamiento endodóntico', category: 'Endodoncia', price: 250, durationMin: 120 },
  { code: 'END-05', name: 'Pulpotomía (diente temporal)', category: 'Endodoncia', price: 45, durationMin: 40 },
  { code: 'PER-01', name: 'Raspado y alisado radicular (por cuadrante)', category: 'Periodoncia', price: 60, durationMin: 60 },
  { code: 'PER-02', name: 'Cirugía periodontal a colgajo (por cuadrante)', category: 'Periodoncia', price: 180, durationMin: 90 },
  { code: 'PER-03', name: 'Gingivectomía (por sector)', category: 'Periodoncia', price: 120, durationMin: 60 },
  { code: 'CIR-01', name: 'Extracción simple', category: 'Cirugía', price: 50, durationMin: 30 },
  { code: 'CIR-02', name: 'Extracción quirúrgica', category: 'Cirugía', price: 90, durationMin: 60 },
  { code: 'CIR-03', name: 'Extracción de tercer molar incluido', category: 'Cirugía', price: 180, durationMin: 90 },
  { code: 'CIR-04', name: 'Extracción de diente temporal', category: 'Cirugía', price: 25, durationMin: 20 },
  { code: 'CIR-05', name: 'Frenectomía', category: 'Cirugía', price: 120, durationMin: 45 },
  { code: 'IMP-01', name: 'Implante dental (fase quirúrgica)', category: 'Implantología', price: 850, durationMin: 90, labCost: 300 },
  { code: 'IMP-02', name: 'Corona sobre implante', category: 'Implantología', price: 650, durationMin: 60, labCost: 220 },
  { code: 'IMP-03', name: 'Injerto óseo', category: 'Implantología', price: 350, durationMin: 60, labCost: 120 },
  { code: 'PRO-01', name: 'Corona metal-porcelana', category: 'Prótesis', price: 280, durationMin: 60, labCost: 90 },
  { code: 'PRO-02', name: 'Corona de zirconio', category: 'Prótesis', price: 420, durationMin: 60, labCost: 150 },
  { code: 'PRO-03', name: 'Prótesis parcial removible', category: 'Prótesis', price: 380, durationMin: 45, labCost: 120 },
  { code: 'PRO-04', name: 'Prótesis total (por arcada)', category: 'Prótesis', price: 450, durationMin: 45, labCost: 150 },
  { code: 'PRO-05', name: 'Incrustación cerámica', category: 'Prótesis', price: 300, durationMin: 60, labCost: 100 },
  { code: 'ORT-01', name: 'Instalación de brackets metálicos', category: 'Ortodoncia', price: 600, durationMin: 90, labCost: 120 },
  { code: 'ORT-02', name: 'Control mensual de ortodoncia', category: 'Ortodoncia', price: 50, durationMin: 30 },
  { code: 'ORT-03', name: 'Retenedor removible', category: 'Ortodoncia', price: 120, durationMin: 30, labCost: 40 },
  { code: 'EST-01', name: 'Blanqueamiento en consultorio', category: 'Estética', price: 220, durationMin: 90 },
  { code: 'EST-02', name: 'Carilla de resina', category: 'Estética', price: 120, durationMin: 60 },
  { code: 'EST-03', name: 'Carilla de porcelana', category: 'Estética', price: 400, durationMin: 60, labCost: 130 },
];

// Nombres exactos de los productos del seed anterior se reutilizan.
export const PRODUCTS = [
  { sku: 'GLOV-100', name: 'Guantes de látex (caja x100)', unit: 'CAJA', unitCost: 8.5, minStock: 5 },
  { sku: 'GLOV-NIT', name: 'Guantes de nitrilo (caja x100)', unit: 'CAJA', unitCost: 9.5, minStock: 8 },
  { sku: 'MAS-50', name: 'Mascarillas quirúrgicas (caja)', unit: 'CAJA', unitCost: 6, minStock: 5 },
  { sku: 'ANES-LID', name: 'Anestesia Lidocaína 2%', unit: 'CARPULE', unitCost: 3.2, minStock: 30 },
  { sku: 'ANES-ART', name: 'Anestesia Articaína 4%', unit: 'CARPULE', unitCost: 4.1, minStock: 20 },
  { sku: 'ANES-MEP', name: 'Mepivacaína 3% sin vasoconstrictor', unit: 'CARPULE', unitCost: 3.8, minStock: 15 },
  { sku: 'AGU-27', name: 'Agujas dentales 27G', unit: 'UND', unitCost: 0.5, minStock: 40 },
  { sku: 'AGU-30', name: 'Agujas dentales 30G cortas', unit: 'UND', unitCost: 0.55, minStock: 40 },
  { sku: 'RES-A2', name: 'Resina compuesta A2', unit: 'JERINGA', unitCost: 25, minStock: 5 },
  { sku: 'RES-A3', name: 'Resina compuesta A3', unit: 'JERINGA', unitCost: 25, minStock: 5 },
  { sku: 'RES-FLU', name: 'Resina fluida A2', unit: 'JERINGA', unitCost: 18, minStock: 4 },
  { sku: 'ADH-UNI', name: 'Adhesivo universal (frasco 5 ml)', unit: 'FRASCO', unitCost: 42, minStock: 2 },
  { sku: 'ACI-37', name: 'Ácido grabador 37%', unit: 'JERINGA', unitCost: 6, minStock: 4 },
  { sku: 'CEM-IO', name: 'Cemento de ionómero', unit: 'KIT', unitCost: 18, minStock: 3 },
  { sku: 'HID-CA', name: 'Hidróxido de calcio', unit: 'KIT', unitCost: 12, minStock: 2 },
  { sku: 'ALG-01', name: 'Algodón rollo (paquete)', unit: 'PAQUETE', unitCost: 4, minStock: 8 },
  { sku: 'GAS-100', name: 'Gasas estériles (paquete x100)', unit: 'PAQUETE', unitCost: 5.5, minStock: 6 },
  { sku: 'HIL-RET', name: 'Hilo retractor', unit: 'UND', unitCost: 2.5, minStock: 10 },
  { sku: 'LIM-K', name: 'Limas K #15-40 (caja)', unit: 'CAJA', unitCost: 14, minStock: 4 },
  { sku: 'LIM-ROT', name: 'Limas rotatorias (blister x6)', unit: 'BLISTER', unitCost: 48, minStock: 3 },
  { sku: 'GUT-01', name: 'Conos de gutapercha (caja)', unit: 'CAJA', unitCost: 9, minStock: 4 },
  { sku: 'SEL-END', name: 'Cemento sellador endodóntico', unit: 'KIT', unitCost: 35, minStock: 2 },
  { sku: 'HIP-525', name: 'Hipoclorito de sodio 5.25% (litro)', unit: 'LITRO', unitCost: 4.5, minStock: 3 },
  { sku: 'CLX-012', name: 'Clorhexidina 0.12% (litro)', unit: 'LITRO', unitCost: 7, minStock: 3 },
  { sku: 'PAS-PRO', name: 'Pasta profiláctica', unit: 'FRASCO', unitCost: 11, minStock: 3 },
  { sku: 'FLU-BAR', name: 'Flúor barniz (tubo)', unit: 'TUBO', unitCost: 16, minStock: 3 },
  { sku: 'SEL-FOS', name: 'Sellante de fosas (jeringa)', unit: 'JERINGA', unitCost: 14, minStock: 3 },
  { sku: 'ALG-450', name: 'Alginato (bolsa 450 g)', unit: 'BOLSA', unitCost: 10, minStock: 4 },
  { sku: 'SIL-ADI', name: 'Silicona de adición (kit)', unit: 'KIT', unitCost: 65, minStock: 2 },
  { sku: 'SUT-30', name: 'Sutura seda 3-0 (caja x12)', unit: 'CAJA', unitCost: 22, minStock: 2 },
  { sku: 'EYE-100', name: 'Eyectores de saliva (bolsa x100)', unit: 'BOLSA', unitCost: 5, minStock: 5 },
  { sku: 'BAB-125', name: 'Baberos desechables (paquete x125)', unit: 'PAQUETE', unitCost: 7.5, minStock: 4 },
];

/** Materiales que descuenta cada procedimiento (receta de consumo, RF-14). */
export const CONSUMPTIONS: Record<string, [string, number][]> = {
  'Obturación simple': [['Anestesia Lidocaína 2%', 1], ['Agujas dentales 27G', 1], ['Resina compuesta A2', 0.1], ['Ácido grabador 37%', 0.05]],
  'Obturación simple (1 superficie)': [['Anestesia Lidocaína 2%', 1], ['Resina compuesta A2', 0.1], ['Adhesivo universal (frasco 5 ml)', 0.02]],
  'Obturación compuesta (2 superficies)': [['Anestesia Lidocaína 2%', 1], ['Resina compuesta A3', 0.15], ['Adhesivo universal (frasco 5 ml)', 0.03]],
  'Obturación compleja (3+ superficies)': [['Anestesia Articaína 4%', 1], ['Resina compuesta A2', 0.25], ['Resina fluida A2', 0.1]],
  'Endodoncia unirradicular': [['Anestesia Lidocaína 2%', 2], ['Limas K #15-40 (caja)', 0.1], ['Conos de gutapercha (caja)', 0.05], ['Hipoclorito de sodio 5.25% (litro)', 0.05]],
  'Endodoncia multirradicular': [['Anestesia Articaína 4%', 2], ['Limas rotatorias (blister x6)', 0.2], ['Conos de gutapercha (caja)', 0.1], ['Cemento sellador endodóntico', 0.05]],
  'Extracción simple': [['Anestesia Lidocaína 2%', 1], ['Agujas dentales 27G', 1], ['Gasas estériles (paquete x100)', 0.05]],
  'Extracción quirúrgica': [['Anestesia Articaína 4%', 2], ['Sutura seda 3-0 (caja x12)', 0.1], ['Gasas estériles (paquete x100)', 0.1]],
  'Extracción de tercer molar incluido': [['Anestesia Articaína 4%', 3], ['Sutura seda 3-0 (caja x12)', 0.17], ['Gasas estériles (paquete x100)', 0.1]],
  'Limpieza dental (profilaxis)': [['Pasta profiláctica', 0.05], ['Eyectores de saliva (bolsa x100)', 0.01], ['Baberos desechables (paquete x125)', 0.01]],
  'Aplicación de flúor': [['Flúor barniz (tubo)', 0.05]],
  'Sellante de fosas y fisuras (por diente)': [['Sellante de fosas (jeringa)', 0.1], ['Ácido grabador 37%', 0.02]],
  'Corona metal-porcelana': [['Silicona de adición (kit)', 0.1], ['Hilo retractor', 1]],
  'Corona de zirconio': [['Silicona de adición (kit)', 0.1], ['Hilo retractor', 1]],
  'Modelos de estudio': [['Alginato (bolsa 450 g)', 0.1]],
  'Implante dental (fase quirúrgica)': [['Anestesia Articaína 4%', 3], ['Sutura seda 3-0 (caja x12)', 0.17], ['Clorhexidina 0.12% (litro)', 0.05]],
  'Raspado y alisado radicular (por cuadrante)': [['Anestesia Lidocaína 2%', 1], ['Clorhexidina 0.12% (litro)', 0.02]],
  'Pulpotomía (diente temporal)': [['Mepivacaína 3% sin vasoconstrictor', 1], ['Hidróxido de calcio', 0.05]],
  'Blanqueamiento en consultorio': [['Gasas estériles (paquete x100)', 0.05], ['Eyectores de saliva (bolsa x100)', 0.02]],
  'Carilla de resina': [['Resina compuesta A2', 0.2], ['Adhesivo universal (frasco 5 ml)', 0.03]],
  'Instalación de brackets metálicos': [['Ácido grabador 37%', 0.1], ['Adhesivo universal (frasco 5 ml)', 0.05]],
};

const consentBody = (proc: string, risks: string, care: string) =>
  `<p>Yo, el/la paciente (o su representante legal), declaro que el profesional tratante me ha explicado de forma clara el procedimiento de <strong>${proc}</strong>, sus beneficios, alternativas y la opción de no realizarlo.</p>` +
  `<p><strong>Riesgos y molestias posibles:</strong> ${risks}</p>` +
  `<p><strong>Cuidados posteriores:</strong> ${care}</p>` +
  `<p>He tenido la oportunidad de hacer preguntas y han sido respondidas satisfactoriamente. Autorizo libre y voluntariamente su realización, y sé que puedo revocar este consentimiento antes del procedimiento.</p>`;

// Los 3 primeros nombres coinciden con las plantillas que crea el registro de clínica.
export const CONSENT_TEMPLATES = [
  { name: 'Consentimiento general de atención odontológica', code: 'GEN-01', body: consentBody('evaluación y atención odontológica general', 'sensibilidad transitoria, molestias en la articulación por apertura prolongada, reacciones a la anestesia local.', 'seguir las indicaciones de higiene y asistir a los controles.') },
  { name: 'Consentimiento para extracción dental', code: 'CIR-01', body: consentBody('extracción dental', 'sangrado, inflamación, alveolitis seca, fractura radicular, lesión de dientes vecinos.', 'compresión con gasa 30 minutos, dieta blanda y fría, no enjuagar ni fumar por 24 horas.') },
  { name: 'Consentimiento para endodoncia', code: 'END-01', body: consentBody('tratamiento de conducto (endodoncia)', 'dolor post-operatorio, fractura de instrumentos, perforación, necesidad de retratamiento o extracción.', 'evitar masticar con el diente tratado hasta su restauración definitiva.') },
  { name: 'Consentimiento para extracción de terceros molares', code: 'CIR-03', body: consentBody('extracción de terceros molares', 'inflamación, trismus, parestesia temporal o permanente del labio y lengua, comunicación oroantral.', 'hielo local las primeras 48 horas, medicación indicada, control en 7 días.') },
  { name: 'Consentimiento para implante dental', code: 'IMP-01', body: consentBody('colocación de implante dental', 'falta de oseointegración, infección, sinusitis, lesión nerviosa, pérdida del implante.', 'no fumar, higiene rigurosa, controles periódicos.') },
  { name: 'Consentimiento para injerto óseo', code: 'IMP-03', body: consentBody('injerto óseo', 'reabsorción del injerto, infección, exposición de membrana.', 'dieta blanda, no presionar la zona, antibiótico según indicación.') },
  { name: 'Consentimiento para cirugía periodontal', code: 'PER-02', body: consentBody('cirugía periodontal', 'sensibilidad, recesión gingival, sangrado, movilidad transitoria.', 'enjuague con clorhexidina, cepillado suave, retiro de puntos en 10 días.') },
  { name: 'Consentimiento para raspado y alisado radicular', code: 'PER-01', body: consentBody('raspado y alisado radicular', 'sensibilidad dentaria, retracción de encías, sangrado leve.', 'uso de pasta desensibilizante y técnica de cepillado indicada.') },
  { name: 'Consentimiento para blanqueamiento dental', code: 'EST-01', body: consentBody('blanqueamiento dental', 'sensibilidad dentaria, irritación gingival, resultados variables según el tipo de pigmentación.', 'evitar alimentos y bebidas pigmentadas 48 horas.') },
  { name: 'Consentimiento para tratamiento de ortodoncia', code: 'ORT-01', body: consentBody('tratamiento de ortodoncia', 'descalcificación, reabsorción radicular, molestias, recidiva si no se usa retenedor.', 'higiene con cepillo interproximal y asistencia mensual a controles.') },
  { name: 'Consentimiento para prótesis fija', code: 'PRO-01', body: consentBody('prótesis fija (coronas/puentes)', 'sensibilidad, necesidad de endodoncia, fractura del material, descementación.', 'uso de hilo dental especial y controles anuales.') },
  { name: 'Consentimiento para prótesis removible', code: 'PRO-03', body: consentBody('prótesis removible', 'periodo de adaptación, úlceras por roce, necesidad de ajustes.', 'retirar la prótesis por la noche y limpiarla diariamente.') },
  { name: 'Consentimiento para carillas estéticas', code: 'EST-03', body: consentBody('carillas estéticas', 'desgaste irreversible del esmalte, fractura o despegamiento de la carilla.', 'evitar morder objetos duros, usar férula si hay bruxismo.') },
  { name: 'Consentimiento para anestesia local', code: null, body: consentBody('anestesia local', 'hematoma, parestesia transitoria, reacción alérgica, taquicardia.', 'no morder labio ni lengua hasta que pase el efecto.') },
  { name: 'Consentimiento para sedación consciente', code: null, body: consentBody('sedación consciente', 'somnolencia, náusea, depresión respiratoria (rara).', 'acudir acompañado, no conducir durante 24 horas.') },
  { name: 'Consentimiento para atención de menores de edad', code: null, body: consentBody('atención odontológica a un menor de edad', 'los propios de cada procedimiento, explicados al representante.', 'el representante supervisará la higiene y medicación del menor.') },
  { name: 'Consentimiento para radiografías y tomografía', code: 'DX-04', body: consentBody('toma de radiografías y tomografía', 'exposición a radiación ionizante en dosis bajas.', 'informar si existe embarazo o sospecha de embarazo.') },
  { name: 'Consentimiento para uso de fotografías clínicas', code: null, body: consentBody('toma y uso de fotografías clínicas', 'ninguno clínico; las imágenes se usan solo con fines diagnósticos y académicos de forma anónima.', 'puedo solicitar la eliminación de las imágenes en cualquier momento.') },
  { name: 'Consentimiento de tratamiento de datos personales (LOPDP)', code: null, body: consentBody('tratamiento de mis datos personales y de salud conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador', 'ninguno clínico.', 'puedo ejercer mis derechos de acceso, rectificación y eliminación escribiendo a la clínica.') },
  { name: 'Consentimiento para frenectomía', code: 'CIR-05', body: consentBody('frenectomía', 'sangrado, inflamación, cicatrización fibrosa.', 'ejercicios de lengua/labio indicados y control en 7 días.') },
];

export const MESSAGE_TEMPLATES = [
  { channel: 'WHATSAPP', eventType: 'REMINDER_24H', subject: null, body: 'Hola {{nombre}}, le recordamos su cita en {{clinica}} mañana {{fecha}} a las {{hora}}. Responda SÍ para confirmar.' },
  { channel: 'WHATSAPP', eventType: 'REMINDER_48H', subject: null, body: 'Hola {{nombre}}, tiene una cita el {{fecha}} a las {{hora}} con {{doctor}}. ¿Nos confirma su asistencia?' },
  { channel: 'WHATSAPP', eventType: 'CONFIRMATION', subject: null, body: '¡Gracias {{nombre}}! Su cita del {{fecha}} a las {{hora}} quedó confirmada.' },
  { channel: 'WHATSAPP', eventType: 'BIRTHDAY', subject: null, body: '¡Feliz cumpleaños {{nombre}}! 🎉 Todo el equipo de {{clinica}} le desea un gran día. Este mes tiene 10% de descuento en limpieza.' },
  { channel: 'WHATSAPP', eventType: 'POST_OP', subject: null, body: 'Hola {{nombre}}, ¿cómo se siente después de su procedimiento? Recuerde seguir las indicaciones. Ante cualquier molestia escríbanos.' },
  { channel: 'WHATSAPP', eventType: 'NO_SHOW_FOLLOWUP', subject: null, body: 'Hola {{nombre}}, le extrañamos en su cita de hoy. ¿Desea reagendar? Responda con el día que le convenga.' },
  { channel: 'WHATSAPP', eventType: 'RECALL_6M', subject: null, body: 'Hola {{nombre}}, han pasado 6 meses desde su última limpieza. ¡Agende su control preventivo!' },
  { channel: 'WHATSAPP', eventType: 'PAYMENT_REMINDER', subject: null, body: 'Hola {{nombre}}, tiene un saldo pendiente de ${{saldo}} en la factura {{factura}}. Puede pagar por transferencia o en caja.' },
  { channel: 'SMS', eventType: 'REMINDER_24H', subject: null, body: '{{clinica}}: cita manana {{fecha}} {{hora}}. Responda SI para confirmar.' },
  { channel: 'SMS', eventType: 'REMINDER_48H', subject: null, body: '{{clinica}}: recuerde su cita el {{fecha}} {{hora}}.' },
  { channel: 'SMS', eventType: 'CONFIRMATION', subject: null, body: '{{clinica}}: cita confirmada {{fecha}} {{hora}}. Gracias.' },
  { channel: 'SMS', eventType: 'NO_SHOW_FOLLOWUP', subject: null, body: '{{clinica}}: no asistio a su cita. Llame para reagendar.' },
  { channel: 'SMS', eventType: 'PAYMENT_REMINDER', subject: null, body: '{{clinica}}: saldo pendiente ${{saldo}}. Factura {{factura}}.' },
  { channel: 'EMAIL', eventType: 'REMINDER_24H', subject: 'Recordatorio de su cita odontológica', body: 'Estimado/a {{nombre}}:\n\nLe recordamos su cita mañana {{fecha}} a las {{hora}} con {{doctor}}.\n\nAtentamente,\n{{clinica}}' },
  { channel: 'EMAIL', eventType: 'REMINDER_48H', subject: 'Su cita es en 2 días', body: 'Estimado/a {{nombre}}:\n\nSu cita es el {{fecha}} a las {{hora}}. Si necesita cambiarla, contáctenos.\n\n{{clinica}}' },
  { channel: 'EMAIL', eventType: 'BIRTHDAY', subject: '¡Feliz cumpleaños!', body: 'Querido/a {{nombre}}:\n\nTodo el equipo de {{clinica}} le desea un feliz cumpleaños.' },
  { channel: 'EMAIL', eventType: 'PLAN_SENT', subject: 'Su presupuesto de tratamiento', body: 'Estimado/a {{nombre}}:\n\nAdjuntamos su plan de tratamiento por un total de ${{total}}. Quedamos atentos a su aprobación.\n\n{{clinica}}' },
  { channel: 'EMAIL', eventType: 'INVOICE_ISSUED', subject: 'Factura {{factura}}', body: 'Estimado/a {{nombre}}:\n\nAdjuntamos la factura {{factura}} por ${{total}}. Gracias por su confianza.\n\n{{clinica}}' },
  { channel: 'EMAIL', eventType: 'POST_OP', subject: 'Indicaciones post-operatorias', body: 'Estimado/a {{nombre}}:\n\nLe compartimos las indicaciones para su recuperación. Ante fiebre o sangrado abundante, comuníquese con nosotros.\n\n{{clinica}}' },
  { channel: 'EMAIL', eventType: 'RECALL_6M', subject: 'Es momento de su control preventivo', body: 'Estimado/a {{nombre}}:\n\nHan pasado 6 meses desde su última visita. Agende su control y limpieza.\n\n{{clinica}}' },
];

export const FEMALE_NAMES = ['María José', 'Daniela', 'Gabriela', 'Andrea', 'Paola', 'Verónica', 'Carolina', 'Fernanda', 'Valentina', 'Camila', 'Sofía', 'Isabella', 'Lucía', 'Mónica', 'Patricia', 'Rosa', 'Gloria', 'Diana', 'Katherine', 'Jessica', 'Estefanía', 'Mishell', 'Doménica', 'Martina', 'Ana Belén', 'Cristina', 'Lorena', 'Silvia', 'Johanna', 'Nathaly'];
export const MALE_NAMES = ['Juan Carlos', 'Luis', 'Jorge', 'Carlos', 'Diego', 'Andrés', 'Santiago', 'Sebastián', 'Mateo', 'Fernando', 'Ricardo', 'Marco', 'Pablo', 'Esteban', 'Xavier', 'Byron', 'Wilson', 'Edison', 'Christian', 'Alejandro', 'Joaquín', 'Emilio', 'Galo', 'Patricio', 'Hugo', 'Darío', 'Iván', 'Kevin', 'Bryan', 'Nicolás'];
export const SURNAMES = ['Zambrano', 'Vera', 'Cedeño', 'Mendoza', 'Morales', 'Andrade', 'Guerrero', 'Castro', 'Sánchez', 'López', 'Torres', 'Paredes', 'Ortiz', 'Rodríguez', 'Vásquez', 'Moreira', 'Chávez', 'Pazmiño', 'Salazar', 'Villacís', 'Jaramillo', 'Cevallos', 'Espinoza', 'Benítez', 'Aguirre', 'Toapanta', 'Quishpe', 'Chiriboga', 'Proaño', 'Viteri', 'Herrera', 'Cabrera', 'Naranjo', 'Montalvo', 'Calderón', 'Granda', 'Ponce', 'Valencia', 'Bravo', 'Arias'];
export const CITIES = [
  { city: 'Quito', streets: ['Av. Amazonas', 'Av. 6 de Diciembre', 'Av. Eloy Alfaro', 'Av. República', 'Av. de los Shyris', 'Calle Japón', 'Av. Naciones Unidas', 'Av. Mariscal Sucre'] },
  { city: 'Guayaquil', streets: ['Av. 9 de Octubre', 'Av. Francisco de Orellana', 'Av. Las Américas', 'Calle Víctor Emilio Estrada'] },
  { city: 'Cuenca', streets: ['Av. Solano', 'Calle Larga', 'Av. Remigio Crespo'] },
  { city: 'Ambato', streets: ['Av. Cevallos', 'Av. Los Guaytambos'] },
  { city: 'Sangolquí', streets: ['Av. General Enríquez', 'Av. San Luis'] },
  { city: 'Cumbayá', streets: ['Av. Interoceánica', 'Calle Francisco de Orellana'] },
];
export const OCCUPATIONS = ['Ingeniero/a', 'Docente', 'Estudiante', 'Comerciante', 'Abogado/a', 'Contador/a', 'Médico/a', 'Enfermero/a', 'Jubilado/a', 'Chofer profesional', 'Arquitecto/a', 'Empleado/a público/a', 'Ama de casa', 'Diseñador/a', 'Policía', 'Agricultor/a'];
export const INSURERS = ['Salud S.A.', 'BMI', 'Humana', 'Confiamed', 'Ecuasanitas', 'Best Doctors', 'Plan Vital'];
export const BLOOD_TYPES = ['O+', 'O+', 'O+', 'A+', 'A+', 'B+', 'AB+', 'O-', 'A-'];
export const PATIENT_TAGS = ['VIP', 'Ortodoncia', 'Referido', 'Nuevo', 'Convenio empresa', 'Seguro privado', 'Pago pendiente', 'Paciente frecuente'];

export const DISEASES = [
  { disease: 'Hipertensión arterial', med: 'Losartán 50 mg c/24h', alert: 'HIPERTENSO - medir presión antes de anestesia' },
  { disease: 'Diabetes tipo 2', med: 'Metformina 850 mg c/12h', alert: 'DIABÉTICO - control glucemia' },
  { disease: 'Asma', med: 'Salbutamol inhalador PRN', alert: 'ASMÁTICO - tener inhalador a mano' },
  { disease: 'Hipotiroidismo', med: 'Levotiroxina 50 mcg c/24h', alert: null },
  { disease: 'Gastritis crónica', med: 'Omeprazol 20 mg c/24h', alert: null },
  { disease: 'Fibrilación auricular', med: 'Warfarina 5 mg c/24h', alert: 'ANTICOAGULADO - riesgo de sangrado' },
  { disease: 'Osteoporosis', med: 'Alendronato 70 mg semanal', alert: 'BIFOSFONATOS - riesgo osteonecrosis' },
];
export const ALLERGIES = [
  { allergy: 'Penicilina', alert: 'ALERGIA PENICILINA' },
  { allergy: 'Látex', alert: 'ALERGIA LÁTEX' },
  { allergy: 'Ibuprofeno', alert: 'ALERGIA AINES' },
  { allergy: 'Aspirina', alert: 'ALERGIA AINES' },
  { allergy: 'Sulfas', alert: 'ALERGIA SULFAS' },
];
export const HABITS = ['Fumador', 'Bruxismo', 'Consumo de alcohol ocasional', 'Onicofagia', 'Respirador bucal', 'Consumo frecuente de café'];

/** Textos SOAP por categoría de procedimiento. {d} = número de diente. */
export const SOAP: Record<string, { s: string[]; o: string[]; a: string[]; p: string[] }> = {
  General: {
    s: ['Paciente acude a control de rutina, sin molestias.', 'Refiere sangrado de encías al cepillarse.', 'Refiere dolor intermitente en zona posterior derecha.'],
    o: ['Mucosas hidratadas, sin lesiones. Placa bacteriana moderada.', 'Encía eritematosa en sector anteroinferior. Cálculo supragingival.', 'Caries visible en pieza {d}. Percusión negativa.'],
    a: ['Gingivitis asociada a placa.', 'Caries dental en pieza {d}.', 'Paciente sano, riesgo cariogénico bajo.'],
    p: ['Profilaxis y enseñanza de técnica de cepillado. Control en 6 meses.', 'Elaborar plan de tratamiento y presupuesto.', 'Radiografía periapical de pieza {d}.'],
  },
  Diagnóstico: {
    s: ['Paciente acude para estudio radiográfico solicitado.'],
    o: ['Se toma imagen sin complicaciones.'],
    a: ['Imagen compatible con caries interproximal en pieza {d}.', 'Sin hallazgos patológicos relevantes.', 'Tercer molar en posición mesioangular.'],
    p: ['Informar al paciente e incluir en plan de tratamiento.', 'Archivar estudio en historia clínica.'],
  },
  Preventiva: {
    s: ['Paciente acude para limpieza semestral.', 'Madre refiere que el niño consume muchos dulces.'],
    o: ['Cálculo supragingival en caras linguales inferiores.', 'Fosas y fisuras profundas en molares permanentes.'],
    a: ['Gingivitis leve.', 'Alto riesgo de caries en fosas y fisuras.'],
    p: ['Profilaxis, aplicación de flúor barniz. Control en 6 meses.', 'Sellantes en molares permanentes.'],
  },
  Operatoria: {
    s: ['Refiere sensibilidad al frío en pieza {d}.', 'Se le cayó una restauración antigua en pieza {d}.'],
    o: ['Lesión cariosa en cara oclusal de pieza {d}, sin compromiso pulpar.', 'Restauración desadaptada en pieza {d}, caries secundaria.'],
    a: ['Caries dentinaria pieza {d}.', 'Caries secundaria pieza {d}.'],
    p: ['Restauración con resina compuesta bajo aislamiento absoluto. Se realiza sin complicaciones.', 'Remoción de restauración y nueva obturación. Ajuste oclusal.'],
  },
  Endodoncia: {
    s: ['Dolor espontáneo y nocturno en pieza {d}, se irradia al oído.', 'Paciente asintomático tras primera sesión.'],
    o: ['Pieza {d} con respuesta exagerada al frío que persiste. Percusión positiva.', 'Lesión periapical radiolúcida en pieza {d}.'],
    a: ['Pulpitis irreversible sintomática pieza {d}.', 'Necrosis pulpar con periodontitis apical pieza {d}.'],
    p: ['Apertura, conductometría e instrumentación. Medicación intraconducto.', 'Obturación de conductos. Derivar para restauración definitiva.'],
  },
  Periodoncia: {
    s: ['Refiere movilidad dental y mal aliento.', 'Sangrado de encías espontáneo.'],
    o: ['Bolsas de 5-6 mm en sector posterior. Sangrado al sondaje generalizado.', 'Recesión gingival y pérdida de inserción moderada.'],
    a: ['Periodontitis estadio II grado B.', 'Periodontitis estadio III grado B.'],
    p: ['Raspado y alisado radicular por cuadrantes. Clorhexidina 0.12% por 14 días.', 'Reevaluación periodontal en 6 semanas.'],
  },
  Cirugía: {
    s: ['Dolor e inflamación en zona de pieza {d}.', 'Paciente acude para extracción programada de pieza {d}.'],
    o: ['Pieza {d} con destrucción coronaria total, no restaurable.', 'Pericoronaritis en tercer molar {d}.'],
    a: ['Resto radicular pieza {d}.', 'Tercer molar incluido pieza {d}.'],
    p: ['Exodoncia bajo anestesia local, hemostasia, sutura. Indicaciones post-operatorias.', 'Control y retiro de puntos en 7 días.'],
  },
  Implantología: {
    s: ['Desea reponer pieza ausente {d}.', 'Control post-implante sin molestias.'],
    o: ['Reborde alveolar con altura y grosor adecuados en zona {d}.', 'Cicatrización adecuada en zona de implante {d}.'],
    a: ['Edentulismo parcial, zona {d} apta para implante.', 'Oseointegración en curso.'],
    p: ['Colocación de implante 4.0 x 10 mm. Sutura. Antibiótico profiláctico.', 'Toma de impresión para corona sobre implante en 3 meses.'],
  },
  Prótesis: {
    s: ['Desea mejorar la masticación.', 'Molestia con prótesis actual.'],
    o: ['Pieza {d} endodonciada con poca estructura remanente.', 'Ausencia de varias piezas posteriores.'],
    a: ['Indicación de corona pieza {d}.', 'Edentulismo parcial Kennedy clase II.'],
    p: ['Tallado, impresión con silicona y provisional.', 'Prueba de estructura y registro de mordida.'],
  },
  Ortodoncia: {
    s: ['Control mensual, refiere molestias leves tras activación.', 'Desea corregir apiñamiento.'],
    o: ['Brackets en buen estado, higiene regular.', 'Apiñamiento anteroinferior moderado, clase I molar.'],
    a: ['Evolución favorable del tratamiento.', 'Maloclusión clase I con apiñamiento.'],
    p: ['Cambio de arco y ligaduras. Control en 4 semanas.', 'Estudio ortodóntico completo y presupuesto.'],
  },
  Estética: {
    s: ['Desea dientes más blancos.', 'Inconforme con forma de incisivos.'],
    o: ['Color A3.5 en sector anterior.', 'Diastema entre piezas 11 y 21.'],
    a: ['Pigmentación extrínseca e intrínseca leve.', 'Indicación de carillas.'],
    p: ['Blanqueamiento en consultorio, 3 aplicaciones. Color final A1.', 'Mock-up y diseño de sonrisa.'],
  },
};

export const PRESCRIPTION_SETS = {
  infection: { diagnosis: 'Absceso periapical agudo', items: [{ medication: 'Amoxicilina 500 mg', dose: '1 cápsula', frequency: 'cada 8 horas', duration: '7 días' }, { medication: 'Ibuprofeno 400 mg', dose: '1 tableta', frequency: 'cada 8 horas', duration: '3 días', notes: 'Tomar después de las comidas' }] },
  infectionPenicillinAllergy: { diagnosis: 'Absceso periapical agudo (alérgico a penicilina)', items: [{ medication: 'Clindamicina 300 mg', dose: '1 cápsula', frequency: 'cada 8 horas', duration: '7 días' }, { medication: 'Paracetamol 500 mg', dose: '1 tableta', frequency: 'cada 6 horas', duration: '3 días' }] },
  extraction: { diagnosis: 'Post-exodoncia', items: [{ medication: 'Ibuprofeno 600 mg', dose: '1 tableta', frequency: 'cada 8 horas', duration: '3 días', notes: 'Tomar con alimentos' }, { medication: 'Clorhexidina 0.12% enjuague', dose: '15 ml', frequency: 'cada 12 horas', duration: '7 días', notes: 'Iniciar 24 horas después de la cirugía' }] },
  extractionNsaidAllergy: { diagnosis: 'Post-exodoncia (alérgico a AINEs)', items: [{ medication: 'Paracetamol 1 g', dose: '1 tableta', frequency: 'cada 8 horas', duration: '3 días' }, { medication: 'Clorhexidina 0.12% enjuague', dose: '15 ml', frequency: 'cada 12 horas', duration: '7 días' }] },
  surgery: { diagnosis: 'Post-quirúrgico tercer molar / implante', items: [{ medication: 'Amoxicilina + ácido clavulánico 875/125 mg', dose: '1 tableta', frequency: 'cada 12 horas', duration: '7 días' }, { medication: 'Ketorolaco 10 mg', dose: '1 tableta', frequency: 'cada 8 horas', duration: '3 días' }, { medication: 'Dexametasona 4 mg', dose: '1 tableta', frequency: 'cada 24 horas', duration: '2 días' }] },
  periodontal: { diagnosis: 'Periodontitis', items: [{ medication: 'Clorhexidina 0.12% enjuague', dose: '15 ml', frequency: 'cada 12 horas', duration: '14 días' }, { medication: 'Metronidazol 500 mg', dose: '1 tableta', frequency: 'cada 8 horas', duration: '7 días', notes: 'No consumir alcohol' }] },
  sensitivity: { diagnosis: 'Hipersensibilidad dentinaria', items: [{ medication: 'Pasta dental con nitrato de potasio 5%', dose: 'aplicar', frequency: 'cada 12 horas', duration: '30 días' }] },
  pain: { diagnosis: 'Pulpitis irreversible - analgesia hasta tratamiento', items: [{ medication: 'Nimesulida 100 mg', dose: '1 tableta', frequency: 'cada 12 horas', duration: '3 días' }] },
  child: { diagnosis: 'Post-pulpotomía (pediátrico)', items: [{ medication: 'Paracetamol jarabe 160 mg/5 ml', dose: 'según peso (10-15 mg/kg)', frequency: 'cada 6 horas', duration: '2 días', notes: 'Dosis calculada por el odontopediatra' }] },
};
