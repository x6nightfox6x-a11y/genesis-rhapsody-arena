import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { root, pages, folders } from './site.mjs';
const mime = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.css': 'text/css', '.js': 'text/javascript' };
export async function startServer({ port = 4173, directory = root } = {}) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const name = decodeURIComponent(url.pathname).replace(/^\//, '') || 'studio.html';
      if (name.includes('\\') || name.split('/').some(p => p === '..' || p.startsWith('.')) || !(pages.includes(name) || folders.some(folder => name.startsWith(folder + '/')))) {
        response.writeHead(404); response.end('Not found'); return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      const content = await readFile(path.join(directory, name));
      response.writeHead(200, { 'Content-Type': mime[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer({ port: Number(process.env.PORT || 4173) }).then(({ url }) => console.log(`Arena Studio: ${url}/studio.html\nGame: ${url}/Arena%20game.html\nCtrl+C stops the preview.`)).catch(error => { console.error(error.code === 'EADDRINUSE' ? 'Port is busy. Reuse the running preview or set PORT=4174.' : error); process.exitCode = 1; });
}
