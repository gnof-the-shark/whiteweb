const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const rootDir = __dirname;
const port = process.env.PORT || 8080;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const normalizeFirstName = (value) =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('fr-CA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const parseAllowedNames = () =>
  (process.env.ALLOWED_FIRST_NAMES || '')
    .split(',')
    .map((name) => normalizeFirstName(name))
    .filter(Boolean);

const parseContactData = () => {
  const raw = process.env.CONTACT_OTHERS_JSON;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((entry) => String(entry)).filter(Boolean);
  } catch {
    return [];
  }
};

const sendJson = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const serveStaticFile = (req, res) => {
  const requestPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(requestPath).replace(/^\.\.(?:\/|\\|$)/, '');
  const filePath = path.join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const extension = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream'
    });
    res.end(data);
  });
};

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/contact/others') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
      }
    });

    req.on('end', () => {
      const allowedNames = parseAllowedNames();
      const contacts = parseContactData();

      if (allowedNames.length === 0 || contacts.length === 0) {
        sendJson(res, 503, {
          message: 'Configuration serveur incomplète.'
        });
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(body || '{}');
      } catch {
        sendJson(res, 400, { message: 'Requête invalide.' });
        return;
      }

      const prenom = normalizeFirstName(parsed.prenom);
      if (!prenom || !allowedNames.includes(prenom)) {
        sendJson(res, 403, { message: 'Accès refusé.' });
        return;
      }

      sendJson(res, 200, { contacts });
    });

    return;
  }

  serveStaticFile(req, res);
});

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
