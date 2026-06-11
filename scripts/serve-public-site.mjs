import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createServer } from 'node:http';

const root = resolve(process.argv[2] ?? 'public-site');
const host = process.env.PUBLIC_SITE_HOST ?? '0.0.0.0';
const port = Number.parseInt(process.env.PUBLIC_SITE_PORT ?? '9000', 10);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp']
]);

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  const cleanPath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  let candidate = resolve(root, `.${cleanPath}`);

  if (!candidate.startsWith(root + sep) && candidate !== root) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    candidate = join(candidate, 'index.html');
  }

  if (!existsSync(candidate) && !extname(candidate)) {
    candidate = join(candidate, 'index.html');
  }

  return candidate;
}

createServer((request, response) => {
  const filePath = resolveRequestPath(request.url ?? '/');
  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'cache-control': 'no-cache',
    'content-type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream'
  });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Guardian public site serving ${root} on http://${host}:${port}`);
});
