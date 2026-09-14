const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, 'index.html');
const port = Number(process.env.LIFEOS_PREVIEW_PORT || 4173);
const reload = `<script>
(async function () {
  let version;
  setInterval(async () => {
    try {
      const response = await fetch('/__version', { cache: 'no-store' });
      const next = await response.text();
      if (version !== undefined && next !== version) location.reload();
      version = next;
    } catch (_) {}
  }, 1000);
})();
</script>`;

http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.url === '/__version') {
    res.setHeader('Content-Type', 'text/plain');
    res.end(String(fs.statSync(file).mtimeMs));
    return;
  }
  if (req.url !== '/' && req.url !== '/index.html') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(file, 'utf8').replace('</body>', reload + '</body>'));
}).listen(port, '127.0.0.1', () => {
  console.log(`LifeOS preview: http://127.0.0.1:${port}`);
});
