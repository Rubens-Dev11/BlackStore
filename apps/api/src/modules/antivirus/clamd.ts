import { connect } from 'net';
import { once } from 'events';
import { Readable } from 'stream';

export interface ClamdTarget {
  host: string;
  port: number;
  /** Délai maximal d'une analyse, envoi compris. */
  timeoutMs: number;
}

export type ScanVerdict = { infected: false } | { infected: true; signature: string };

/**
 * Analyse un flux avec le démon ClamAV (protocole INSTREAM) : le contenu est envoyé
 * par morceaux préfixés de leur taille, puis un morceau vide marque la fin.
 * Réponse : « stream: OK » ou « stream: <menace> FOUND ». Toute autre réponse
 * (limite de taille dépassée, démon indisponible…) est une erreur : l'analyse sera rejouée.
 */
export function scanStream(target: ClamdTarget, source: Readable): Promise<ScanVerdict> {
  return new Promise<ScanVerdict>((resolve, reject) => {
    const socket = connect({ host: target.host, port: target.port });
    let reply = '';
    let settled = false;

    const finish = (error: Error | null, verdict?: ScanVerdict) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      source.destroy();
      if (error) reject(error);
      else resolve(verdict!);
    };

    socket.setTimeout(target.timeoutMs, () => finish(new Error("Délai d'analyse antivirus dépassé")));
    // Une connexion refusée sur plusieurs adresses (IPv4 et IPv6) arrive sans message : on garde le code.
    socket.on('error', (error: NodeJS.ErrnoException) =>
      finish(new Error(`Antivirus injoignable ou connexion coupée (${error.code || error.message || 'erreur inconnue'})`)),
    );
    socket.on('data', (data) => {
      reply += data.toString('utf8');
    });
    socket.on('close', () => {
      const text = reply.replace(/\0/g, '').trim();
      const found = /^stream: (.+) FOUND$/.exec(text);
      if (text === 'stream: OK') finish(null, { infected: false });
      else if (found) finish(null, { infected: true, signature: found[1] });
      else finish(new Error(`Réponse inattendue de l'antivirus : ${text || '(vide)'}`));
    });

    socket.once('connect', async () => {
      try {
        socket.write('zINSTREAM\0');
        for await (const chunk of source) {
          const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          const size = Buffer.alloc(4);
          size.writeUInt32BE(data.length);
          if (!socket.write(Buffer.concat([size, data]))) {
            await once(socket, 'drain');
          }
        }
        socket.write(Buffer.alloc(4)); // morceau vide : fin du fichier
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

/** Le démon répond-il ? (« PONG ») */
export function ping(target: ClamdTarget): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: target.host, port: target.port });
    let reply = '';
    socket.setTimeout(5000, () => socket.destroy());
    socket.on('error', () => resolve(false));
    socket.on('data', (data) => {
      reply += data.toString('utf8');
    });
    socket.on('close', () => resolve(reply.replace(/\0/g, '').trim() === 'PONG'));
    socket.once('connect', () => socket.write('zPING\0'));
  });
}
