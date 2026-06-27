#!/usr/bin/env node
// Dev server with live reload via Server-Sent Events. No dependencies.
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
};

// SSE clients waiting for reload signals
const clients = new Set();

// Injected into every HTML response — reconnects automatically if server restarts
const RELOAD_SCRIPT = `
<script>
(function(){
  var es = new EventSource('/__reload');
  es.onmessage = function(){ location.reload(); };
  es.onerror   = function(){ setTimeout(function(){ location.reload(); }, 500); };
})();
</script>`;

const server = http.createServer((req, res) => {
  if (req.url === '/__reload') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    res.write(':\n\n'); // initial comment keeps connection alive
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  const urlPath  = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(ROOT, urlPath);
  const ext      = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    if (ext === '.html') {
      res.end(data.toString().replace('</body>', RELOAD_SCRIPT + '</body>'));
    } else {
      res.end(data);
    }
  });
});

function reload() {
  clients.forEach(res => res.write('data: reload\n\n'));
}

// Watch for changes to any tracked file in the project root
fs.watch(ROOT, { persistent: true }, (event, filename) => {
  if (filename && !filename.startsWith('.') && filename !== 'serve.js') {
    console.log(`changed: ${filename}`);
    reload();
  }
});

server.listen(PORT, () => {
  console.log(`Serving at http://localhost:${PORT}  (Ctrl-C to stop)`);
});
