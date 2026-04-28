import type { ProductionStatus } from '../../drizzle/schema';

/** User-facing labels — workflow language. */
export const STAGE_LABEL: Record<ProductionStatus, string> = {
  'email-sent': 'wysłanie maila',
  'terms-accepted': 'akceptacja warunków współpracy',
  'cam-meeting-set': 'ustalenie daty spotkania z kamerzystą',
  'cam-date-shared': 'przekazanie daty spotkania',
  'script-discussed': 'omówienie scenariusza z kamerzystą',
  'script-sent': 'wysłanie scenariusza',
  shooting: 'nagrywki',
  editing: 'obróbka',
  publishing: 'publikacja',
  cancelled: 'anulowane',
};

export const STAGE_HINT: Partial<Record<ProductionStatus, string>> = {
  'email-sent': 'Cold mail / DM z propozycją współpracy.',
  'terms-accepted': 'Artysta zgodził się na warunki — termin, lokację, zakres.',
  'cam-meeting-set': 'Ustalona konkretna data spotkania z kamerzystą.',
  'cam-date-shared': 'Data przekazana kamerzyście — gotowy w terminarzu.',
  'script-discussed': 'Omówienie scenariusza, ujęć, sprzętu.',
  'script-sent': 'Final scenariusz wysłany do kamerzysty + artysty.',
  shooting: 'W studio / w terenie. Nagranie głównego materiału + BTS.',
  editing: 'Selekcja ujęć, montaż, color grading, audio mix.',
  publishing: 'Manualny upload na platformy (IG, TT, YT).',
};
