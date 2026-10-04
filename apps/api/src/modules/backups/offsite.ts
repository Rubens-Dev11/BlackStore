import * as fs from 'fs';
import * as Minio from 'minio';
import { Readable } from 'stream';
import { backupsToKeep } from './rotation';

/** Réglages de la copie hors du serveur (stockage compatible S3 : Backblaze B2, Cloudflare R2, Wasabi…). */
export interface OffsiteConfig {
  url: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export interface ObjectInfo {
  name: string;
  size: number;
}

/**
 * Espace de stockage hors du serveur : y reçoit les sauvegardes de la base (dossier `bases/`) et un
 * miroir des fichiers du site (dossier `fichiers/`). Un fichier supprimé du site l'est aussi du miroir
 * à la synchronisation suivante (les pièces d'identité refusées ne doivent pas survivre ailleurs) ;
 * les versions gardées 30 jours par le stockage principal couvrent les suppressions par erreur.
 */
export class OffsiteStorage {
  private readonly client: Minio.Client;

  constructor(private readonly config: OffsiteConfig) {
    const url = new URL(config.url);
    const useSSL = url.protocol === 'https:';
    this.client = new Minio.Client({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : useSSL ? 443 : 80,
      useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
    });
  }

  /** Lit la configuration ; null si la copie hors du serveur n'est pas configurée. */
  static fromEnv(get: (key: string) => string | undefined): OffsiteStorage | null {
    const url = get('BACKUP_S3_URL');
    const bucket = get('BACKUP_S3_BUCKET');
    const accessKey = get('BACKUP_S3_ACCESS_KEY');
    const secretKey = get('BACKUP_S3_SECRET_KEY');
    if (!url || !bucket || !accessKey || !secretKey) return null;
    return new OffsiteStorage({ url, bucket, accessKey, secretKey, region: get('BACKUP_S3_REGION') || 'us-east-1' });
  }

  /** Destination affichée dans l'admin (sans les clés). */
  get label(): string {
    return `${new URL(this.config.url).hostname}/${this.config.bucket}`;
  }

  async assertReady(): Promise<void> {
    if (!(await this.client.bucketExists(this.config.bucket))) {
      throw new Error(`le compartiment « ${this.config.bucket} » n'existe pas chez ${new URL(this.config.url).hostname}`);
    }
  }

  async list(prefix: string): Promise<ObjectInfo[]> {
    const objects: ObjectInfo[] = [];
    for await (const item of this.client.listObjectsV2(this.config.bucket, prefix, true) as AsyncIterable<Minio.BucketItem>) {
      if (item.name) objects.push({ name: item.name, size: item.size });
    }
    return objects;
  }

  /** Envoie une sauvegarde de la base, puis applique la même conservation que sur le serveur. */
  async uploadDatabaseBackup(localPath: string, fileName: string): Promise<{ removed: number }> {
    const size = (await fs.promises.stat(localPath)).size;
    await this.client.putObject(this.config.bucket, `bases/${fileName}`, fs.createReadStream(localPath), size, {
      'Content-Type': 'application/octet-stream',
    });
    const names = (await this.list('bases/')).map((o) => o.name.slice('bases/'.length));
    const keep = backupsToKeep(names);
    const old = names.filter((n) => !keep.has(n) && /^blackstore-\d{8}-\d{4}\.dump$/.test(n));
    if (old.length) await this.client.removeObjects(this.config.bucket, old.map((n) => `bases/${n}`));
    return { removed: old.length };
  }

  /**
   * Miroir des fichiers du site : copie ce qui manque ou a changé de taille, supprime ce qui n'existe
   * plus. Les noms de fichiers du site sont uniques (identifiant aléatoire) : nom + taille suffisent.
   */
  async mirror(
    source: ObjectInfo[],
    open: (name: string) => Promise<Readable>,
  ): Promise<{ total: number; copied: number; deleted: number; bytes: number }> {
    const remote = new Map((await this.list('fichiers/')).map((o) => [o.name.slice('fichiers/'.length), o.size]));
    let copied = 0;
    let bytes = 0;
    for (const object of source) {
      if (remote.get(object.name) === object.size) continue;
      await this.client.putObject(this.config.bucket, `fichiers/${object.name}`, await open(object.name), object.size);
      copied++;
      bytes += object.size;
    }
    const present = new Set(source.map((o) => o.name));
    const gone = [...remote.keys()].filter((name) => !present.has(name)).map((name) => `fichiers/${name}`);
    for (let i = 0; i < gone.length; i += 1000) {
      await this.client.removeObjects(this.config.bucket, gone.slice(i, i + 1000));
    }
    return { total: source.length, copied, deleted: gone.length, bytes };
  }
}
