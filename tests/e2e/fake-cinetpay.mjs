// Faux CinetPay pour les essais locaux : initialisation (POST /payment) et vérification (POST /payment/check).
// Un paiement est « ACCEPTED », sauf si sa référence a été déclarée refusée par POST /_refuse.
// Usage : node fake-cinetpay.mjs [port]
import { createServer } from 'http';

const port = Number(process.argv[2] ?? 3998);
const refused = new Set();
const checks = [];

createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const data = body ? JSON.parse(body) : {};
    const send = (json) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
    };
    if (req.url === '/payment') {
      return send({ code: '201', payment_token: `tok-${data.transaction_id}`, payment_url: `http://localhost:${port}/pay/${data.transaction_id}` });
    }
    if (req.url === '/payment/check') {
      checks.push(data.transaction_id);
      return send({ status: refused.has(data.transaction_id) ? 'REFUSED' : 'ACCEPTED' });
    }
    if (req.url === '/_refuse') {
      refused.add(data.transaction_id);
      return send({ ok: true });
    }
    if (req.url === '/_checks') return send({ checks });
    res.writeHead(404);
    res.end();
  });
}).listen(port, '127.0.0.1', () => console.log(`faux CinetPay sur 127.0.0.1:${port}`));
