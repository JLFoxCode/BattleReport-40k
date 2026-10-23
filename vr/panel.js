/* In-headset UI: the Quest browser has no WebXR dom-overlay, so the panel buttons are painted into a canvas texture
 * on a plane in the scene and hit by the controller ray (uv → button). Same action keys as the HTML buttons
 * (vr/index.html), so vr.js applies them through the one applyAction().
 *   const panel = new Panel(THREE, { tabs: [{ id, label }], rows: [{ tab, title } | { tab, buttons: [{ label, a, w? }] }] })
 *   panel.setState(fnIsOn) ; panel.setTab(id) ; panel.hover(uv|null) ; panel.at(uv) → button | null ; panel.draw()
 * Also a small HUD plane for text lines (toast / note / calibration step), attached to the camera. */
export class Panel {
  constructor(THREE, def, opts = {}) {
    this.THREE = THREE;
    this.tabs = def.tabs || [];
    this.rows = def.rows;
    this.tab = this.tabs.length ? this.tabs[0].id : null;
    this.pxW = 1024; this.rowH = 84; this.pad = 16; this.titleH = 44; this.tabH = 92;
    // fixed height: the tallest tab
    const tabH = id => this.rows.filter(r => !r.tab || r.tab === id).reduce((s, r) => s + (r.title ? this.titleH : this.rowH), 0);
    const maxRows = Math.max(...(this.tabs.length ? this.tabs.map(t => tabH(t.id)) : [tabH(null)]));
    this.pxH = maxRows + this.pad * 2 + (this.tabs.length ? this.tabH : 0);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.pxW; this.canvas.height = this.pxH;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const width = opts.width || 0.6;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * this.pxH / this.pxW),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
    this.mesh.renderOrder = 10;
    this.buttons = [];                             // { label, a, x, y, w, h, isTab }
    this.titles = [];
    this.hovered = null; this.isOn = () => false;
    this.layout();
    this.draw();
  }
  setTab(id) { if (this.tabs.some(t => t.id === id)) { this.tab = id; this.layout(); this.draw(); } }
  layout() {
    this.buttons = []; this.titles = [];
    let y = this.pad;
    if (this.tabs.length) {
      const gap = 10, n = this.tabs.length, w = (this.pxW - this.pad * 2 - gap * (n - 1)) / n;
      this.tabs.forEach((t, i) => this.buttons.push({ label: t.label, a: { tab: t.id }, x: this.pad + i * (w + gap), y, w, h: this.tabH - 16, isTab: true }));
      y += this.tabH;
    }
    for (const r of this.rows) {
      if (r.tab && r.tab !== this.tab) continue;
      if (r.title) { this.titles.push({ text: r.title, y }); y += this.titleH; continue; }
      const gap = 10, n = r.buttons.length;
      const sum = r.buttons.reduce((s, b) => s + (b.w || 1), 0);
      const unit = (this.pxW - this.pad * 2 - gap * (n - 1)) / sum;
      let x = this.pad;
      for (const b of r.buttons) {
        const w = unit * (b.w || 1);
        this.buttons.push({ label: b.label, a: b.a, x, y: y + 6, w, h: this.rowH - 12 });
        x += w + gap;
      }
      y += this.rowH;
    }
  }
  setState(isOn) { this.isOn = isOn; }
  draw() {
    const c = this.canvas.getContext('2d');
    c.clearRect(0, 0, this.pxW, this.pxH);
    c.fillStyle = 'rgba(14,17,23,0.88)';
    roundRect(c, 0, 0, this.pxW, this.pxH, 28); c.fill();
    c.textBaseline = 'middle';
    for (const t of this.titles) {
      c.font = '600 24px sans-serif'; c.fillStyle = '#9aa3b2'; c.textAlign = 'left';
      c.fillText(t.text.toUpperCase(), this.pad + 8, t.y + this.titleH / 2 + 4);
    }
    for (const b of this.buttons) {
      const on = b.isTab ? b.a.tab === this.tab : this.isOn(b.a), hov = this.hovered === b;
      c.fillStyle = on ? (b.isTab ? '#2f5fc4' : '#4ad6ff') : hov ? '#334159' : (b.isTab ? '#141922' : '#1c2230');
      c.strokeStyle = hov ? '#ffffff' : on ? (b.isTab ? '#6f97f2' : '#4ad6ff') : '#3a4356'; c.lineWidth = hov ? 4 : 2;
      roundRect(c, b.x, b.y, b.w, b.h, 16); c.fill(); c.stroke();
      c.font = (on ? '700 ' : '500 ') + (b.isTab ? '34px' : '30px') + ' sans-serif';
      c.fillStyle = on && !b.isTab ? '#06202a' : '#e8ecf2'; c.textAlign = 'center';
      c.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2);
    }
    this.tex.needsUpdate = true;
  }
  /** uv from a raycast intersection → button or null */
  at(uv) {
    if (!uv) return null;
    const x = uv.x * this.pxW, y = (1 - uv.y) * this.pxH;
    return this.buttons.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  }
  hover(uv) {
    const b = this.at(uv);
    if (b !== this.hovered) { this.hovered = b; this.draw(); }
    return b;
  }
}

export class Hud {
  constructor(THREE, opts = {}) {
    this.THREE = THREE;
    this.pxW = 1024; this.pxH = 320;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.pxW; this.canvas.height = this.pxH;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace;
    const w = opts.width || 0.5;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * this.pxH / this.pxW),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false }));
    this.mesh.renderOrder = 11;
    this.lines = []; this.draw();
  }
  /** lines: [{ text, big?, color? }] */
  set(lines) {
    const key = JSON.stringify(lines);
    if (key === this._key) return; this._key = key;
    this.lines = lines.filter(l => l && l.text); this.draw();
  }
  draw() {
    const c = this.canvas.getContext('2d');
    c.clearRect(0, 0, this.pxW, this.pxH);
    this.mesh.visible = this.lines.length > 0;
    if (!this.lines.length) { this.tex.needsUpdate = true; return; }
    const sizes = this.lines.map(l => l.big ? 44 : 30);
    const total = sizes.reduce((s, v) => s + v + 16, 0) + 24;
    const y0 = (this.pxH - total) / 2;
    c.fillStyle = 'rgba(14,17,23,0.82)'; roundRect(c, 40, y0, this.pxW - 80, total, 24); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    let y = y0 + 20;
    this.lines.forEach((l, i) => {
      c.font = (l.big ? '700 ' : '500 ') + sizes[i] + 'px sans-serif'; c.fillStyle = l.color || '#e8ecf2';
      wrap(c, l.text, this.pxW / 2, y + sizes[i] / 2, this.pxW - 140, sizes[i] + 6);
      y += sizes[i] + 16;
    });
    this.tex.needsUpdate = true;
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function wrap(c, text, x, y, maxW, lh) {
  const words = String(text).split(' '); let line = '', lines = [];
  for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => c.fillText(l, x, y + i * lh));
}
