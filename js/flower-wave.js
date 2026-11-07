/* <flower-wave>: the Murakami flower waving, drawn as outlines in the site's line style.
   The lines come from the Maya rig (media/flower/flower-wave.json): visible silhouettes and borders in ink,
   eyes, mouth and sharp creases in the accent colour, 14 frames looping at 24 fps.
   The glitch pass matches js/flower-gl.js: torn rows, block shifts and a red/cyan split, plus a burst on hover.

   <flower-wave src="media/flower/flower-wave.json"></flower-wave>
   Attributes (all optional):
     src      data file (default media/flower/flower-wave.json)
     glitch   constant glitch, 0 to 1 (default .22, the intro's value)
     line     line width in CSS px (default 1.4)
     speed    playback speed (default 1)
     mode     "site" ink + accent (default), "ink" or "accent" for one colour
     frame    show one frame, still (0 to 13)
     paused   stop on the current frame
     calm     no burst on hover
     shatter  a click breaks the drawing into pixels that blow away, and it comes back 3 seconds later
   Colours come from the CSS custom properties --ink, --accent, --gl-a and --gl-b, so the light and dark themes
   and the accent picker apply on their own; set them on the element to override one instance.
   el.burst(1) fires a glitch burst from script, el.shatter() runs the click effect. Reduced motion shows a still frame without glitch. */
(function () {
'use strict';
const cache = new Map();
function load(src) {
  if (!cache.has(src)) cache.set(src, fetch(src).then(r => (r.ok ? r.json() : Promise.reject(r.status))).then(d => {
    const dec = L => { const p = new Float32Array(L.length); let x = L[0], y = L[1]; p[0] = x; p[1] = y; for (let i = 2; i < L.length; i += 2) { x += L[i]; y += L[i + 1]; p[i] = x; p[i + 1] = y; } return p; };
    d.frames = d.frames.map(f => ({ i: f.i.map(dec), a: f.a.map(dec) }));
    return d;
  }));
  return cache.get(src);
}
const still = matchMedia('(prefers-reduced-motion: reduce)');
const dark = matchMedia('(prefers-color-scheme: dark)');
const fr = x => x - Math.floor(x);
const hash = (x, y) => fr(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const mix = (a, b, k) => a + (b - a) * k;
const all = new Set();
/* shatter timing, in seconds from the click: blow away, stay gone, gather back */
const OUT = 1.3, BACK = 3, IN = .8;
/* the pixels may fly outside the element: the overlay canvas reaches this far past each side (fractions of the box) */
const ML = 1.6, MR = .3, MT = .7, MB = .15;
new MutationObserver(() => all.forEach(el => el._colours())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'class', 'style'] });
dark.addEventListener('change', () => all.forEach(el => el._colours()));
still.addEventListener('change', () => all.forEach(el => el._wake()));

class FlowerWave extends HTMLElement {
  static get observedAttributes() { return ['src', 'glitch', 'line', 'speed', 'mode', 'frame', 'paused']; }
  constructor() {
    super();
    this._t = 0; this._burst = 0; this._raf = 0; this._last = 0; this._seen = false; this._data = null; this._f = -1;
    this._cv = document.createElement('canvas');
    this._cv.setAttribute('aria-hidden', 'true');
    this._cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    this._base = document.createElement('canvas'); this._mix = document.createElement('canvas');
    this._ta = document.createElement('canvas'); this._tb = document.createElement('canvas');
    this._tick = this._tick.bind(this);
  }
  connectedCallback() {
    if (!this.style.display && getComputedStyle(this).display === 'inline') this.style.display = 'block';
    if (getComputedStyle(this).position === 'static') this.style.position = 'relative';
    if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
    if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'The flower character waving');
    this.prepend(this._cv);
    all.add(this);
    this._colours();
    this._ro = new ResizeObserver(() => this._paint()); this._ro.observe(this);
    this._io = new IntersectionObserver(es => { this._seen = es[0].isIntersecting; this._wake(); }); this._io.observe(this);
    this._vis = () => this._wake(); document.addEventListener('visibilitychange', this._vis);
    this._hover = () => { if (!this.hasAttribute('calm') && !this._sh) this.burst(.9); }; this.addEventListener('pointerenter', this._hover);
    this._click = () => { if (this.hasAttribute('shatter')) this.shatter(); }; this.addEventListener('click', this._click);
    this._load();
  }
  disconnectedCallback() {
    all.delete(this); this._ro.disconnect(); this._io.disconnect();
    document.removeEventListener('visibilitychange', this._vis); this.removeEventListener('pointerenter', this._hover); this.removeEventListener('click', this._click);
    if (this._px) { this._px.remove(); this._px = null; } this._sh = null;
    cancelAnimationFrame(this._raf); this._raf = 0;
  }
  attributeChangedCallback(n) { if (!this.isConnected) return; if (n === 'src') this._load(); else { this._paint(); this._wake(); } }
  burst(v = 1) { this._burst = Math.max(this._burst, Math.min(1, v)); this._wake(); }

  /* Break the current frame into one particle per line segment. Each waits its turn (a sweep from the right,
     plus noise), then flies off up and to the left as a square pixel, fading; at BACK they all fly back in. */
  shatter() {
    const d = this._data; if (this._sh || !d) return;
    const f = this._f >= 0 ? this._f : 0, P = [];
    const add = (lines, acc) => lines.forEach(p => { for (let i = 2; i < p.length; i += 2) {
      const x0 = p[i - 2], y0 = p[i - 1], x1 = p[i], y1 = p[i + 1], r = Math.random(), r2 = Math.random();
      P.push({ x0, y0, x1, y1, acc, gl: r2 < .06 ? 1 : r2 < .12 ? 2 : 0,
        dl: (1 - (x0 + x1) / 2 / d.w) * .7 + Math.random() * .3,
        vx: -(.25 + 1.1 * r) * d.w + (Math.random() - .5) * .3 * d.w,
        vy: -(.15 + .6 * Math.random()) * d.h + (Math.random() - .3) * .25 * d.h,
        sz: .8 + 1.8 * Math.random() });
    } });
    add(d.frames[f].i, false); add(d.frames[f].a, true);
    this._px = document.createElement('canvas'); this._px.setAttribute('aria-hidden', 'true');
    this._px.style.cssText = `position:absolute;left:${-ML * 100}%;right:${-MR * 100}%;top:${-MT * 100}%;bottom:${-MB * 100}%;pointer-events:none`;
    this.append(this._px);
    this._sh = { t0: performance.now(), f, P };
    this._burst = Math.max(this._burst, .6); this._wake();
  }

  _load() {
    const src = this.getAttribute('src') || 'media/flower/flower-wave.json';
    load(src).then(d => {
      this._data = d;
      /* only when nothing gives the element a height: then it takes the drawing's shape */
      if (this.getBoundingClientRect().height < 2 && getComputedStyle(this).aspectRatio === 'auto') this.style.aspectRatio = d.w + ' / ' + d.h;
      this._paint(); this._wake();
    }).catch(() => { this._data = null; });
  }
  _colours() {
    const cs = getComputedStyle(this), g = (n, f) => cs.getPropertyValue(n).trim() || f;
    this._C = { ink: g('--ink', '#E9EBF0'), acc: g('--accent', '#B4F000'), glA: g('--gl-a', '#FF2E4D'), glB: g('--gl-b', '#12C8F0') };
    this._f = -1; this._paint();
  }
  _num(n, d) { const v = parseFloat(this.getAttribute(n)); return Number.isFinite(v) ? v : d; }
  _moving() { return !still.matches && !this.hasAttribute('paused') && !this.hasAttribute('frame'); }
  _wake() {
    const run = this._data && this._seen && !document.hidden && (this._moving() || this._burst > 0 || this._sh);
    if (run && !this._raf) { this._last = performance.now(); this._raf = requestAnimationFrame(this._tick); }
    if (!run) this._paint();
  }
  _tick(now) {
    this._raf = 0;
    const dt = Math.min(.1, Math.max(0, (now - this._last) / 1000)); this._last = now;
    if (this._moving() && !this._sh) this._t += dt * this._num('speed', 1);
    this._burst = Math.max(0, this._burst - dt * 1.8);
    this._paint(now / 1000);
    if (this._sh && (now - this._sh.t0) / 1000 >= BACK + IN) { this._px.remove(); this._px = null; this._sh = null; this._f = -1; this.burst(.7); this._paint(now / 1000); }
    if (this._data && this._seen && !document.hidden && (this._moving() || this._burst > 0 || this._sh)) this._raf = requestAnimationFrame(this._tick);
  }

  /* During a shatter: the segments still in place go on the base canvas (so the glitch pass still runs on them),
     the flying pixels on the overlay canvas, which reaches past the element's box. */
  _paintShatter(sh, d, W, H, cw, ch, dpr, C, mode, lw) {
    const t = (performance.now() - sh.t0) / 1000;
    const A = t < OUT ? t / OUT : t < BACK ? 1 : Math.max(0, 1 - (t - BACK) / IN);
    const s = Math.min(W / d.w, H / d.h), ox = (W - d.w * s) / 2, oy = (H - d.h * s) / 2, move = still.matches ? 0 : 1;
    const ink = mode === 'accent' ? C.acc : C.ink, acc = mode === 'ink' ? C.ink : C.acc;
    const b = this._base.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H);
    b.lineWidth = lw * dpr; b.lineCap = 'square'; b.lineJoin = 'round';
    const px = this._px, PW = Math.round(cw * (1 + ML + MR) * dpr), PH = Math.round(ch * (1 + MT + MB) * dpr);
    if (px.width !== PW || px.height !== PH) { px.width = PW; px.height = PH; }
    const o = px.getContext('2d'); o.clearRect(0, 0, PW, PH);
    const X0 = ML * cw * dpr + ox, Y0 = MT * ch * dpr + oy;
    [[false, ink], [true, acc]].forEach(([isAcc, col]) => {
      b.strokeStyle = col; b.beginPath();
      sh.P.forEach(p => {
        if (p.acc !== isAcc) return;
        const q = Math.max(0, Math.min(1, (A - p.dl * .45) / .55));
        if (q <= 0) { b.moveTo(ox + p.x0 * s, oy + p.y0 * s); b.lineTo(ox + p.x1 * s, oy + p.y1 * s); return; }
        if (q >= 1) return;
        const e = q * q * move, x = X0 + ((p.x0 + p.x1) / 2 + p.vx * e) * s, y = Y0 + ((p.y0 + p.y1) / 2 + p.vy * e) * s;
        const z = Math.max(1, p.sz * lw * dpr * (1 - q * .4));
        o.globalAlpha = Math.pow(1 - q, .8);
        o.fillStyle = p.gl === 1 ? C.glA : p.gl === 2 ? C.glB : col;
        o.fillRect(Math.round(x - z / 2), Math.round(y - z / 2), Math.round(z), Math.round(z));
      });
      b.stroke();
    });
    o.globalAlpha = 1;
  }

  /* draw the current frame's lines on the base canvas, then the glitch pass onto the visible one */
  _paint(time = performance.now() / 1000) {
    const d = this._data; if (!d) return;
    const r = this.getBoundingClientRect(), cw = Math.max(1, r.width), ch = Math.max(1, r.height);
    const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(cw * dpr), H = Math.round(ch * dpr);
    [this._cv, this._base, this._mix, this._ta, this._tb].forEach(c => { if (c.width !== W || c.height !== H) { c.width = W; c.height = H; this._f = -1; } });
    const n = d.frames.length, fixed = this.hasAttribute('frame') ? Math.max(0, Math.min(n - 1, this._num('frame', 0) | 0)) : -1;
    const sh = this._sh;
    const f = sh ? sh.f : fixed >= 0 ? fixed : still.matches ? 0 : Math.floor(this._t * d.fps) % n;
    const C = this._C, mode = this.getAttribute('mode') || 'site', lw = this._num('line', 1.4);
    if (sh) this._paintShatter(sh, d, W, H, cw, ch, dpr, C, mode, lw);
    else if (f !== this._f || this._lw !== lw || this._mode !== mode) {
      this._f = f; this._lw = lw; this._mode = mode;
      const b = this._base.getContext('2d'), s = Math.min(W / d.w, H / d.h), ox = (W - d.w * s) / 2, oy = (H - d.h * s) / 2;
      b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W, H);
      b.lineWidth = lw * dpr; b.lineCap = 'square'; b.lineJoin = 'round';
      const stroke = (lines, col) => {
        b.strokeStyle = col; b.beginPath();
        lines.forEach(p => { b.moveTo(ox + p[0] * s, oy + p[1] * s); for (let i = 2; i < p.length; i += 2) b.lineTo(ox + p[i] * s, oy + p[i + 1] * s); });
        b.stroke();
      };
      stroke(d.frames[f].i, mode === 'accent' ? C.acc : C.ink);
      stroke(d.frames[f].a, mode === 'ink' ? C.ink : C.acc);
    }
    const out = this._cv.getContext('2d');
    out.setTransform(1, 0, 0, 1, 0, 0); out.clearRect(0, 0, W, H);
    const uG = still.matches ? 0 : Math.max(0, Math.min(1, this._num('glitch', .22))), uB = still.matches ? 0 : this._burst;
    const g = Math.min(1, uG * .7 + uB);
    if (g <= 0) { out.drawImage(this._base, 0, 0); return; }
    const fq = Math.floor(time * 14);
    /* red / cyan split: tinted copies of the lines, offset either side, under the lines themselves */
    const sp = (1 + 4 * uG + 14 * uB) * dpr, k = Math.min(1, .6 * uG + uB);
    [[this._ta, C.glA], [this._tb, C.glB]].forEach(([c, col]) => {
      const x = c.getContext('2d'); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, H);
      x.drawImage(this._base, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, W, H);
    });
    const m = this._mix.getContext('2d'); m.clearRect(0, 0, W, H);
    m.globalAlpha = k * .85; m.drawImage(this._ta, sp, 0); m.drawImage(this._tb, -sp, 0);
    m.globalAlpha = 1; m.drawImage(this._base, 0, 0);
    out.drawImage(this._mix, 0, 0);
    /* torn rows */
    const rows = Math.round(mix(90, 26, uB)), bh = H / rows, amp = (.02 + .03 * uG + .12 * uB) * W;
    for (let i = 0; i < rows; i++) {
      if (hash(i, fq) >= g * .22) continue;
      const y = Math.floor(i * bh), h = Math.ceil(bh), dx = (hash(i, fq + 7) - .5) * amp;
      out.clearRect(0, y, W, h); out.drawImage(this._mix, 0, y, W, h, dx, y, W, h);
    }
    /* shifted blocks */
    const BX = 18, BY = 32, bw = W / BX, bb = H / BY;
    for (let by = 0; by < BY; by++) for (let bx = 0; bx < BX; bx++) {
      if (hash(bx + fq * 1.7, by + fq * 1.7) >= g * .035) continue;
      const x = Math.floor(bx * bw), y = Math.floor(by * bb), w = Math.ceil(bw), h = Math.ceil(bb);
      const sx = Math.round(x + (hash(bx + 3.1, by + 3.1) - .5) * .12 * W), sy = Math.round(y + (hash(bx + 9.2, by + 9.2) - .5) * .04 * H);
      out.clearRect(x, y, w, h);
      if (sx >= 0 && sy >= 0 && sx + w <= W && sy + h <= H) out.drawImage(this._mix, sx, sy, w, h, x, y, w, h);
    }
  }
}
if (!customElements.get('flower-wave')) customElements.define('flower-wave', FlowerWave);
})();
