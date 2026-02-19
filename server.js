const http = require('http');
const fs = require('fs');
const path = require('path');

const INITIAL_PORT = Number(process.env.PORT || 8000);
const MAX_PORT_ATTEMPTS = 10;
const root = __dirname;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function createServer() {
  return http.createServer((req, res) => {
    const requestPath = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(root, decodeURIComponent(requestPath));

    if (!filePath.startsWith(root)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        serveFile(filePath, res);
      } else {
        serveFile(path.join(root, 'index.html'), res);
      }
    });
  });
}

function startServer(startPort) {
  let attempt = 0;

  function tryListen(port) {
    const server = createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
        attempt += 1;
        const nextPort = port + 1;
        console.warn(`Puerto ${port} ocupado. Reintentando en ${nextPort}...`);
        tryListen(nextPort);
        return;
      }

      console.error('No se pudo iniciar el servidor:', err.message);
      process.exit(1);
    });

    server.listen(port, () => {
      console.log(`Naruko Survivors server running at http://localhost:${port}`);
      if (port !== INITIAL_PORT) {
        console.log(`Nota: se usó ${port} porque ${INITIAL_PORT} estaba ocupado.`);
      }
    });
  }

  tryListen(startPort);
}

startServer(INITIAL_PORT);
