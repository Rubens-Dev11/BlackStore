/**
 * Conservation des sauvegardes de la base : la plus récente de chacun des 14 derniers jours, des
 * 8 dernières semaines et des 6 derniers mois. Les noms suivent `blackstore-AAAAMMJJ-HHMM.dump`.
 */
export const RETENTION = { daily: 14, weekly: 8, monthly: 6 };

const NAME = /^blackstore-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})\.dump$/;

export type BackupTier = 'quotidienne' | 'hebdomadaire' | 'mensuelle';

export function backupDate(name: string): Date | null {
  const m = NAME.exec(name);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : null;
}

/** Heure de la sauvegarde, lue dans son nom (heure du Cameroun, UTC+1 toute l'année). */
export function backupTakenAt(name: string): string | null {
  const m = NAME.exec(name);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+01:00` : null;
}

/** Semaine ISO (année et numéro), pour regrouper les sauvegardes par semaine. */
function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-${week}`;
}

/** Fichiers à garder, avec la règle qui les garde ; les autres sauvegardes automatiques sont supprimées. */
export function backupsToKeep(names: string[], retention = RETENTION): Map<string, BackupTier> {
  const dated = names
    .map((name) => ({ name, date: backupDate(name) }))
    .filter((b): b is { name: string; date: Date } => b.date !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const keep = new Map<string, BackupTier>();
  const pick = (period: (d: Date) => string, limit: number, tier: BackupTier) => {
    const seen = new Set<string>();
    for (const backup of dated) {
      const key = period(backup.date);
      if (seen.has(key)) continue;
      if (seen.size >= limit) break;
      seen.add(key);
      if (!keep.has(backup.name)) keep.set(backup.name, tier);
    }
  };
  pick((d) => d.toISOString().slice(0, 10), retention.daily, 'quotidienne');
  pick(isoWeek, retention.weekly, 'hebdomadaire');
  pick((d) => d.toISOString().slice(0, 7), retention.monthly, 'mensuelle');
  return keep;
}

/** Nom d'une nouvelle sauvegarde, à l'heure du Cameroun. */
export function backupName(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Douala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `blackstore-${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}.dump`;
}
