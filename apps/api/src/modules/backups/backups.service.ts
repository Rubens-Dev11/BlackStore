import { ConflictException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { BackupKind, BackupRun, BackupRunStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '@/prisma';
import { EmailService } from '../email/email.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { OffsiteStorage } from './offsite';
import { dumpDatabase, listDump, PgTarget } from './pg-tools';
import { RetentionService } from './retention.service';
import { backupDate, backupName, backupsToKeep, backupTakenAt, RETENTION } from './rotation';

export const MAINTENANCE_QUEUE = 'maintenance';
export type MaintenanceTrigger = 'schedule' | 'startup' | 'manual';
export interface MaintenanceJob {
  trigger: MaintenanceTrigger;
}

/** Durée pendant laquelle un fichier supprimé ou remplacé reste récupérable. */
const FILE_KEEP_DAYS = 30;
/** Au-delà, la dernière sauvegarde réussie est jugée trop ancienne (alerte dans l'admin). */
const STALE_MS = 26 * 3600_000;
/** En dessous, aucune sauvegarde n'est écrite pour ne pas remplir le disque du serveur. */
const MIN_FREE_BYTES = 200 * 1024 * 1024;

const formatBytes = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Go`
    : bytes >= 1024 ** 2
      ? `${(bytes / 1024 ** 2).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
      : `${Math.max(1, Math.round(bytes / 1024))} Ko`;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    fs.createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Sauvegardes automatiques, chaque nuit à 2 h 30 (heure du Cameroun) :
 * - la base est copiée par pg_dump, vérifiée (pg_restore --list), puis gardée selon la règle
 *   14 jours / 8 semaines / 6 mois dans BACKUP_DIR/base ;
 * - les fichiers du site restent récupérables 30 jours après une suppression (versions MinIO) ;
 * - si un stockage hors du serveur est configuré (BACKUP_S3_*), la base et les fichiers y sont copiés ;
 * - les données anciennes sont supprimées selon la politique de confidentialité.
 * Un échec est visible dans l'admin et signalé par e-mail à l'adresse de contact.
 */
@Injectable()
export class BackupsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BackupsService.name);
  private readonly backupDir: string;
  private readonly offsite: OffsiteStorage | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly fileStorage: FileStorageService,
    private readonly emailService: EmailService,
    private readonly retentionService: RetentionService,
    @InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue<MaintenanceJob>,
  ) {
    this.backupDir = this.configService.get<string>('BACKUP_DIR') || path.resolve('backups');
    this.offsite = OffsiteStorage.fromEnv((key) => this.configService.get<string>(key));
  }

  private get databaseDir(): string {
    return path.join(this.backupDir, 'base');
  }

  private pgTarget(): PgTarget {
    return {
      databaseUrl: this.configService.get<string>('DATABASE_URL', ''),
      dockerContainer: this.configService.get<string>('BACKUP_PG_DOCKER_CONTAINER') || undefined,
    };
  }

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        'maintenance-nocturne',
        { pattern: '30 2 * * *', tz: 'Africa/Douala' },
        { name: 'maintenance', data: { trigger: 'schedule' }, opts: { removeOnComplete: 30, removeOnFail: 30 } },
      );
      // Rattrapage : sans sauvegarde réussie depuis 24 h (premier démarrage, serveur arrêté la nuit…).
      const last = await this.prisma.backupRun.findFirst({ where: { kind: 'database', status: 'success' }, orderBy: { startedAt: 'desc' } });
      if (!last || Date.now() - last.startedAt.getTime() > 24 * 3600_000) {
        await this.queue.add(
          'maintenance',
          { trigger: 'startup' },
          {
            delay: Number(this.configService.get('BACKUP_STARTUP_DELAY_MS', 120_000)),
            jobId: `rattrapage-${backupName().slice(11, 19)}`,
            removeOnComplete: 30,
            removeOnFail: 30,
          },
        );
      }
    } catch (error) {
      this.logger.error(`Planification des sauvegardes impossible : ${errorMessage(error)}`);
    }
    this.fileStorage
      .ensureVersioning(FILE_KEEP_DAYS)
      .then((status) => this.logger.log(`Versions des fichiers : ${status} (${FILE_KEEP_DAYS} jours)`))
      .catch((error) => this.logger.warn(`Versions des fichiers non activées : ${errorMessage(error)}`));
  }

  /** Demande une maintenance immédiate (bouton de l'admin). */
  async requestRun() {
    const counts = await this.queue.getJobCounts('active', 'waiting');
    const recent = await this.prisma.backupRun.findFirst({
      where: { kind: 'database', startedAt: { gt: new Date(Date.now() - 3 * 60_000) } },
    });
    if (counts.active + counts.waiting > 0 || recent) {
      throw new ConflictException('Une sauvegarde est en cours ou vient de se terminer : patientez quelques minutes');
    }
    await this.queue.add('maintenance', { trigger: 'manual' }, { removeOnComplete: 30, removeOnFail: 30 });
    return { message: 'Sauvegarde lancée : le résultat s’affiche dans une minute environ.' };
  }

  /** Sauvegarde de la base, protection des fichiers, puis purge des données anciennes. */
  async runMaintenance(trigger: MaintenanceTrigger) {
    const database = await this.backupDatabase(trigger);
    const files = await this.protectFiles(trigger);
    const retention = await this.purgeOldData(trigger);
    return { database, files, retention };
  }

  private startRun(kind: BackupKind, trigger: MaintenanceTrigger) {
    return this.prisma.backupRun.create({ data: { kind, trigger } });
  }

  private finishRun(
    id: string,
    data: { status: BackupRunStatus; details: string; fileName?: string; sizeBytes?: bigint; sha256?: string; offsite?: string },
  ) {
    return this.prisma.backupRun.update({ where: { id }, data: { ...data, finishedAt: new Date() } });
  }

  async backupDatabase(trigger: MaintenanceTrigger): Promise<BackupRun> {
    const run = await this.startRun('database', trigger);
    const name = backupName();
    const finalPath = path.join(this.databaseDir, name);
    const partPath = `${finalPath}.part`;
    try {
      await fs.promises.mkdir(this.databaseDir, { recursive: true, mode: 0o700 });
      const disk = await this.disk();
      if (disk && disk.freeBytes < MIN_FREE_BYTES) {
        throw new Error(`espace disque insuffisant (${formatBytes(disk.freeBytes)} libres)`);
      }
      await dumpDatabase(this.pgTarget(), partPath);
      const toc = await listDump(this.pgTarget(), partPath);
      const tables = toc.split('\n').filter((line) => line.includes(' TABLE DATA ')).length;
      if (tables < 5 || !toc.includes('_prisma_migrations')) {
        throw new Error(`sauvegarde incomplète : ${tables} tables lisibles`);
      }
      const sha256 = await sha256File(partPath);
      await fs.promises.rename(partPath, finalPath);
      await fs.promises.chmod(finalPath, 0o600).catch(() => undefined);
      const size = (await fs.promises.stat(finalPath)).size;
      const removed = await this.rotateLocal();

      let offsite = 'disabled';
      let offsiteNote = '';
      if (this.offsite) {
        try {
          await this.offsite.assertReady();
          const result = await this.offsite.uploadDatabaseBackup(finalPath, name);
          offsite = 'uploaded';
          offsiteNote = ` ; copiée hors du serveur${result.removed ? ` (${result.removed} ancienne(s) retirée(s))` : ''}`;
        } catch (error) {
          offsite = 'failed';
          offsiteNote = ` ; copie hors du serveur impossible : ${errorMessage(error)}`;
        }
      }
      const done = await this.finishRun(run.id, {
        status: 'success',
        fileName: name,
        sizeBytes: BigInt(size),
        sha256,
        offsite,
        details: `${tables} tables vérifiées, ${formatBytes(size)} ; ${removed} ancienne(s) sauvegarde(s) supprimée(s)${offsiteNote}`,
      });
      this.logger.log(`Sauvegarde de la base : ${name} (${formatBytes(size)}, ${tables} tables)${offsiteNote}`);
      if (offsite === 'failed') await this.alert(trigger, 'la copie hors du serveur de la base', offsiteNote.replace(/^ ; /, ''));
      return done;
    } catch (error) {
      await fs.promises.rm(partPath, { force: true }).catch(() => undefined);
      this.logger.error(`Sauvegarde de la base en échec : ${errorMessage(error)}`);
      const done = await this.finishRun(run.id, { status: 'failed', details: errorMessage(error) });
      await this.alert(trigger, 'la sauvegarde de la base', errorMessage(error));
      return done;
    }
  }

  async protectFiles(trigger: MaintenanceTrigger): Promise<BackupRun> {
    const run = await this.startRun('files', trigger);
    try {
      const versioning = await this.fileStorage.ensureVersioning(FILE_KEEP_DAYS);
      if (versioning !== 'Enabled') throw new Error(`versions des fichiers non activées (${versioning})`);
      let details = `fichiers supprimés ou remplacés récupérables ${FILE_KEEP_DAYS} jours`;
      let offsite = 'disabled';
      if (this.offsite) {
        await this.offsite.assertReady();
        const objects = await this.fileStorage.listAllObjects();
        const result = await this.offsite.mirror(objects, (name) => this.fileStorage.getObjectStream(name));
        offsite = 'uploaded';
        details += ` ; copie hors du serveur : ${result.total} fichiers, ${result.copied} envoyé(s) (${formatBytes(result.bytes)}), ${result.deleted} retiré(s)`;
      }
      return await this.finishRun(run.id, { status: 'success', offsite, details });
    } catch (error) {
      this.logger.error(`Protection des fichiers en échec : ${errorMessage(error)}`);
      const done = await this.finishRun(run.id, { status: 'failed', offsite: this.offsite ? 'failed' : 'disabled', details: errorMessage(error) });
      await this.alert(trigger, 'la protection des fichiers', errorMessage(error));
      return done;
    }
  }

  async purgeOldData(trigger: MaintenanceTrigger): Promise<BackupRun> {
    const run = await this.startRun('retention', trigger);
    try {
      const result = await this.retentionService.purge();
      return await this.finishRun(run.id, {
        status: 'success',
        details: `supprimés : ${result.messages} message(s) de contact, ${result.reports} signalement(s), ${result.pageViews} visite(s)`,
      });
    } catch (error) {
      this.logger.error(`Purge des données anciennes en échec : ${errorMessage(error)}`);
      return this.finishRun(run.id, { status: 'failed', details: errorMessage(error) });
    }
  }

  /** Garde 14 sauvegardes quotidiennes, 8 hebdomadaires et 6 mensuelles ; supprime les autres. */
  private async rotateLocal(): Promise<number> {
    const names = (await fs.promises.readdir(this.databaseDir)).filter((name) => backupDate(name) !== null);
    const keep = backupsToKeep(names);
    const old = names.filter((name) => !keep.has(name));
    for (const name of old) await fs.promises.rm(path.join(this.databaseDir, name), { force: true });
    return old.length;
  }

  private async disk(): Promise<{ freeBytes: number; totalBytes: number } | null> {
    try {
      const stats = await fs.promises.statfs(this.backupDir);
      return { freeBytes: stats.bavail * stats.bsize, totalBytes: stats.blocks * stats.bsize };
    } catch {
      return null;
    }
  }

  /** Prévient par e-mail (adresse de contact des réglages) ; l'admin voit déjà le résultat d'un lancement manuel. */
  private async alert(trigger: MaintenanceTrigger, what: string, reason: string): Promise<void> {
    if (trigger === 'manual') return;
    const settings = await this.prisma.marketplaceSettings.findUnique({ where: { id: 'default' }, select: { contactEmail: true } });
    if (!settings?.contactEmail) {
      this.logger.warn(`Échec de ${what} : aucune adresse de contact dans les réglages pour prévenir`);
      return;
    }
    const adminUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3002').replace(/\/+$/, '');
    await this.emailService.sendBackupAlert(settings.contactEmail, what, reason, `${adminUrl}/sauvegardes`);
  }

  /** Résumé léger pour la pastille du menu : la dernière sauvegarde de la base est-elle récente et réussie ? */
  async health() {
    const [lastDatabase, lastSuccess] = await Promise.all([
      this.prisma.backupRun.findFirst({ where: { kind: 'database', status: { not: 'running' } }, orderBy: { startedAt: 'desc' } }),
      this.prisma.backupRun.findFirst({ where: { kind: 'database', status: 'success' }, orderBy: { startedAt: 'desc' } }),
    ]);
    return {
      healthy: !!lastSuccess && Date.now() - lastSuccess.startedAt.getTime() < STALE_MS && lastDatabase?.status !== 'failed',
      lastSuccessAt: lastSuccess?.startedAt ?? null,
    };
  }

  private static view(run: BackupRun | null) {
    return run ? { ...run, sizeBytes: run.sizeBytes !== null ? Number(run.sizeBytes) : null } : null;
  }

  /** État affiché dans la page « Sauvegardes » de l'admin. */
  async status() {
    const [runs, lastDatabase, lastSuccess, counts, disk, versioning] = await Promise.all([
      this.prisma.backupRun.findMany({ orderBy: { startedAt: 'desc' }, take: 30 }),
      this.prisma.backupRun.findFirst({ where: { kind: 'database', status: { not: 'running' } }, orderBy: { startedAt: 'desc' } }),
      this.prisma.backupRun.findFirst({ where: { kind: 'database', status: 'success' }, orderBy: { startedAt: 'desc' } }),
      this.queue.getJobCounts('active', 'waiting'),
      this.disk(),
      this.fileStorage.versioningStatus().catch(() => 'inconnu'),
    ]);

    let backups: Array<{ name: string; sizeBytes: number; createdAt: string; tier: string }> = [];
    try {
      const names = (await fs.promises.readdir(this.databaseDir)).filter((name) => backupDate(name) !== null);
      const tiers = backupsToKeep(names);
      backups = await Promise.all(
        names.map(async (name) => {
          const stats = await fs.promises.stat(path.join(this.databaseDir, name));
          return { name, sizeBytes: stats.size, createdAt: backupTakenAt(name) ?? stats.mtime.toISOString(), tier: tiers.get(name) ?? 'à supprimer' };
        }),
      );
      backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      // Dossier pas encore créé : aucune sauvegarde.
    }

    const healthy = !!lastSuccess && Date.now() - lastSuccess.startedAt.getTime() < STALE_MS && lastDatabase?.status !== 'failed';
    return {
      schedule: { time: '02:30', timeZone: 'Africa/Douala' },
      healthy,
      running: counts.active + counts.waiting > 0,
      lastSuccess: BackupsService.view(lastSuccess),
      database: { backups, retention: RETENTION },
      files: { versioning, keepDays: FILE_KEEP_DAYS },
      offsite: { configured: !!this.offsite, target: this.offsite?.label ?? null },
      disk,
      runs: runs.map((run) => BackupsService.view(run)),
    };
  }
}
