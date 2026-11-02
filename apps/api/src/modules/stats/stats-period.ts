import { BadRequestException } from '@nestjs/common';

/** Le Cameroun est à UTC+1 toute l'année : les jours et les mois des statistiques sont comptés à cette heure. */
const OFFSET_MS = 3_600_000;
const DAY_MS = 86_400_000;

export const PERIODS = ['7j', '30j', '90j', '12m'] as const;
export type PeriodKey = (typeof PERIODS)[number];

export interface StatsPeriod {
  key: PeriodKey;
  granularity: 'day' | 'month';
  /** Format SQL (to_char) des cases du graphique. */
  bucketFormat: 'YYYY-MM-DD' | 'YYYY-MM';
  from: Date;
  to: Date;
  /** Période précédente de même durée, pour comparer. */
  previousFrom: Date;
  /** Cases du graphique, dans l'ordre (« 2026-10-09 » ou « 2026-10 »). */
  buckets: string[];
}

/** « 2026-10-09T23:30Z » → « 2026-10-10 » (date au Cameroun). */
export const localDay = (date: Date) => new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);

/** Début (en UTC) du jour local AAAA-MM-JJ. */
const startOfLocalDay = (day: string) => new Date(`${day}T00:00:00Z`).getTime() - OFFSET_MS;

/** Début (en UTC) du mois local, décalé de `shift` mois. */
function startOfLocalMonth(year: number, month: number, shift = 0): Date {
  return new Date(Date.UTC(year, month - 1 + shift, 1) - OFFSET_MS);
}

export function parsePeriod(raw: string | undefined, now = new Date()): StatsPeriod {
  const key = (raw ?? '30j') as PeriodKey;
  if (!PERIODS.includes(key)) {
    throw new BadRequestException('Période inconnue : 7j, 30j, 90j ou 12m.');
  }
  const today = localDay(now);
  if (key === '12m') {
    const [year, month] = today.split('-').map(Number);
    const from = startOfLocalMonth(year, month, -11);
    const to = startOfLocalMonth(year, month, 1);
    const buckets = Array.from({ length: 12 }, (_, i) => localDay(startOfLocalMonth(year, month, i - 11)).slice(0, 7));
    return { key, granularity: 'month', bucketFormat: 'YYYY-MM', from, to, previousFrom: startOfLocalMonth(year, month, -23), buckets };
  }
  const days = Number(key.slice(0, -1));
  const tomorrow = startOfLocalDay(today) + DAY_MS;
  const from = new Date(tomorrow - days * DAY_MS);
  const buckets = Array.from({ length: days }, (_, i) => localDay(new Date(from.getTime() + i * DAY_MS)));
  return {
    key,
    granularity: 'day',
    bucketFormat: 'YYYY-MM-DD',
    from,
    to: new Date(tomorrow),
    previousFrom: new Date(from.getTime() - days * DAY_MS),
    buckets,
  };
}

/** Mois d'un relevé (« 2026-10 ») : début et fin en UTC ; refusé s'il est à venir. */
export function parseMonth(raw: string | undefined, now = new Date()): { month: string; from: Date; to: Date } {
  if (!raw || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    throw new BadRequestException('Mois invalide : format AAAA-MM attendu (ex. 2026-10).');
  }
  if (raw > localDay(now).slice(0, 7)) {
    throw new BadRequestException('Ce mois n’est pas encore commencé.');
  }
  const [year, month] = raw.split('-').map(Number);
  return { month: raw, from: startOfLocalMonth(year, month), to: startOfLocalMonth(year, month, 1) };
}
