// Fournit à la page admin locale (http://localhost:3002) une session de test, sans que le mot de passe
// apparaisse ailleurs que dans test.env. GET /admin ou GET /seller?email=… → { accessToken, refreshToken, role }.
import { createServer } from 'http';

const API = 'http://localhost:3100';
const newPassword = `Essai-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (status, json) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'http://localhost:3002' });
    res.end(JSON.stringify(json));
  };
  // Mots de passe de test pour remplir le formulaire de connexion de la page sans les écrire ailleurs.
  if (url.pathname === '/password') return send(200, { password: process.env.BS_ADMIN_PASSWORD });
  if (url.pathname === '/new-password') return send(200, { password: newPassword });
  // Mots de passe de test pour remplir le formulaire de connexion de la page sans les écrire ailleurs.
  if (url.pathname === '/password') return send(200, { password: process.env.BS_ADMIN_PASSWORD });
  if (url.pathname === '/new-password') return send(200, { password: newPassword });
  try {
    const seller = url.pathname === '/seller';
    const body = seller
      ? { email: url.searchParams.get('email'), password: 'vendeur2026' }
      : { email: 'admin@blackstore.cm', password: process.env.BS_ADMIN_PASSWORD };
    const r = await fetch(`${API}${seller ? '/seller/auth/login' : '/auth/login'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Real-IP': '10.7.7.7' },
      body: JSON.stringify(body),
    });
    const json = await r.json();
    send(r.status, { accessToken: json.accessToken, refreshToken: json.refreshToken ?? '', role: seller ? 'seller' : 'admin' });
  } catch (error) {
    send(500, { error: String(error) });
  }
}).listen(3999, '127.0.0.1', () => console.log('aide de connexion sur 127.0.0.1:3999'));
