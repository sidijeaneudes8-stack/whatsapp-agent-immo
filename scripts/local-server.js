// scripts/local-server.js
// Petit serveur HTTP pour tester le webhook en local, sans dépendre de
// `vercel dev`. Usage : node scripts/local-server.js
// Puis : curl -X POST http://localhost:3000/api/webhook -d @payload.json ...
require('dotenv').config();
const http = require('http');
const handler = require('../api/webhook');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url !== '/api/webhook') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', () => {
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch (e) {
      req.body = {};
    }

    // Petite couche pour imiter l'API res de Vercel (res.status().json()).
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (payload) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
    };

    handler(req, res);
  });
});

server.listen(PORT, () => {
  console.log(`Webhook local prêt sur http://localhost:${PORT}/api/webhook`);
});
