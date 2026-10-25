/* Battle Report 40k – https front for the online server with your own domain and certificate (no Cloudflare tunnel).
 * Terminates TLS and forwards every request to the supervised server on 127.0.0.1:8420 with X-Forwarded-For /
 * X-Forwarded-Proto, so the server sees the real client address, treats the connection as https (Secure cookies) and
 * never takes it for a local admin (server/auth.js: a forwarded request is "tunneled"). Port 80 only redirects to https.
 * SSE (the games' event streams) and request bodies are streamed through unchanged.
 *
 *   node server\online-https.mjs [--cert <file>] [--key <file>] [--host battlereport.jlpicture.de] [--https 443] [--http 80] [--upstream 8420]
 *   env: BR_ONLINE_CERT, BR_ONLINE_KEY (default B:\BattleReportServer\tls\certificate.pem + private-key.pem),
 *        BR_ONLINE_HOST, BR_ONLINE_HTTPS_PORT, BR_ONLINE_HTTP_PORT, BR_ONLINE_PORT (upstream)
 * The certificate files are re-read every 10 minutes (and on SIGHUP) – a renewed certificate needs no restart.
 * cert = the certificate followed by the intermediate chain (PEM); key = the private key (PEM). Start: Online-Https.cmd */
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = name => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultTlsDir = () => process.platform === 'win32' && fs.existsSync('B:\\') ? 'B:\\BattleReportServer\\tls' : path.join(ROOT, '..', 'BattleReportServer', 'tls');
const TLS_DIR = defaultTlsDir();
const CERT = arg('cert') || process.env.BR_ONLINE_CERT || path.join(TLS_DIR, 'certificate.pem');
const KEY = arg('key') || process.env.BR_ONLINE_KEY || path.join(TLS_DIR, 'private-key.pem');
const HOST = arg('host') || process.env.BR_ONLINE_HOST || '';                 // the public host name (redirects, Host check)
const HTTPS_PORT = Number(arg('https') || process.env.BR_ONLINE_HTTPS_PORT || 443);
const HTTP_PORT = Number(arg('http') || process.env.BR_ONLINE_HTTP_PORT || 80);     // 0 = no redirect listener
const UPSTREAM = Number(arg('upstream') || process.env.BR_ONLINE_PORT || 8420);
const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function readTls() {
  const cert = fs.readFileSync(CERT);
  const key = fs.readFileSync(KEY);
  return { cert, key };
}
let tlsStamp = '';
function tlsChanged() {
  try { const s = fs.statSync(CERT).mtimeMs + ':' + fs.statSync(KEY).mtimeMs; if (s === tlsStamp) return false; tlsStamp = s; return true; } catch { return false; }
}

const agent = new http.Agent({ keepAlive: true, maxSockets: 256 });
function forward(req, res) {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k.toLowerCase())) headers[k] = v;
  const ip = req.socket.remoteAddress || '';
  headers['x-forwarded-for'] = (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'] + ', ' : '') + ip;
  headers['x-forwarded-proto'] = 'https';
  headers['x-forwarded-host'] = req.headers.host || HOST;
  // the server's admin page answers only to a plain local Host header – through this front the real host name goes
  if (HOST) headers.host = HOST;
  const up = http.request({ host: '127.0.0.1', port: UPSTREAM, method: req.method, path: req.url, headers, agent }, r => {
    const h = {};
    for (const [k, v] of Object.entries(r.headers)) if (!HOP.has(k.toLowerCase())) h[k] = v;
    res.writeHead(r.statusCode, h);
    r.pipe(res);
    r.on('error', () => { try { res.destroy(); } catch {} });
  });
  up.on('error', e => {
    if (res.headersSent) { try { res.destroy(); } catch {} return; }
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'The online server is not running (' + e.code + ') – start Online-Server.cmd' }));
  });
  req.pipe(up);
  req.on('error', () => up.destroy());
  res.on('close', () => { if (!res.writableFinished) up.destroy(); });   // the client left (SSE) → drop the upstream request
}

const tls = readTls(); tlsChanged();
const server = https.createServer(Object.assign({ minVersion: 'TLSv1.2' }, tls), forward);
server.keepAliveTimeout = 65000;
server.on('clientError', (err, socket) => { try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch {} });
server.on('tlsClientError', () => {});
server.listen(HTTPS_PORT, '0.0.0.0', () => log(`https on :${HTTPS_PORT} → http://127.0.0.1:${UPSTREAM}${HOST ? ' as ' + HOST : ''} (cert ${CERT})`));

if (HTTP_PORT) {
  http.createServer((req, res) => {
    const host = (HOST || String(req.headers.host || '').replace(/:\d+$/, ''));
    res.writeHead(301, { Location: `https://${host}${HTTPS_PORT === 443 ? '' : ':' + HTTPS_PORT}${req.url}`, 'Content-Length': 0 });
    res.end();
  }).listen(HTTP_PORT, '0.0.0.0', () => log(`http on :${HTTP_PORT} → redirect to https`));
}

function reload(why) {
  try { server.setSecureContext(readTls()); log('certificate reloaded (' + why + ')'); }
  catch (e) { log('certificate reload failed: ' + e.message); }
}
setInterval(() => { if (tlsChanged()) reload('file changed'); }, 10 * 60 * 1000).unref();
process.on('SIGHUP', () => reload('SIGHUP'));
try {
  const { X509Certificate } = await import('node:crypto');
  const x = new X509Certificate(tls.cert);
  log(`certificate: ${x.subject.replace(/\n/g, ' ')} – valid until ${x.validTo}`);
} catch {}
