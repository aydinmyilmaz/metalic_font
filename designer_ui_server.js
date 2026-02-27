const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { normalizeConfig, render } = require('./generate_clarendon_arc');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 5173);
const ROOT_DIR = __dirname;
const UI_DIR = path.join(ROOT_DIR, 'ui');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const MAX_BODY_BYTES = 1_000_000;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

let renderCounter = 0;

function walkFontFiles(baseDir, relDir = '') {
  const absDir = path.join(baseDir, relDir);
  if (!fs.existsSync(absDir)) return [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...walkFontFiles(baseDir, relPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ttf|otf|ttc)$/i.test(entry.name)) continue;
    files.push(relPath.split(path.sep).join('/'));
  }
  return files;
}

function listAvailableFonts() {
  const fontsDir = path.join(ROOT_DIR, 'fonts');
  if (!fs.existsSync(fontsDir)) return [];
  return walkFontFiles(fontsDir).sort((a, b) => a.localeCompare(b, 'tr'));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    sendText(res, 404, 'Not found');
    return;
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    sendText(res, 404, 'Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const headers = { 'Content-Type': mime };
  if (ext === '.html' || ext === '.css' || ext === '.js') {
    headers['Cache-Control'] = 'no-store, max-age=0';
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

function sanitizeOutName(rawValue) {
  const cleaned = String(rawValue || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (cleaned) return cleaned;
  renderCounter += 1;
  return `ui_preview_${Date.now()}_${renderCounter}`;
}

function safeOutputPath(requestPathname) {
  const relative = decodeURIComponent(requestPathname.replace(/^\/output\//, ''));
  const absolute = path.resolve(OUTPUT_DIR, relative);
  if (absolute === OUTPUT_DIR || absolute.startsWith(OUTPUT_DIR + path.sep)) return absolute;
  return null;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

async function handleRequest(req, res) {
  const baseUrl = `http://${req.headers.host || `${HOST}:${PORT}`}`;
  const url = new URL(req.url, baseUrl);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/designer')) {
    sendFile(res, path.join(UI_DIR, 'designer.html'));
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/designer.js' || url.pathname === '/designer.css')) {
    sendFile(res, path.join(UI_DIR, url.pathname.replace('/', '')));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/defaults') {
    const preset = String(url.searchParams.get('preset') || '');
    const config = normalizeConfig({ preset });
    sendJson(res, 200, { ok: true, config });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/fonts') {
    sendJson(res, 200, { ok: true, fonts: listAvailableFonts() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/render') {
    try {
      const payload = await readJsonBody(req);
      const out = sanitizeOutName(payload.out);
      const config = normalizeConfig({ ...payload, out });
      const result = render(config, { quiet: true });
      sendJson(res, 200, {
        ok: true,
        imageUrl: `/output/${path.basename(result.pngPath)}?v=${Date.now()}`,
        font: result.fontInfo,
        config: result.cfg,
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: String(error.message || error) });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/output/')) {
    const outputFile = safeOutputPath(url.pathname);
    if (!outputFile) {
      sendText(res, 403, 'Forbidden');
      return;
    }
    sendFile(res, outputFile);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/healthz') {
    sendText(res, 200, 'ok');
    return;
  }

  sendText(res, 404, 'Not found');
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { ok: false, error: 'Internal server error' });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Designer UI running: http://${HOST}:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
