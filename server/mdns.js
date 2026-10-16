/* Minimal DNS-SD over mDNS (RFC 6762/6763), dependency-free (node:dgram) – the desktop counterpart of the Android app's
 * HostService (NsdManager.registerService) + Discovery (NsdManager.discoverServices/resolveService).
 *
 *   const md = createMdns({ type: '_br40k._tcp', log })
 *   md.setGames(port, summaries)   // advertise every unfinished game hosted here (not moved away) as "Battle Report <CODE>" (TXT code/p0/p1/stage,
 *                                  // c0/c1 = player colour indices, dev = device name);
 *                                  // games that are finished / gone are unadvertised (goodbye, TTL 0)
 *   md.startBrowse()               // find games of other devices
 *   md.list()                      // → [{ name, host, port, code, p0, p1, stage, c0, c1, dev }] (own IPs excluded unless includeSelf)
 *   md.stop()                      // goodbye for everything, close sockets
 *
 * One UDP socket per LAN interface, all bound to 0.0.0.0:5353 (reuseAddr) and joined to 224.0.0.251 on that interface;
 * a socket only handles packets from its interface's subnet, so answers carry the A record the asker can reach.
 */
import dgram from 'node:dgram';
import os from 'node:os';

const GROUP = '224.0.0.251', MDNS_PORT = 5353;
const T = { A: 1, PTR: 12, TXT: 16, AAAA: 28, SRV: 33, NSEC: 47, ANY: 255 };
const VIRTUAL_IF = /vEthernet|VirtualBox|VMware|WSL|Hyper-V|docker|vbox|Loopback|ZeroTier|Tailscale|TAP-|Bluetooth/i;

// ---------------------------------------------------------------- DNS wire format
function encodeName(name) {
  const parts = name.replace(/\.$/, '').split('.');
  const bufs = [];
  for (const p of parts) { const b = Buffer.from(p, 'utf8').subarray(0, 63); bufs.push(Buffer.from([b.length]), b); }
  bufs.push(Buffer.from([0]));
  return Buffer.concat(bufs);
}
// Instance names may contain dots in theory; ours ("Battle Report ABCD") don't, so plain label splitting is fine.
function encodeInstance(instance, service) { return Buffer.concat([Buffer.from([Buffer.byteLength(instance)]), Buffer.from(instance, 'utf8'), encodeName(service)]); }

function decodeName(buf, off) {
  const labels = [];
  let jumped = false, end = off, guard = 0;
  while (guard++ < 128) {
    if (off >= buf.length) throw new Error('name overflow');
    const len = buf[off];
    if (len === 0) { if (!jumped) end = off + 1; break; }
    if ((len & 0xc0) === 0xc0) {
      if (!jumped) end = off + 2;
      off = ((len & 0x3f) << 8) | buf[off + 1];
      jumped = true;
      continue;
    }
    labels.push(buf.toString('utf8', off + 1, off + 1 + len));
    off += 1 + len;
  }
  return { labels, end };
}

function parsePacket(buf) {
  const id = buf.readUInt16BE(0), flags = buf.readUInt16BE(2);
  const qd = buf.readUInt16BE(4), an = buf.readUInt16BE(6), ns = buf.readUInt16BE(8), ar = buf.readUInt16BE(10);
  let off = 12;
  const questions = [], records = [];
  for (let i = 0; i < qd; i++) {
    const n = decodeName(buf, off); off = n.end;
    const type = buf.readUInt16BE(off), cls = buf.readUInt16BE(off + 2); off += 4;
    questions.push({ name: n.labels.join('.'), labels: n.labels, type, qu: !!(cls & 0x8000) });
  }
  for (let i = 0; i < an + ns + ar; i++) {
    const n = decodeName(buf, off); off = n.end;
    const type = buf.readUInt16BE(off), ttl = buf.readUInt32BE(off + 4), rdlen = buf.readUInt16BE(off + 8);
    const rd = off + 10; off = rd + rdlen;
    if (off > buf.length) throw new Error('record overflow');
    const r = { name: n.labels.join('.'), labels: n.labels, type, ttl };
    if (type === T.PTR) { const p = decodeName(buf, rd); r.ptrLabels = p.labels; r.data = p.labels.join('.'); }
    else if (type === T.SRV) r.data = { priority: buf.readUInt16BE(rd), weight: buf.readUInt16BE(rd + 2), port: buf.readUInt16BE(rd + 4), target: decodeName(buf, rd + 6).labels.join('.') };
    else if (type === T.A && rdlen === 4) r.data = `${buf[rd]}.${buf[rd + 1]}.${buf[rd + 2]}.${buf[rd + 3]}`;
    else if (type === T.TXT) {
      const kv = {};
      for (let p = rd; p < rd + rdlen;) {
        const l = buf[p]; const s = buf.toString('utf8', p + 1, p + 1 + l); p += 1 + l;
        if (!s) continue;
        const eq = s.indexOf('=');
        if (eq < 0) kv[s.toLowerCase()] = ''; else kv[s.slice(0, eq).toLowerCase()] = s.slice(eq + 1);
      }
      r.data = kv;
    }
    records.push(r);
  }
  return { id, response: !!(flags & 0x8000), questions, records };
}

function rr(nameBuf, type, ttl, rdata, flush) {
  const h = Buffer.alloc(10);
  h.writeUInt16BE(type, 0);
  h.writeUInt16BE(flush ? 0x8001 : 0x0001, 2);
  h.writeUInt32BE(ttl, 4);
  h.writeUInt16BE(rdata.length, 8);
  return Buffer.concat([nameBuf, h, rdata]);
}
function packet({ id = 0, response, questions = [], answers = [], additionals = [] }) {
  const h = Buffer.alloc(12);
  h.writeUInt16BE(id, 0);
  h.writeUInt16BE(response ? 0x8400 : 0, 2);
  h.writeUInt16BE(questions.length, 4);
  h.writeUInt16BE(answers.length, 6);
  h.writeUInt16BE(additionals.length, 10);
  return Buffer.concat([h, ...questions, ...answers, ...additionals]);
}
function question(name, type, qu) {
  const t = Buffer.alloc(4); t.writeUInt16BE(type, 0); t.writeUInt16BE(qu ? 0x8001 : 1, 2);
  return Buffer.concat([encodeName(name), t]);
}
function txtData(obj) {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) { const b = Buffer.from(`${k}=${v == null ? '' : v}`, 'utf8').subarray(0, 255); parts.push(Buffer.from([b.length]), b); }
  return parts.length ? Buffer.concat(parts) : Buffer.from([0]);
}
function srvData(port, target) {
  const b = Buffer.alloc(6); b.writeUInt16BE(0, 0); b.writeUInt16BE(0, 2); b.writeUInt16BE(port, 4);
  return Buffer.concat([b, encodeName(target)]);
}
const aData = ip => Buffer.from(ip.split('.').map(Number));

// ---------------------------------------------------------------- helpers
const ipNum = ip => ip.split('.').reduce((n, x) => ((n << 8) | Number(x)) >>> 0, 0);
const sameSubnet = (a, b, mask) => ((ipNum(a) & ipNum(mask)) >>> 0) === ((ipNum(b) & ipNum(mask)) >>> 0);
const lc = s => String(s).toLowerCase();

/** LAN IPv4 interfaces [{ name, address, netmask }] – real adapters first. */
export function lanInterfaces() {
  const real = [], virt = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (!(a.family === 'IPv4' || a.family === 4) || a.internal || a.address.startsWith('169.254.')) continue;
      (VIRTUAL_IF.test(name) ? virt : real).push({ name, address: a.address, netmask: a.netmask || '255.255.255.0' });
    }
  }
  return [...real, ...virt];
}

export function createMdns(opts = {}) {
  const TYPE = (opts.type || '_br40k._tcp').replace(/\.local\.?$/, '') + '.local';
  const META = '_services._dns-sd._udp.local';
  const log = opts.log || { log() {}, error() {} };
  const host = (opts.hostname || ('br40k-' + os.hostname().replace(/[^A-Za-z0-9-]/g, '-').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6))) + '.local';
  const includeSelf = !!opts.includeSelf;
  const deviceName = String(opts.deviceName || os.hostname() || '').slice(0, 40);   // TXT "dev" (handover banner)

  /** code → { instance, port, txt } */
  const services = new Map();
  /** per interface: { iface, sock } */
  let socks = [];
  let ifKey = '';
  let closed = false;
  let browsing = false;
  let browseTimer = null, ifTimer = null, queryN = 0;

  // ------------------------------------------------ sockets
  function openSockets() {
    const ifs = lanInterfaces();
    const key = ifs.map(i => i.address + '/' + i.netmask).join(',');
    if (key === ifKey && socks.length) return;
    const hadServices = services.size;
    closeSockets();
    ifKey = key;
    for (const iface of ifs) {
      const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      const entry = { iface, sock, ready: false };
      sock.on('error', e => log.error('mdns socket', iface.address, e.message));
      sock.on('message', (msg, rinfo) => onMessage(entry, msg, rinfo));
      sock.bind(MDNS_PORT, () => {
        try {
          sock.addMembership(GROUP, iface.address);
          sock.setMulticastInterface(iface.address);
          sock.setMulticastTTL(255);
          sock.setMulticastLoopback(true);
          entry.ready = true;
          if (hadServices || services.size) announce(entry, [...services.values()], 120, 4500);
          if (browsing) sendQuery(entry);
        } catch (e) { log.error('mdns membership', iface.address, e.message); }
      });
      socks.push(entry);
    }
  }
  function closeSockets() {
    for (const s of socks) { try { s.sock.close(); } catch {} }
    socks = [];
  }
  function send(entry, buf, addr = GROUP, port = MDNS_PORT) {
    if (!entry.ready || closed) return;
    entry.sock.send(buf, port, addr, e => { if (e) log.error('mdns send', e.message); });
  }

  // ------------------------------------------------ records of our services
  const fqdn = s => s.instance + '.' + TYPE;
  function recordsFor(s, ip, hostTtl = 120, otherTtl = 4500) {
    const inst = encodeInstance(s.instance, TYPE);
    return {
      ptr: rr(encodeName(TYPE), T.PTR, otherTtl, inst, false),
      srv: rr(inst, T.SRV, hostTtl, srvData(s.port, host), true),
      txt: rr(inst, T.TXT, otherTtl, txtData(s.txt), true),
      a: rr(encodeName(host), T.A, hostTtl, aData(ip), true),
      meta: rr(encodeName(META), T.PTR, otherTtl, encodeName(TYPE), false)
    };
  }
  function announce(entry, list, hostTtl, otherTtl) {
    if (!list.length) return;
    const answers = [], additionals = [];
    for (const s of list) {
      const r = recordsFor(s, entry.iface.address, hostTtl, otherTtl);
      answers.push(r.ptr, r.srv, r.txt);
    }
    if (hostTtl > 0) additionals.push(recordsFor(list[0], entry.iface.address).a);
    send(entry, packet({ response: true, answers, additionals }));
  }
  function announceAll(list, repeat = true) {
    for (const e of socks) announce(e, list, 120, 4500);
    if (repeat) setTimeout(() => { if (!closed) for (const e of socks) announce(e, list.filter(s => services.get(s.code) === s), 120, 4500); }, 1000).unref?.();
  }
  function goodbye(list) { for (const e of socks) announce(e, list, 0, 0); }

  // ------------------------------------------------ incoming
  function onMessage(entry, msg, rinfo) {
    // Each socket sees every packet (all bound to 0.0.0.0:5353) – handle only the ones from its own subnet.
    if (!sameSubnet(rinfo.address, entry.iface.address, entry.iface.netmask)) return;
    let p;
    try { p = parsePacket(msg); } catch { return; }
    if (p.response) { if (browsing) onResponse(p, entry); }
    else if (services.size) onQuery(entry, p, rinfo);
  }

  function onQuery(entry, p, rinfo) {
    const answers = [], additionals = [];
    const ip = entry.iface.address;
    const add = (arr, b) => { if (!answers.includes(b) && !additionals.includes(b)) arr.push(b); };
    const list = [...services.values()];
    const cache = new Map(list.map(s => [s, recordsFor(s, ip)]));
    let needA = false;
    for (const q of p.questions) {
      const n = lc(q.name);
      const any = q.type === T.ANY;
      if (n === lc(TYPE) && (q.type === T.PTR || any)) {
        for (const s of list) { const r = cache.get(s); add(answers, r.ptr); add(additionals, r.srv); add(additionals, r.txt); }
        needA = true;
      } else if (n === lc(META) && (q.type === T.PTR || any)) {
        add(answers, cache.get(list[0]).meta);
      } else if (n === lc(host) && (q.type === T.A || any)) {
        add(answers, cache.get(list[0]).a);
      } else {
        const s = list.find(x => lc(fqdn(x)) === n);
        if (!s) continue;
        const r = cache.get(s);
        if (q.type === T.SRV || any) { add(answers, r.srv); needA = true; }
        if (q.type === T.TXT || any) add(answers, r.txt);
      }
    }
    if (!answers.length) return;
    if (needA) add(additionals, cache.get(list[0]).a);
    if (rinfo.port !== MDNS_PORT) {
      // Legacy unicast query (RFC 6762 §6.7): reply directly, same id, echo the questions
      const qs = p.questions.map(q => question(q.name, q.type, false));
      send(entry, packet({ id: p.id, response: true, questions: qs, answers, additionals }), rinfo.address, rinfo.port);
    } else {
      send(entry, packet({ response: true, answers, additionals }));
    }
  }

  // ------------------------------------------------ browsing
  /** instance fqdn (lower) → { name, fqdn, expires, seen } */
  const ptrs = new Map();
  /** fqdn (lower) → { port, target, expires } */
  const srvs = new Map();
  /** fqdn (lower) → { kv, expires } */
  const txts = new Map();
  /** host (lower) → Map(ip → expires) */
  const hosts = new Map();
  const SEEN_MS = 65000;   // no answer to our periodic queries for this long → gone (device left without goodbye)

  function onResponse(p, entry) {
    const now = Date.now();
    const exp = ttl => now + ttl * 1000;
    const missing = [];
    for (const r of p.records) {
      const n = lc(r.name);
      if (r.type === T.PTR && n === lc(TYPE)) {
        const key = lc(r.data);
        if (r.ttl === 0) { ptrs.delete(key); continue; }
        ptrs.set(key, { name: r.ptrLabels[0], fqdn: r.data, expires: exp(r.ttl), seen: now });
      } else if (r.type === T.SRV) {
        if (r.ttl === 0) { srvs.delete(n); continue; }
        srvs.set(n, Object.assign({}, r.data, { expires: exp(r.ttl) }));
        const pt = ptrs.get(n); if (pt) pt.seen = now;
      } else if (r.type === T.TXT) {
        if (r.ttl === 0) { txts.delete(n); continue; }
        txts.set(n, { kv: r.data, expires: exp(r.ttl) });
      } else if (r.type === T.A && r.data) {
        let m = hosts.get(n);
        if (!m) hosts.set(n, m = new Map());
        if (r.ttl === 0) m.delete(r.data); else m.set(r.data, exp(r.ttl));
      }
    }
    // Resolve what is still missing (SRV/TXT of new instances, A of their targets)
    for (const [key, pt] of ptrs) {
      if (pt.expires < now) continue;
      const s = srvs.get(key);
      if (!s) { missing.push(question(pt.fqdn, T.SRV, false), question(pt.fqdn, T.TXT, false)); continue; }
      if (!txts.get(key)) missing.push(question(pt.fqdn, T.TXT, false));
      const hm = hosts.get(lc(s.target));
      if (!hm || !hm.size) missing.push(question(s.target, T.A, false));
    }
    if (missing.length) {
      clearTimeout(entry.resolveTimer);
      entry.resolveTimer = setTimeout(() => send(entry, packet({ response: false, questions: missing.slice(0, 20) })), 50);
    }
  }

  function sendQuery(entry) { send(entry, packet({ response: false, questions: [question(TYPE, T.PTR, false)] })); }
  function queryAll() { for (const e of socks) sendQuery(e); }
  function scheduleQuery() {
    if (!browsing || closed) return;
    // 0 s, 1 s, 3 s, then every 15 s (also keeps "seen" fresh for expiry)
    const delays = [1000, 2000];
    const d = queryN < delays.length ? delays[queryN] : 15000;
    queryN++;
    browseTimer = setTimeout(() => { queryAll(); scheduleQuery(); }, d);
    browseTimer.unref?.();
  }

  function list() {
    const now = Date.now();
    const own = new Set(lanInterfaces().map(i => i.address));
    const ifs = lanInterfaces();
    const out = [];
    for (const [key, pt] of ptrs) {
      if (pt.expires < now || pt.seen + SEEN_MS < now) { ptrs.delete(key); continue; }
      const s = srvs.get(key);
      if (!s || s.expires < now) continue;
      const hm = hosts.get(lc(s.target));
      if (!hm) continue;
      const ips = [...hm].filter(([, e]) => e >= now).map(([ip]) => ip);
      if (!ips.length) continue;
      // An address in one of our subnets first
      const ip = ips.find(a => ifs.some(i => sameSubnet(a, i.address, i.netmask))) || ips[0];
      if (!includeSelf && ips.some(a => own.has(a))) continue;
      const kv = (txts.get(key) || {}).kv || {};
      // c0 / c1 = the players' colour indices, dev = the hosting device's name (missing from older hosts)
      const col = v => (v != null && /^\d+$/.test(String(v)) ? Number(v) : null);
      out.push({ name: pt.name, host: ip, port: s.port, code: kv.code || '', p0: kv.p0 || '', p1: kv.p1 || '', stage: kv.stage || '', c0: col(kv.c0), c1: col(kv.c1), dev: kv.dev || '' });
    }
    return out;
  }

  // ------------------------------------------------ public API
  function ensureOpen() {
    if (closed) return;
    openSockets();
    if (!ifTimer) { ifTimer = setInterval(() => openSockets(), 30000); ifTimer.unref?.(); }
  }

  /** Advertise every unfinished game; called after every change (GameServer onGamesChanged). */
  function setGames(port, summaries) {
    if (closed) return;
    ensureOpen();
    const want = new Map();
    for (const g of summaries || []) {
      if (!g || g.stage === 'over' || !g.code || g.movedTo) continue;   // a game handed over to another device is advertised there
      const players = g.players || [];
      const cut = s => String(s || '').slice(0, 40);
      const colors = Array.isArray(g.colors) ? g.colors : [];
      const txt = { code: g.code, p0: cut(players[0]), p1: cut(players[1]), stage: g.stage || '', dev: cut(deviceName) };
      colors.forEach((c, i) => { if (Number.isInteger(c) && i < 2) txt['c' + i] = String(c); });
      want.set(g.code, { code: g.code, instance: 'Battle Report ' + g.code, port, txt });
    }
    const gone = [];
    for (const [code, s] of services) {
      const w = want.get(code);
      if (!w) { gone.push(s); services.delete(code); }
    }
    if (gone.length) goodbye(gone);
    const fresh = [];
    for (const [code, w] of want) {
      const s = services.get(code);
      if (s && s.port === w.port && JSON.stringify(s.txt) === JSON.stringify(w.txt)) continue;
      services.set(code, w);
      fresh.push(w);
    }
    if (fresh.length) announceAll(fresh);
  }

  function startBrowse() {
    if (closed || browsing) return;
    browsing = true;
    ensureOpen();
    queryN = 0;
    setTimeout(queryAll, 100).unref?.();
    scheduleQuery();
  }
  function stopBrowse() { browsing = false; clearTimeout(browseTimer); }

  function stop() {
    if (closed) return Promise.resolve();
    stopBrowse();
    const list = [...services.values()];
    if (list.length) goodbye(list);
    services.clear();
    clearInterval(ifTimer);
    // Give the goodbye packets a moment to leave
    return new Promise(res => setTimeout(() => { closed = true; closeSockets(); res(); }, list.length ? 150 : 0));
  }

  return { setGames, startBrowse, stopBrowse, list, stop, hostname: host, get advertised() { return [...services.keys()]; } };
}
