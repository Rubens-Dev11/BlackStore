import { spawn } from 'child_process';
import * as fs from 'fs';

/**
 * Outils PostgreSQL (pg_dump, pg_restore) lancés en processus séparés. En production, l'image de l'API
 * contient le client PostgreSQL ; sur un poste sans ce client, `dockerContainer` les exécute dans le
 * conteneur PostgreSQL (docker exec), ce qui sert aux essais locaux.
 */
export interface PgTarget {
  /** Adresse de la base (DATABASE_URL) ; les paramètres propres à Prisma (?schema=…) sont ignorés. */
  databaseUrl: string;
  dockerContainer?: string;
}

interface PgConnection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

function parseUrl(databaseUrl: string): PgConnection {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port || '5432',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
}

/** Lance une commande ; renvoie sa sortie d'erreur, ou rejette avec elle si le code de sortie n'est pas 0. */
function run(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; stdin?: string; stdout?: string; capture?: boolean; timeoutMs: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: options.env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command} : délai dépassé (${Math.round(options.timeoutMs / 1000)} s)`));
    }, options.timeoutMs);

    let sink: fs.WriteStream | undefined;
    if (options.stdout) {
      sink = fs.createWriteStream(options.stdout, { mode: 0o600 });
      child.stdout.pipe(sink);
    } else {
      child.stdout.on('data', (chunk: Buffer) => {
        if (options.capture) out += chunk.toString();
      });
    }
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()));
    // Un processus qui s'arrête avant d'avoir tout lu ne doit pas faire tomber l'API (EPIPE).
    child.stdin.on('error', () => undefined);
    if (options.stdin) {
      fs.createReadStream(options.stdin).pipe(child.stdin);
    } else {
      child.stdin.end();
    }
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`${command} introuvable ou impossible à lancer : ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const settle = () =>
        code === 0 ? resolve(options.capture ? out : err) : reject(new Error(`${command} a échoué (code ${code}) : ${err.trim().slice(0, 500)}`));
      // Le fichier de sortie doit être entièrement écrit avant d'être relu.
      if (sink && !sink.writableFinished) sink.once('finish', settle);
      else settle();
    });
  });
}

/** Copie complète de la base au format « custom » de pg_dump (compressé, restaurable table par table). */
export async function dumpDatabase(target: PgTarget, file: string): Promise<void> {
  const db = parseUrl(target.databaseUrl);
  const formatArgs = ['--format=custom', '--compress=9', '--no-owner', '--no-privileges'];
  if (target.dockerContainer) {
    await run(
      'docker',
      ['exec', '-e', `PGPASSWORD=${db.password}`, target.dockerContainer, 'pg_dump', '-U', db.user, '-d', db.database, ...formatArgs],
      { stdout: file, timeoutMs: 10 * 60_000 },
    );
    return;
  }
  await run('pg_dump', [...formatArgs, `--file=${file}`], {
    env: { ...process.env, PGHOST: db.host, PGPORT: db.port, PGUSER: db.user, PGPASSWORD: db.password, PGDATABASE: db.database },
    timeoutMs: 10 * 60_000,
  });
}

/** Table des matières d'une sauvegarde (pg_restore --list) : prouve que le fichier est lisible et complet. */
export async function listDump(target: PgTarget, file: string): Promise<string> {
  if (target.dockerContainer) {
    return run('docker', ['exec', '-i', target.dockerContainer, 'pg_restore', '--list'], { stdin: file, capture: true, timeoutMs: 120_000 });
  }
  return run('pg_restore', ['--list', file], { capture: true, timeoutMs: 120_000 });
}
