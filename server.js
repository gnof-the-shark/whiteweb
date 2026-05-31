const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const rootDir = __dirname;
const port = process.env.PORT || 8080;
const MAX_REQUEST_SIZE = 1024 * 1024;
const calendarEventsPath = path.join(rootDir, 'data', 'calendar-events.json');
const noTimeSortValue = '99:99';
const MAX_EVENT_TEXT_LENGTH = 120;

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

    return parsed
      .filter((entry) => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  } catch (error) {
    console.error('CONTACT_OTHERS_JSON invalide:', error);
    return [];
  }
};

const sendJson = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req, res, onSuccess) => {
  let body = '';
  let requestTooLarge = false;

  req.on('data', (chunk) => {
    if (requestTooLarge) {
      return;
    }

    if (body.length + chunk.length > MAX_REQUEST_SIZE) {
      requestTooLarge = true;
      sendJson(res, 413, { message: 'Requête trop volumineuse.' });
      return;
    }

    body += chunk;
  });

  req.on('end', () => {
    if (requestTooLarge) {
      return;
    }

    try {
      const parsed = JSON.parse(body || '{}');
      onSuccess(parsed);
    } catch {
      sendJson(res, 400, { message: 'Requête invalide.' });
    }
  });
};

const isValidDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isValidTime = (value) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const normalizeEventsByDay = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const normalized = {};

  for (const [dateKey, entries] of Object.entries(input)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(entries)) {
      continue;
    }

    const normalizedEntries = entries
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => {
        const text = typeof entry.text === 'string' ? entry.text.trim() : '';
        const time = typeof entry.time === 'string' ? entry.time : '';
        return { text, time };
      })
      .filter(
        (entry) => entry.text.length > 0 && entry.text.length <= MAX_EVENT_TEXT_LENGTH && isValidTime(entry.time)
      )
      .sort((a, b) => {
        const safeTimeA = a.time || noTimeSortValue;
        const safeTimeB = b.time || noTimeSortValue;
        return safeTimeA.localeCompare(safeTimeB);
      });

    if (normalizedEntries.length > 0) {
      normalized[dateKey] = normalizedEntries;
    }
  }

  return normalized;
};

const readCalendarEvents = () => {
  try {
    const raw = fs.readFileSync(calendarEventsPath, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return normalizeEventsByDay(parsed) || {};
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {};
    }
    console.error('Erreur lecture calendrier:', error);
    return {};
  }
};

const writeCalendarEvents = (eventsByDay) => {
  fs.mkdirSync(path.dirname(calendarEventsPath), { recursive: true });
  fs.writeFileSync(calendarEventsPath, JSON.stringify(eventsByDay, null, 2), 'utf8');
};

const serveStaticFile = (req, res) => {
  const requestPath = req.url === '/' ? '/index.html' : String(req.url || '/').split('?')[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }
  const filePath = path.resolve(rootDir, `.${decodedPath}`);
  const relativePath = path.relative(rootDir, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
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
  if (req.method === 'GET' && req.url === '/api/calendar/events') {
    sendJson(res, 200, { eventsByDay: readCalendarEvents() });
    return;
  }

  if (req.method === 'PUT' && req.url === '/api/calendar/events') {
    readJsonBody(req, res, (parsed) => {
      const normalizedEvents = normalizeEventsByDay(parsed.eventsByDay);
      if (!normalizedEvents) {
        sendJson(res, 400, { message: 'Requête invalide.' });
        return;
      }

      try {
        writeCalendarEvents(normalizedEvents);
      } catch (error) {
        console.error('Erreur écriture calendrier:', error);
        sendJson(res, 500, { message: 'Impossible d’enregistrer les événements.' });
        return;
      }

      sendJson(res, 200, { eventsByDay: normalizedEvents });
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/contact/others') {
    readJsonBody(req, res, (parsed) => {
      const allowedNames = parseAllowedNames();
      const contacts = parseContactData();

      if (allowedNames.length === 0 || contacts.length === 0) {
        sendJson(res, 503, {
          message: 'Configuration serveur incomplète.'
        });
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
