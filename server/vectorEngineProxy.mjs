import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleImageRequest } from './vectorEngineImageHandler.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT || 4174);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (request.method === 'POST' && url.pathname === '/api/images/generate') {
      await handleImageRequest(request, response);
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Suzhou garden app with VectorEngine proxy: http://localhost:${port}/`);
});

async function serveStatic(pathname, response) {
  const cleanPath = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(root, 'dist', cleanPath);
  const distRoot = join(root, 'dist');

  if (!filePath.startsWith(distRoot)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    });
    response.end(content);
  } catch {
    const fallback = await readFile(join(root, 'dist', 'index.html'));
    response.writeHead(200, { 'Content-Type': mimeTypes['.html'] });
    response.end(fallback);
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}
