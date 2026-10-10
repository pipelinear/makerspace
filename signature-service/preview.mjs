// Local website preview with a fixed proxy to the existing signature service.
import { createServer } from 'node:http';
import { createReadStream, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const siteRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
function backendURL(site) {
  const value = readFileSync(path.join(site, 'content.js'), 'utf8').match(/apiUrl: '([^']+)'/)?.[1];
  if (!value) throw new Error('Run the signature service setup first.');
  return value;
}
function validateBackend(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/^makerspace-signatures\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname) || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('The preview requires the configured Makerspace workers.dev service.');
  return url.origin;
}
function reply(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(text);
}
export function createPreviewHandler({ site = siteRoot, apiURL = backendURL(site), fetcher = fetch } = {}) {
  const backend = validateBackend(apiURL);
  return async (req, res) => {
    try {
      const local = new URL('http://' + req.headers.host);
      if (!['127.0.0.1', 'localhost'].includes(local.hostname) || Number(local.port) !== req.socket.localPort) return reply(res, 403, 'Open the local preview address.');
      const url = new URL(req.url, local.origin);
      if (url.pathname.startsWith('/signature-api/')) {
        // The proxy is accessible only from this local preview. Cookies are never
        // forwarded, and admin operations still need the real password and token.
        if (req.headers.origin && req.headers.origin !== local.origin || !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== local.origin) return reply(res, 403, 'Open the local preview to use the signing desk.');
        if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(req.method)) return reply(res, 405, 'Method not allowed.');
        const headers = { Origin: 'https://pipelinear.github.io' };
        for (const name of ['content-type', 'authorization', 'if-none-match']) if (req.headers[name]) headers[name] = req.headers[name];
        let body;
        if (!['GET', 'HEAD'].includes(req.method)) {
          let bytes = 0; const chunks = [];
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > 3 * 1024 * 1024) return reply(res, 413, 'Choose a smaller image.');
            chunks.push(chunk);
          }
          if (bytes) body = Buffer.concat(chunks);
        }
        const response = await fetcher(backend + url.pathname.slice('/signature-api'.length) + url.search, { method: req.method, headers, body, redirect: 'error', signal: AbortSignal.timeout(20000) });
        const outputHeaders = { 'X-Content-Type-Options': 'nosniff' };
        for (const name of ['content-type', 'cache-control', 'etag', 'content-disposition']) if (response.headers.has(name)) outputHeaders[name] = response.headers.get(name);
        res.writeHead(response.status, outputHeaders);
        if (!response.body || req.method === 'HEAD') return res.end();
        Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, 'Method not allowed.');
      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(site, '.' + pathname);
      if (!file.startsWith(path.resolve(site) + path.sep) || pathname.split('/').some(part => part.startsWith('.'))) return reply(res, 404, 'Not found.');
      const info = await stat(file);
      if (!info.isFile()) return reply(res, 404, 'Not found.');
      const headers = { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + (['.html', '.js', '.css'].includes(path.extname(file)) ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
      res.writeHead(200, headers);
      if (req.method === 'HEAD') return res.end();
      if (file === path.join(site, 'content.js')) return res.end(readFileSync(file, 'utf8').replace(/apiUrl: '[^']*'/, "apiUrl: '/signature-api'"));
      createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      if (res.headersSent) res.destroy();
      else reply(res, error.code === 'ENOENT' ? 404 : 502, error.code === 'ENOENT' ? 'Not found.' : 'Could not connect to the shared book. Try again.');
    }
  };
}
export function startPreview() {
  const server = createServer(createPreviewHandler());
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? 'The preview is already running. Open http://127.0.0.1:4173/' : error.message);
    process.exitCode = 1;
  });
  server.listen(4173, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:4173/';
    console.log('Local Makerspace: ' + url + '\nConnected to the live shared book. Keep this Terminal window open; press Ctrl+C to stop.');
    if (process.platform === 'darwin') spawn('/usr/bin/open', [url], { stdio: 'ignore' }).on('error', () => {});
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { startPreview(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
