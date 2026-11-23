/* Kotsudo lab: a tiny 3D line renderer on a 2D canvas, shared by the animation-workflow pages.
   Display space is right-handed, Y up (Maya's). Quaternions are [x, y, z, w]. */
(() => {
'use strict';
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: a => Math.hypot(a[0], a[1], a[2]),
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
};
const Q = {
  id: () => [0, 0, 0, 1],
  axis: (ax, deg) => { const h = deg * D2R / 2, s = Math.sin(h), n = V.len(ax) || 1; return [ax[0] / n * s, ax[1] / n * s, ax[2] / n * s, Math.cos(h)]; },
  mul: (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]],
  inv: q => [-q[0], -q[1], -q[2], q[3]],
  rot: (q, v) => { const p = Q.mul(Q.mul(q, [v[0], v[1], v[2], 0]), Q.inv(q)); return [p[0], p[1], p[2]]; },
  angle: (a, b) => { const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return 2 * Math.acos(Math.min(1, d)) * R2D; },
  /* Euler XYZ (X applied first, then Y, then Z, about fixed axes), degrees */
  euler: (x, y, z) => Q.mul(Q.axis([0, 0, 1], z), Q.mul(Q.axis([0, 1, 0], y), Q.axis([1, 0, 0], x))),
  toEuler: q => {
    const [x, y, z, w] = q;
    const sx = 2 * (w * x + y * z), cx = 1 - 2 * (x * x + y * y);
    const sy = Math.max(-1, Math.min(1, 2 * (w * y - z * x)));
    const sz = 2 * (w * z + x * y), cz = 1 - 2 * (y * y + z * z);
    return [Math.atan2(sx, cx) * R2D, Math.asin(sy) * R2D, Math.atan2(sz, cz) * R2D];
  }
};
/* A rigid transform: position + rotation. T.mul(parent, local) = world. */
const T = {
  make: (p, q) => ({ p, q }),
  mul: (a, b) => ({ p: V.add(a.p, Q.rot(a.q, b.p)), q: Q.mul(a.q, b.q) }),
  inv: a => { const qi = Q.inv(a.q); return { p: V.mul(Q.rot(qi, a.p), -1), q: qi }; }
};

/* Theme: ?theme=dark|light from the portfolio, else the system setting. */
function theme() {
  const t = new URLSearchParams(location.search).get('theme');
  const dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  return { dark, ground: g('--ground'), panel: g('--panel'), ink: g('--ink'), ink2: g('--ink-2'), line: g('--line'),
    accent: g('--accent'), maya: g('--maya'), ue: g('--ue'), bad: g('--bad'), grid: g('--grid') };
}

/* One 3D view on a canvas. Several views can share one camera (cam) so they turn together. */
class View {
  constructor(canvas, cam) {
    this.c = canvas; this.x = canvas.getContext('2d'); this.cam = cam;
    let drag = null;
    canvas.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); cam.auto = false; });
    canvas.addEventListener('pointermove', e => {
      if (!drag) return;
      cam.yaw -= (e.clientX - drag[0]) * .008; cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + (e.clientY - drag[1]) * .008));
      drag = [e.clientX, e.clientY]; cam.dirty = true;
    });
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.max(cam.min || 20, Math.min(cam.max || 2000, cam.dist * Math.exp(e.deltaY * .001))); cam.dirty = true; }, { passive: false });
  }
  begin(bg) {
    const r = this.c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
    const x = this.x; x.setTransform(dpr, 0, 0, dpr, 0, 0); this.w = r.width; this.h = r.height;
    x.clearRect(0, 0, r.width, r.height); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, r.width, r.height); }
    const c = this.cam, cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    this.f = Math.min(r.width, r.height) * 1.6; this.k = [cy, sy, cp, sp];
  }
  proj(p) {
    const c = this.cam, [cy, sy, cp, sp] = this.k;
    const x0 = p[0] - c.target[0], y0 = p[1] - c.target[1], z0 = p[2] - c.target[2];
    const x1 = cy * x0 - sy * z0, z1 = sy * x0 + cy * z0;
    const y2 = cp * y0 - sp * z1, z2 = sp * y0 + cp * z1;
    const d = c.dist - z2;
    return [this.w / 2 + this.f * x1 / d, this.h / 2 - this.f * y2 / d, d];
  }
  line(a, b, col, w = 1.5, dash) {
    const p = this.proj(a), q = this.proj(b), x = this.x;
    if (p[2] < 1 || q[2] < 1) return;
    x.strokeStyle = col; x.lineWidth = w; x.setLineDash(dash || []); x.lineCap = 'round';
    x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); x.setLineDash([]);
  }
  dot(a, r, col, ring) {
    const p = this.proj(a), x = this.x; if (p[2] < 1) return;
    const rr = r * this.f / p[2] / 40;
    x.beginPath(); x.arc(p[0], p[1], Math.max(1.5, rr), 0, Math.PI * 2);
    if (ring) { x.strokeStyle = col; x.lineWidth = 1.5; x.stroke(); } else { x.fillStyle = col; x.fill(); }
  }
  text(a, s, col, dx = 6, dy = -6, size = 11) {
    const p = this.proj(a), x = this.x; if (p[2] < 1) return;
    x.font = '600 ' + size + 'px "M PLUS 1 Code", ui-monospace, monospace'; x.fillStyle = col; x.fillText(s, p[0] + dx, p[1] + dy);
  }
  /* a tripod: X red-ish, Y, Z; labels names[] */
  axes(tr, len, cols, names, w = 2, dash) {
    const dirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    dirs.forEach((d, i) => {
      const e = V.add(tr.p, Q.rot(tr.q, V.mul(d, len)));
      this.line(tr.p, e, cols[i], w, dash);
      if (names && names[i]) this.text(e, names[i], cols[i], 4, 4);
    });
  }
  grid(size, step, col) {
    for (let i = -size; i <= size; i += step) {
      this.line([i, 0, -size], [i, 0, size], col, i === 0 ? 1.2 : .6);
      this.line([-size, 0, i], [size, 0, i], col, i === 0 ? 1.2 : .6);
    }
  }
}
window.K3 = { V, Q, T, View, theme, D2R, R2D };
})();
