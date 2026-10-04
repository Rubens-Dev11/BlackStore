import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { notify } from '@/lib/toast';
import { useAuthStore } from '@/stores/use-auth-store';
import { apiErrorMessage, BUTTON_CLASS } from '@/components/form-field';

type RunKind = 'database' | 'files' | 'retention';
type RunStatus = 'running' | 'success' | 'failed';

interface BackupRun {
  id: string;
  kind: RunKind;
  status: RunStatus;
  trigger: 'schedule' | 'startup' | 'manual';
  fileName: string | null;
  sizeBytes: number | null;
  offsite: string | null;
  details: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface BackupStatus {
  schedule: { time: string; timeZone: string };
  healthy: boolean;
  running: boolean;
  lastSuccess: BackupRun | null;
  database: {
    backups: Array<{ name: string; sizeBytes: number; createdAt: string; tier: string }>;
    retention: { daily: number; weekly: number; monthly: number };
  };
  files: { versioning: string; keepDays: number };
  offsite: { configured: boolean; target: string | null };
  disk: { freeBytes: number; totalBytes: number } | null;
  runs: BackupRun[];
}

const KIND_LABELS: Record<RunKind, string> = { database: 'Base de données', files: 'Fichiers', retention: 'Données anciennes' };
const TRIGGER_LABELS: Record<BackupRun['trigger'], string> = { schedule: 'nuit', startup: 'rattrapage', manual: 'manuel' };
const STATUS_STYLES: Record<RunStatus, { label: string; className: string }> = {
  running: { label: 'En cours', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  success: { label: 'Réussi', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  failed: { label: 'Échec', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatBytes = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`
    : bytes >= 1024 ** 2
      ? `${(bytes / 1024 ** 2).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
      : `${Math.max(1, Math.round(bytes / 1024))} Ko`;

function Card({ title, value, hint, warn }: { title: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border bg-background p-4 ${warn ? 'border-yellow-400' : ''}`}>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Sauvegardes automatiques : état, copies gardées, historique, lancement manuel. */
export function BackupsPage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const { data: status, isLoading, isError } = useQuery({
    queryKey: ['admin-backups'],
    queryFn: () => api.get<BackupStatus>('/admin/backups', accessToken),
    // Pendant une sauvegarde, l'état est relu toutes les 5 secondes.
    refetchInterval: (query) => (query.state.data?.running ? 5000 : false),
  });

  const runNow = async () => {
    setStarting(true);
    try {
      const result = await api.post<{ message: string }>('/admin/backups/run', {}, accessToken);
      notify.success(result.message);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['admin-backups'] }), 1500);
    } catch (err) {
      notify.error(apiErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Chargement...</p>;
  if (isError || !status) return <p className="p-6 text-sm text-red-600">Impossible de lire l'état des sauvegardes. Rechargez la page.</p>;

  const { lastSuccess, database, files, offsite, disk } = status;
  const lastFinished = status.runs.find((r) => r.kind === 'database' && r.status !== 'running');

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sauvegardes</h1>
          <p className="text-sm text-muted-foreground">
            Chaque nuit à {status.schedule.time.replace(':', ' h ')} (heure du Cameroun) : copie de la base de données, protection des fichiers et
            suppression des données anciennes prévue par la politique de confidentialité.
          </p>
        </div>
        <button type="button" onClick={runNow} disabled={starting || status.running} className={BUTTON_CLASS}>
          {status.running ? 'Sauvegarde en cours...' : starting ? 'Lancement...' : 'Sauvegarder maintenant'}
        </button>
      </div>

      {status.healthy ? (
        <p className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
          Tout va bien : dernière copie de la base le {formatDate(lastSuccess!.startedAt)}
          {lastSuccess!.sizeBytes !== null && <> ({formatBytes(lastSuccess!.sizeBytes)})</>}, vérifiée.
        </p>
      ) : (
        <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          Attention :{' '}
          {lastFinished?.status === 'failed'
            ? `la dernière sauvegarde a échoué (${lastFinished.details ?? 'motif inconnu'}).`
            : lastSuccess
              ? `la dernière copie réussie date du ${formatDate(lastSuccess.startedAt)}.`
              : 'aucune copie de la base pour l’instant.'}{' '}
          Lancez une sauvegarde ; si le problème continue, signalez-le.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          title="Base de données"
          value={`${database.backups.length} copie${database.backups.length > 1 ? 's' : ''} gardée${database.backups.length > 1 ? 's' : ''}`}
          hint={`${database.retention.daily} derniers jours, ${database.retention.weekly} dernières semaines, ${database.retention.monthly} derniers mois`}
        />
        <Card
          title="Fichiers"
          value={files.versioning === 'Enabled' ? 'Protégés' : 'Non protégés'}
          hint={
            files.versioning === 'Enabled'
              ? `Un fichier supprimé ou remplacé reste récupérable ${files.keepDays} jours (sauf les pièces d'identité, effacées comme promis).`
              : 'Les versions des fichiers ne sont pas activées.'
          }
          warn={files.versioning !== 'Enabled'}
        />
        <Card
          title="Copie hors du serveur"
          value={offsite.configured ? 'Active' : 'Pas encore configurée'}
          hint={
            offsite.configured
              ? `Base et fichiers copiés chaque nuit vers ${offsite.target}.`
              : 'Les copies restent sur le serveur : en cas de panne du serveur lui-même, il faut un espace de stockage externe.'
          }
          warn={!offsite.configured}
        />
        <Card
          title="Disque du serveur"
          value={disk ? `${formatBytes(disk.freeBytes)} libres` : 'Inconnu'}
          hint={disk ? `sur ${formatBytes(disk.totalBytes)}` : ''}
          warn={!!disk && disk.freeBytes < 3 * 1024 ** 3}
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Copies de la base gardées sur le serveur</h2>
        {database.backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune copie pour l'instant.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-background">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Conservation</th>
                  <th className="px-3 py-2 text-right">Taille</th>
                </tr>
              </thead>
              <tbody>
                {database.backups.map((b) => (
                  <tr key={b.name} className="border-b last:border-0">
                    <td className="px-3 py-2">{formatDate(b.createdAt)}</td>
                    <td className="px-3 py-2">{b.tier}</td>
                    <td className="px-3 py-2 text-right">{formatBytes(b.sizeBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Historique</h2>
        <ul className="space-y-2">
          {status.runs.map((run) => (
            <li key={run.id} className="rounded-lg border bg-background p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[run.status].className}`}>{STATUS_STYLES[run.status].label}</span>
                <strong>{KIND_LABELS[run.kind]}</strong>
                <span className="text-muted-foreground">
                  {formatDate(run.startedAt)} · {TRIGGER_LABELS[run.trigger] ?? run.trigger}
                </span>
              </div>
              {run.details && <p className="mt-1 text-muted-foreground">{run.details}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
