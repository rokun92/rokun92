const http = require('http');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');

const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const contents = fs.readFileSync(filePath, 'utf8');
  const env = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const rootEnv = parseDotEnv(path.join(rootDir, '.env'));
const assetsEnv = parseDotEnv(path.join(rootDir, 'assets/.env'));

const appEnv = {
  SUPABASE_URL:
    process.env.SUPABASE_URL ||
    rootEnv.SUPABASE_URL ||
    assetsEnv.SUPABASE_URL ||
    '',
  SUPABASE_ANON_KEY:
    process.env.SUPABASE_ANON_KEY ||
    rootEnv.SUPABASE_ANON_KEY ||
    assetsEnv.SUPABASE_ANON_KEY ||
    '',
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, statusCode, body, headers = {}) {
  // 3. IMPROVED: Ensure Content-Length is set for proper HTTP compliance
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(statusCode, {
    'Cache-Control': 'no-cache',
    'Content-Length': bodyBuffer.length,
    ...headers,
  });
  res.end(bodyBuffer);
}

async function serveFile(res, filePath) {
  try {
    const data = await fsPromises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = mimeTypes[ext] || 'application/octet-stream';
    send(res, 200, data, { 'Content-Type': type });
  } catch (error) {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

http.createServer(async (req, res) => {
  let pathname;
  try {
    // 4. SAFETY: Handle potential malformed URLs gracefully
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch (e) {
    send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  // Expose specific environment variables to the client
  if (pathname === '/config.js') {
    const script = `var env = window.env = ${JSON.stringify(appEnv)};`;
    send(res, 200, script, { 'Content-Type': 'application/javascript; charset=utf-8' });
    return;
  }

  // Default to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // 5. SECURITY: Robust path traversal protection
  // path.join safely resolves '..' segments. We then verify it stays inside rootDir.
  const filePath = path.join(rootDir, pathname);
  if (!filePath.startsWith(rootDir + path.sep) && filePath !== rootDir) {
    send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  try {
    // 6. PERFORMANCE: Use async fs.stat to avoid blocking the event loop
    const stats = await fsPromises.stat(filePath);
    
    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      try {
        await fsPromises.access(indexPath); // Check if index.html exists
        await serveFile(res, indexPath);
      } catch {
        send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      return;
    }
    
    await serveFile(res, filePath);
  } catch (error) {
    // File doesn't exist or permission denied
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}).listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});