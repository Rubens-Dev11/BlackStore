// Faux démon ClamAV pour les essais locaux : protocole clamd (zPING, zINSTREAM),
// « menace » = fichier contenant la chaîne de test EICAR. Usage : node fake-clamd.mjs [port]
import { createServer } from 'net';

const port = Number(process.argv[2] ?? 3310);
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
const MAX = 600 * 1024 * 1024;

createServer((socket) => {
  let buffer = Buffer.alloc(0);
  let mode = null;
  const parts = [];
  let total = 0;
  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);
    if (!mode) {
      const end = buffer.indexOf(0);
      if (end < 0) return;
      mode = buffer.subarray(0, end).toString();
      buffer = buffer.subarray(end + 1);
      if (mode === 'zPING') {
        socket.end('PONG\0');
        return;
      }
      if (mode !== 'zINSTREAM') {
        socket.end('UNKNOWN COMMAND\0');
        return;
      }
    }
    while (buffer.length >= 4) {
      const size = buffer.readUInt32BE(0);
      if (size === 0) {
        const content = Buffer.concat(parts).toString('latin1');
        console.log(`analyse de ${total} octets`);
        socket.end(content.includes(EICAR) ? 'stream: Eicar-Signature FOUND\0' : 'stream: OK\0');
        return;
      }
      if (buffer.length < 4 + size) return;
      parts.push(buffer.subarray(4, 4 + size));
      total += size;
      buffer = buffer.subarray(4 + size);
      if (total > MAX) {
        socket.end('INSTREAM size limit exceeded. ERROR\0');
        return;
      }
    }
  });
  socket.on('error', () => undefined);
}).listen(port, '127.0.0.1', () => console.log(`faux clamd sur 127.0.0.1:${port}`));
